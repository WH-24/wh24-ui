/**
 * Проверка САМОЙ схемы — порт wh24-forms-api/internal/schema:
 *   normalize()           ↔ schema.Normalize (структурная вменяемость черновика,
 *                           первая найденная проблема);
 *   validateForPublish()  ↔ schema.ValidateForPublish (полный чек-лист блокеров
 *                           публикации за один проход — редактор показывает их
 *                           списком до похода на сервер; сервер остаётся
 *                           источником истины и отдаёт тот же список 422-м).
 *
 * Сообщения — те же, что у бэкенда, слово в слово: пользователь видит их и
 * до, и после публикации, и они не должны различаться.
 */
import { FormulaParseError, formulaOrder, formulaRefs, parseFormula } from './formula/formula.js'
import type {
  ConditionGroup,
  Field,
  FormulaConfig,
  FormulaResult,
  LookupConfig,
  RecordRefConfig,
  SchemaDocument,
  SchemaValidationError,
  SystemKey,
  TableColumn,
  TableConfig,
} from './types.js'
import {
  FIELD_SPANS,
  FIELD_TYPES,
  FORMULA_RESULTS,
  conditionLeaves,
  MAX_VISIBILITY_CHAIN_DEPTH,
  SYSTEM_FIELD_TYPES,
  SYSTEM_KEYS,
  TABLE_COLUMN_TYPES,
  TITLE_CAPABLE_TYPES,
  isComputedField,
  isPresentation,
} from './types.js'

function labelOr(f: Pick<Field, 'label' | 'key' | 'id'>): string {
  return f.label || f.key || f.id
}

function colLabelOr(c: TableColumn): string {
  return c.label || c.key || c.id
}

/** Структурная проверка черновика. null — можно сохранять. */
export function normalize(d: SchemaDocument | null | undefined): string | null {
  if (!d) return 'schema: документ не задан'
  const sections = new Set<string>()
  for (const s of d.sections) {
    if (!s.id) return `schema: у секции "${s.title}" пустой id`
    if (sections.has(s.id)) return `schema: повторяющийся id секции "${s.id}"`
    sections.add(s.id)
  }
  const seen = new Set<string>()
  for (const f of d.fields) {
    if (!f.id) return `schema: у поля "${f.label}" пустой id`
    if (seen.has(f.id)) return `schema: повторяющийся id поля "${f.id}"`
    seen.add(f.id)
    if (!(FIELD_TYPES as readonly string[]).includes(f.type))
      return `schema: поле "${f.id}" имеет неизвестный тип "${f.type}"`
    if (!(FIELD_SPANS as readonly number[]).includes(f.span))
      return `schema: поле "${f.id}" имеет недопустимую ширину span=${f.span} (допустимо 3,4,6,12)`
    if (!f.section_id || !sections.has(f.section_id))
      return `schema: поле "${f.id}" ссылается на несуществующую секцию "${f.section_id}"`
  }
  return normalizeSystem(d)
}

/** Системные поля — как schema.normalizeSystem в Go. */
function normalizeSystem(d: SchemaDocument): string | null {
  const seen = new Map<SystemKey, string>()
  for (const f of d.fields) {
    if (!f.system) continue
    if (!(SYSTEM_KEYS as readonly string[]).includes(f.system))
      return `schema: поле "${f.id}": неизвестное системное поле "${f.system}"`
    if (d.binding) return `schema: у карточки модуля системных полей нет (поле "${f.id}")`
    const want = SYSTEM_FIELD_TYPES[f.system]
    if (f.type !== want) return `schema: системное поле "${f.id}" должно быть типа "${want}", а не "${f.type}"`
    if (isComputedField(f) && f.required)
      return `schema: поле "${f.id}" заполняется само — обязательным быть не может`
    if (f.archived) continue
    const other = seen.get(f.system)
    if (other !== undefined) return `schema: системное поле "${f.system}" уже есть в форме (поле "${other}")`
    seen.set(f.system, f.id)
  }
  return null
}

/** Все поля, на которые ссылается группа (all и any, со вложенными группами). */
export function conditionFieldRefs(g: ConditionGroup | null | undefined): string[] {
  return conditionLeaves(g)
    .map((c) => c.field)
    .filter(Boolean)
}

/** Граф «поле → от каких полей зависит по visible_if» (только существующие ссылки). */
export function visibilityDeps(fields: Field[]): Map<string, string[]> {
  const ids = new Set(fields.map((f) => f.id))
  const deps = new Map<string, string[]>()
  for (const f of fields) {
    const refs = conditionFieldRefs(f.visible_if).filter((r) => ids.has(r))
    if (refs.length) deps.set(f.id, refs)
  }
  return deps
}

/**
 * Глубина цепочки зависимостей поля (в рёбрах): A зависит от B, B от C — у A
 * глубина 2. Поля в цикле не считаются (цикл — отдельная ошибка).
 */
export function chainDepth(fieldId: string, deps: Map<string, string[]>, inCycle: Set<string> = new Set()): number {
  const memo = new Map<string, number>()
  const depth = (id: string): number => {
    const m = memo.get(id)
    if (m !== undefined) return m
    let best = 0
    for (const dep of deps.get(id) ?? []) {
      if (inCycle.has(dep)) continue
      best = Math.max(best, depth(dep) + 1)
    }
    memo.set(id, best)
    return best
  }
  return inCycle.has(fieldId) ? 0 : depth(fieldId)
}

/** Поля, вовлечённые хоть в один цикл, и по ошибке на каждый найденный цикл. */
function detectCycles(
  fields: Field[],
  deps: Map<string, string[]>,
  byId: Map<string, Field>,
): { inCycle: Set<string>; errs: SchemaValidationError[] } {
  const WHITE = 0
  const GRAY = 1
  const BLACK = 2
  const state = new Map<string, number>()
  const inCycle = new Set<string>()
  const errs: SchemaValidationError[] = []
  const visit = (id: string, stack: string[]) => {
    const st = state.get(id) ?? WHITE
    if (st === BLACK) return
    if (st === GRAY) {
      inCycle.add(id)
      for (let i = stack.length - 1; i >= 0; i--) {
        inCycle.add(stack[i]!)
        if (stack[i] === id) break
      }
      const f = byId.get(id)
      errs.push({
        field_id: id,
        message: `Условия показа образуют цикл: поле «${f ? labelOr(f) : id}» зависит (прямо или через цепочку других полей) от самого себя`,
      })
      return
    }
    state.set(id, GRAY)
    for (const dep of deps.get(id) ?? []) visit(dep, [...stack, id])
    state.set(id, BLACK)
  }
  for (const f of fields) if ((state.get(f.id) ?? WHITE) === WHITE) visit(f.id, [])
  return { inCycle, errs }
}

function validateVisibility(fields: Field[], byId: Map<string, Field>): SchemaValidationError[] {
  const errs: SchemaValidationError[] = []
  const deps = new Map<string, string[]>()
  for (const f of fields) {
    for (const ref of conditionFieldRefs(f.visible_if)) {
      if (!byId.has(ref)) {
        errs.push({
          field_id: f.id,
          message: `Поле «${labelOr(f)}»: условие показа ссылается на несуществующее поле "${ref}"`,
        })
        continue
      }
      deps.set(f.id, [...(deps.get(f.id) ?? []), ref])
    }
  }
  const { inCycle, errs: cycleErrs } = detectCycles(fields, deps, byId)
  errs.push(...cycleErrs)
  for (const f of fields) {
    if (inCycle.has(f.id)) continue
    const d = chainDepth(f.id, deps, inCycle)
    if (d > MAX_VISIBILITY_CHAIN_DEPTH) {
      errs.push({
        field_id: f.id,
        message: `Условие показа поля «${labelOr(f)}» зависит от слишком длинной цепочки полей (глубина ${d}, максимум ${MAX_VISIBILITY_CHAIN_DEPTH})`,
      })
    }
  }
  return errs
}

/**
 * Полный чек-лист блокеров публикации. prev — последняя ОПУБЛИКОВАННАЯ
 * версия (null для первой публикации). Пустой список — публиковать можно.
 */
export function validateForPublish(
  prev: SchemaDocument | null | undefined,
  next: SchemaDocument | null | undefined,
): SchemaValidationError[] {
  if (!next) return [{ message: 'Схема формы не задана' }]
  const byId = new Map(next.fields.map((f) => [f.id, f]))
  const errs: SchemaValidationError[] = []

  // --- Название записи --- (у формы-карточки необязательно: название у самой
  // сущности модуля, как schema.ValidateForPublish в Go)
  if (!next.title_field && next.binding) {
    // ничего
  } else if (!next.title_field) {
    errs.push({ message: 'Поле «Название записи» не выбрано' })
  } else {
    const tf = byId.get(next.title_field)
    if (!tf) {
      errs.push({
        field_id: next.title_field,
        message: 'Поле «Название записи» ссылается на несуществующее поле',
      })
    } else if (!TITLE_CAPABLE_TYPES.includes(tf.type)) {
      errs.push({
        field_id: tf.id,
        message: `Поле «${labelOr(tf)}» не подходит для названия записи (тип «${tf.type}»)`,
      })
    } else if (isComputedField(tf)) {
      errs.push({
        field_id: tf.id,
        message: `Поле «${labelOr(tf)}» заполняется само и не подходит для названия записи`,
      })
    }
  }

  // --- Дубли ключей среди активных полей ---
  const seenKeys = new Map<string, string>()
  for (const f of next.fields) {
    if (f.archived || !f.key) continue
    const first = seenKeys.get(f.key)
    if (first !== undefined) {
      errs.push({
        field_id: f.id,
        message: `Поле «${labelOr(f)}» использует ключ "${f.key}", уже занятый полем «${labelOr(byId.get(first)!)}»`,
      })
      continue
    }
    seenKeys.set(f.key, f.id)
  }

  errs.push(...validateVisibility(next.fields, byId))

  // --- Системные поля: смысл не меняется, условия по вычисляемым не работают ---
  if (prev) {
    const prevById = new Map(prev.fields.map((f) => [f.id, f]))
    for (const f of next.fields) {
      const pf = prevById.get(f.id)
      if (pf && (pf.system ?? '') !== (f.system ?? '')) {
        errs.push({
          field_id: f.id,
          message: `Поле «${labelOr(f)}»: системное назначение нельзя менять после публикации — архивируйте поле и создайте новое`,
        })
      }
    }
  }
  for (const f of next.fields) {
    const rules: [string, ConditionGroup | undefined][] = [
      ['условие показа', f.visible_if],
      ['условие обязательности', f.required_if],
    ]
    for (const [name, g] of rules) {
      for (const ref of conditionFieldRefs(g)) {
        const rf = byId.get(ref)
        if (rf && isComputedField(rf)) {
          errs.push({
            field_id: f.id,
            message: `Поле «${labelOr(f)}»: ${name} по полю «${labelOr(rf)}» не сработает — оно заполняется само и в записи не хранится`,
          })
        }
      }
    }
  }

  // --- Правила формы «если …, то …» (validateRulesForPublish в Go; операторы
  // и значения проверяет редактор условий и сервер) ---
  ;(next.rules ?? []).forEach((r, i) => {
    const name = r.name.trim()
    const owner = name ? `Правило «${name}»` : `Правило №${i + 1}`
    const fieldId = conditionFieldRefs(r.then)[0]
    const at = fieldId ? { field_id: fieldId } : {}
    if (!name) errs.push({ ...at, message: `${owner}: не задано название` })
    if (conditionFieldRefs(r.when).length === 0) errs.push({ ...at, message: `${owner}: не заданы условия «Если»` })
    if (conditionFieldRefs(r.then).length === 0) {
      errs.push({ ...at, message: `${owner}: не задано, каким должно быть значение («То»)` })
    }
    const parts: [string, ConditionGroup | undefined][] = [
      ['условие «Если»', r.when],
      ['следствие «То»', r.then],
    ]
    for (const [part, g] of parts) {
      for (const ref of conditionFieldRefs(g)) {
        const rf = byId.get(ref)
        if (!rf) {
          errs.push({ ...at, message: `${owner}: ${part} ссылается на несуществующее поле "${ref}"` })
        } else if (rf.archived) {
          errs.push({ ...at, message: `${owner}: ${part} по полю «${labelOr(rf)}» не сработает — поле в архиве` })
        } else if (isComputedField(rf) || isPresentation(rf.type)) {
          errs.push({
            ...at,
            message: `${owner}: ${part} по полю «${labelOr(rf)}» не сработает — оно заполняется само и в записи не хранится`,
          })
        }
      }
    }
  })

  // --- Смена типа опубликованного поля ---
  if (prev) {
    const prevById = new Map(prev.fields.map((f) => [f.id, f]))
    for (const f of next.fields) {
      const pf = prevById.get(f.id)
      if (pf && pf.type !== f.type) {
        errs.push({
          field_id: f.id,
          message: `Тип поля «${labelOr(f)}» нельзя менять после публикации (было «${pf.type}», стало «${f.type}») — архивируйте поле и создайте новое`,
        })
      }
    }
  }

  errs.push(...validateComputedForPublish(next, byId))

  // --- Типы колонок таблицы ---
  for (const f of next.fields) {
    if (f.type !== 'table' || !f.config) continue
    const cols = (f.config as TableConfig).columns ?? []
    for (const col of cols) {
      if (!TABLE_COLUMN_TYPES.includes(col.type)) {
        errs.push({
          field_id: f.id,
          message: `Поле «${labelOr(f)}»: столбец «${colLabelOr(col)}» использует недопустимый для таблицы тип «${col.type}»`,
        })
      }
    }
  }
  return errs
}

const FORMULA_REF_EXCLUDED = new Set<string>(['section', 'note', 'file', 'contact', 'lookup'])

/**
 * Блокеры формул и подстановок (schema.validateComputedForPublish в Go,
 * тексты те же): формула задана, разбирается, ссылается на активные поля
 * подходящих типов, формулы не зацикливаются; у подстановки выбраны поле
 * «Форма» (одна запись) и поле источника.
 */
function validateComputedForPublish(next: SchemaDocument, byId: Map<string, Field>): SchemaValidationError[] {
  const errs: SchemaValidationError[] = []
  const byKey = new Map(next.fields.filter((f) => !f.archived && f.key).map((f) => [f.key, f]))
  const archivedKeys = new Set(next.fields.filter((f) => f.archived && f.key).map((f) => f.key))
  const add = (f: Field, msg: string) => errs.push({ field_id: f.id, message: `Поле «${labelOr(f)}»: ${msg}` })
  for (const f of next.fields) {
    if (f.archived) continue
    if (f.type === 'formula') {
      const c = (f.config ?? {}) as Partial<FormulaConfig>
      if (!c.expr) {
        add(f, 'формула не задана')
        continue
      }
      if (!FORMULA_RESULTS.includes(c.result as FormulaResult)) add(f, 'результат формулы: число, деньги, текст или дата')
      let refs
      try {
        refs = formulaRefs(parseFormula(c.expr))
      } catch (e) {
        add(f, `формула: ${e instanceof FormulaParseError ? e.message : String(e)}`)
        continue
      }
      for (const r of refs) {
        const src = byKey.get(r.key)
        if (!src) {
          add(f, archivedKeys.has(r.key) ? `в формуле поле «${r.key}» в архиве` : `в формуле нет поля с ключом «${r.key}»`)
        } else if (r.col && src.type !== 'table') {
          add(f, `в формуле поле «${r.key}» — не таблица`)
        } else if (r.col) {
          const cols = (src.config as TableConfig | undefined)?.columns ?? []
          if (!cols.some((col) => col.key === r.col)) add(f, `в формуле в таблице «${r.key}» нет колонки «${r.col}»`)
        } else if (isComputedField(src) || FORMULA_REF_EXCLUDED.has(src.type) || src.type === 'table') {
          add(
            f,
            `поле «${labelOr(src)}» в формуле недоступно — оно не хранит значение в записи или это таблица (используйте {${r.key}.колонка} внутри SUM, COUNT, MIN, MAX)`,
          )
        }
      }
    } else if (f.type === 'lookup') {
      const c = (f.config ?? {}) as Partial<LookupConfig>
      const src = c.source_field ? byId.get(c.source_field) : undefined
      if (!src || src.type !== 'record_ref' || src.archived) {
        add(f, 'подстановка: выберите поле «Форма», из записи которого берётся значение')
        continue
      }
      if ((src.config as RecordRefConfig | undefined)?.multiple)
        add(f, `подстановка работает только с одной записью — поле «${labelOr(src)}» выбирает несколько`)
      if (!c.target_field) add(f, 'подстановка: выберите поле формы-источника')
      if (c.target_type === 'lookup') add(f, 'подстановка из подстановки не считается — выберите обычное поле формы-источника')
    }
  }
  const { cycle } = formulaOrder(next)
  if (cycle.length > 0) {
    const names = cycle.map((k) => `«${labelOr(byKey.get(k)!)}»`)
    const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} и ${names[names.length - 1]}` : names[0]
    errs.push({ field_id: byKey.get(cycle[0]!)!.id, message: `Формулы ${list} ссылаются друг на друга — так не посчитать` })
  }
  const tf = byId.get(next.title_field)
  if (tf && tf.type === 'lookup')
    errs.push({ field_id: tf.id, message: 'Название записи не может быть подстановкой — её значение не хранится в записи' })
  return errs
}
