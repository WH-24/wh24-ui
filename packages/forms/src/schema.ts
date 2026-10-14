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
import type { ConditionGroup, Field, SchemaDocument, SchemaValidationError, TableColumn, TableConfig } from './types.js'
import { FIELD_SPANS, FIELD_TYPES, MAX_VISIBILITY_CHAIN_DEPTH, TABLE_COLUMN_TYPES, TITLE_CAPABLE_TYPES } from './types.js'

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
  return null
}

/** Все поля, на которые ссылается группа (all и any). */
export function conditionFieldRefs(g: ConditionGroup | null | undefined): string[] {
  if (!g) return []
  const refs: string[] = []
  for (const c of g.all ?? []) if (c.field) refs.push(c.field)
  for (const c of g.any ?? []) if (c.field) refs.push(c.field)
  return refs
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

  // --- Название записи ---
  if (!next.title_field) {
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
