/**
 * Симуляция правил формы (владелец 02.11.2026: «сам создай цепочки логически
 * для тестирования и симуляции»): по каждому правилу — набор сценариев с
 * подобранными значениями и ожидаемым исходом, прогон сценария тем же
 * вычислителем, что у формы и сервера, и состояние всех правил при данных
 * значениях (панель «Проверка» в превью редактора).
 *
 * Значения подбираются из самих условий: «Ответственный = Т» → Т, «не
 * равно Т» → другой вариант списка (или из sample хоста — сотрудники,
 * отделы), «больше 10» → 11, «за последние 7 дней» → сегодня − 7. Сценарий,
 * для которого значения подобрать не вышло (поле условия скрыто другим
 * правилом, два правила противоречат друг другу), не падает, а сообщает
 * почему — это и есть находка симуляции.
 */
import type { Condition, ConditionGroup, Field, SchemaDocument, SelectConfig } from '../types.js'
import { conditionLeaves, isComputedField, isPresentation } from '../types.js'
import { evaluate, resolveValue, todayMsk, type Env, type Values } from './conditions.js'
import { applyFills, checkRules, fillTargets, visibleIfMap } from './rules.js'
import { fieldRequirement, visibility } from './visibility.js'

/** Чьё правило: правило формы, условие показа или обязательности поля. */
export type RuleKind = 'rule' | 'visible' | 'required'

export interface RuleRef {
  kind: RuleKind
  /** id правила формы или id поля (для показа и обязательности). */
  id: string
  name: string
}

export interface RuleScenario {
  id: string
  rule: RuleRef
  title: string
  /** Значения записи; undefined — поле пустое. */
  values: Values
  /** Что должно выполняться при этих значениях, иначе сценарий не про то. */
  setup: { group: ConditionGroup; want: boolean; label: string }[]
  expect: {
    violated?: boolean
    visible?: boolean
    required?: boolean
    filled?: Record<string, unknown>
    /** Правила, которые при этих значениях не должны быть нарушены (пара правил). */
    together?: RuleRef[]
  }
}

export interface ScenarioResult {
  scenario: RuleScenario
  /** Значения после подстановки правил. */
  values: Values
  ok: boolean
  /** Чем исход разошёлся с ожидаемым. */
  problems: string[]
  /** Побочное: другие нарушенные правила (противоречия). */
  notes: string[]
}

/** Варианты значения поля для подбора (сотрудники, отделы, справочники). */
export type SampleValues = (field: Field) => unknown[]

export interface SimulateOptions {
  env?: Env
  sample?: SampleValues
}

type Patch = Record<string, unknown>
const UNSET = undefined

const DAY_MS = 86_400_000

function shiftDate(v: unknown, days: number): string | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(v)) return null
  const t = Date.parse(`${v.slice(0, 10)}T00:00:00Z`)
  return new Date(t + days * DAY_MS).toISOString().slice(0, 10)
}

function dated(f: Field | undefined): boolean {
  return f?.type === 'date' || f?.type === 'datetime'
}

/** Значение даты в формате поля: у даты-времени — полдень по Москве. */
function asFieldDate(f: Field | undefined, day: string): string {
  return f?.type === 'datetime' ? `${day}T12:00:00+03:00` : day
}

function same(a: unknown, b: unknown): boolean {
  const norm = (x: unknown) => (typeof x === 'string' ? x.trim().toLowerCase() : JSON.stringify(x))
  return norm(a) === norm(b)
}

function candidates(f: Field | undefined, opts: SimulateOptions): unknown[] {
  if (!f) return []
  if (f.type === 'select' || f.type === 'multiselect') {
    const own = ((f.config as SelectConfig | undefined)?.options ?? []).map((o) => o.value)
    if (own.length) return own
  }
  return opts.sample?.(f) ?? []
}

/** Какое-нибудь непустое значение поля. */
function sampleValue(f: Field | undefined, opts: SimulateOptions, env: Env): unknown {
  const c = candidates(f, opts)
  switch (f?.type) {
    case 'checkbox':
      return true
    case 'number':
    case 'money':
      return 1
    case 'date':
    case 'datetime':
      return asFieldDate(f, env.today ?? todayMsk())
    case 'multiselect':
      return c.length ? [c[0]] : ['вариант']
    case 'select':
    case 'catalog':
    case 'user':
    case 'department':
      return c.length ? c[0] : 'вариант'
    case 'file':
    case 'record_ref':
    case 'contact':
      return ['пример']
    case 'table':
      return [{}]
    default:
      return 'пример'
  }
}

/** Значение, не совпадающее ни с одним из avoid. */
function otherValue(f: Field | undefined, avoid: unknown[], opts: SimulateOptions, env: Env): unknown {
  if (f?.type === 'checkbox') return !avoid.includes(true)
  if (f?.type === 'number' || f?.type === 'money') {
    const nums = avoid.map(Number).filter((n) => Number.isFinite(n))
    return (nums.length ? Math.max(...nums) : 0) + 1
  }
  if (dated(f)) {
    const days = avoid.map((x) => shiftDate(x, 0)).filter((x): x is string => Boolean(x)).sort()
    return asFieldDate(f, shiftDate(days.at(-1) ?? env.today ?? todayMsk(), 1)!)
  }
  const pick = candidates(f, opts).find((c) => !avoid.some((a) => same(a, c)))
  const v = pick ?? (avoid.some((a) => same(a, 'другое значение')) ? 'ещё одно значение' : 'другое значение')
  return f?.type === 'multiselect' ? [v] : v
}

function numOrDate(f: Field | undefined, v: unknown, delta: number): unknown {
  if (dated(f)) {
    const d = shiftDate(v, delta)
    return d ? asFieldDate(f, d) : v
  }
  const n = Number(v)
  return Number.isFinite(n) ? n + delta : v
}

function list(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [v]
}

/** Значение поля, при котором сравнение выполнено (want) или нет. */
function leafValue(c: Condition, f: Field | undefined, want: boolean, opts: SimulateOptions, env: Env): unknown {
  const v = resolveValue(c.value, env)
  const multi = f?.type === 'multiselect'
  const dateOf = (x: unknown) => (dated(f) && typeof x === 'string' ? asFieldDate(f, x.slice(0, 10)) : x)
  switch (c.op) {
    case 'eq':
      return want ? dateOf(v) : otherValue(f, [v], opts, env)
    case 'ne':
      return want ? otherValue(f, [v], opts, env) : dateOf(v)
    case 'in':
      return want ? (multi ? [list(v)[0]] : list(v)[0]) : otherValue(f, list(v), opts, env)
    case 'not_in':
      return want ? otherValue(f, list(v), opts, env) : multi ? [list(v)[0]] : list(v)[0]
    case 'empty':
      return want ? UNSET : sampleValue(f, opts, env)
    case 'not_empty':
      return want ? sampleValue(f, opts, env) : UNSET
    case 'gt':
      return numOrDate(f, v, want ? 1 : 0)
    case 'gte':
      return numOrDate(f, v, want ? 0 : -1)
    case 'lt':
      return numOrDate(f, v, want ? -1 : 0)
    case 'lte':
      return numOrDate(f, v, want ? 0 : 1)
    case 'between': {
      const [lo, hi] = list(v)
      return want ? numOrDate(f, lo, 0) : numOrDate(f, hi, 1)
    }
    case 'contains':
      if (multi) return want ? [v] : otherValue(f, [v], opts, env)
      return want ? String(v) : 'другое значение'
    case 'not_contains':
      if (multi) return want ? otherValue(f, [v], opts, env) : [v]
      return want ? (same(v, 'пример') ? 'другое значение' : 'пример') : String(v)
  }
}

/** Значения, при которых группа выполнена (want) или нет. */
function groupPatch(
  g: ConditionGroup | Condition | undefined,
  want: boolean,
  byId: Map<string, Field>,
  opts: SimulateOptions,
  env: Env,
): Patch {
  const out: Patch = {}
  if (!g) return out
  if ('field' in g && g.field !== undefined) {
    out[g.field] = leafValue(g, byId.get(g.field), want, opts, env)
    return out
  }
  const grp = g as ConditionGroup
  const all = grp.all ?? []
  const any = grp.any ?? []
  if (want) {
    for (const c of all) Object.assign(out, groupPatch(c, true, byId, opts, env))
    if (any[0]) Object.assign(out, groupPatch(any[0], true, byId, opts, env))
  } else if (all[0]) {
    Object.assign(out, groupPatch(all[0], false, byId, opts, env))
  } else {
    for (const c of any) Object.assign(out, groupPatch(c, false, byId, opts, env))
  }
  return out
}

function nameOf(f: Field): string {
  return f.label || f.key
}

function hasLeaves(g: ConditionGroup | undefined): g is ConditionGroup {
  return conditionLeaves(g).length > 0
}

/** Все правила формы, по которым есть что проверять. */
export function allRules(doc: SchemaDocument): RuleRef[] {
  const out: RuleRef[] = []
  for (const r of doc.rules ?? []) {
    if (hasLeaves(r.when) && hasLeaves(r.then)) out.push({ kind: 'rule', id: r.id, name: r.name })
  }
  for (const f of doc.fields) {
    if (f.archived) continue
    if (hasLeaves(f.visible_if)) {
      out.push({ kind: 'visible', id: f.id, name: f.visible_if.name || `Показ поля «${nameOf(f)}»` })
    }
    if (hasLeaves(f.required_if)) {
      out.push({
        kind: 'required',
        id: f.id,
        name: f.required_if.name || `Обязательность поля «${nameOf(f)}»`,
      })
    }
  }
  return out
}

/**
 * Сценарии проверки правил: у правила «если …, то …» — сработало и значение
 * подставилось, сработало и выбрано другое, сработало и значение верное, не
 * сработало; у условия показа и обязательности — выполнено и нет.
 */
export function ruleScenarios(doc: SchemaDocument, opts: SimulateOptions = {}): RuleScenario[] {
  const env = opts.env ?? {}
  const byId = new Map(doc.fields.map((f) => [f.id, f]))
  const patch = (g: ConditionGroup | undefined, want: boolean) => groupPatch(g, want, byId, opts, env)
  const out: RuleScenario[] = []

  for (const r of doc.rules ?? []) {
    if (!hasLeaves(r.when) || !hasLeaves(r.then)) continue
    const rule: RuleRef = { kind: 'rule', id: r.id, name: r.name }
    const when = { group: r.when, want: true, label: '«Если» выполнено' }
    const targets = fillTargets(r)
    if (Object.keys(targets).length > 0) {
      const values = patch(r.when, true)
      for (const id of Object.keys(targets)) values[id] = UNSET
      out.push({
        id: `${r.id}:fill`,
        rule,
        title: 'Условие выполнено, поле пустое — значение подставится',
        values,
        setup: [when],
        expect: { violated: false, filled: targets },
      })
    }
    out.push({
      id: `${r.id}:wrong`,
      rule,
      title: 'Условие выполнено, значение другое — запись не сохранится',
      values: { ...patch(r.then, false), ...patch(r.when, true) },
      setup: [when, { group: r.then, want: false, label: '«То» не выполнено' }],
      expect: { violated: true },
    })
    out.push({
      id: `${r.id}:right`,
      rule,
      title: 'Условие выполнено, значение верное — запись сохранится',
      values: { ...patch(r.then, true), ...patch(r.when, true) },
      setup: [when, { group: r.then, want: true, label: '«То» выполнено' }],
      expect: { violated: false },
    })
    out.push({
      id: `${r.id}:off`,
      rule,
      title: 'Условие не выполнено — правило не действует',
      values: { ...patch(r.then, false), ...patch(r.when, false) },
      setup: [{ group: r.when, want: false, label: '«Если» не выполнено' }],
      expect: { violated: false },
    })
  }

  // Пары правил с общим полем в «То»: оба «Если» выполнены — оба «То»
  // должны выполняться разом, иначе правила противоречат друг другу («Т →
  // наблюдатель А» и «Москва → наблюдатель Б» при лиде Т из Москвы). Пары,
  // чьи «Если» вместе не выполнить, пропускаются.
  const rules = (doc.rules ?? []).filter((r) => hasLeaves(r.when) && hasLeaves(r.then))
  const vif = visibleIfMap(doc.fields)
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const a = rules[i]!
      const b = rules[j]!
      const aThen = new Set(conditionLeaves(a.then).map((c) => c.field))
      if (!conditionLeaves(b.then).some((c) => aThen.has(c.field))) continue
      const values = { ...patch(a.when, true), ...patch(b.when, true) }
      const filledValues = applyFills(doc.rules, vif, clean(values), env).values
      const seen = masked(filledValues, visibility(vif, filledValues, env))
      if (holds(a.when!, seen, env) !== true || holds(b.when!, seen, env) !== true) continue
      out.push({
        id: `${a.id}+${b.id}`,
        rule: { kind: 'rule', id: a.id, name: `${a.name} + ${b.name}` },
        title: 'Выполнены условия обоих правил — оба должны выполняться',
        values,
        setup: [],
        expect: {
          together: [
            { kind: 'rule', id: a.id, name: a.name },
            { kind: 'rule', id: b.id, name: b.name },
          ],
        },
      })
    }
  }

  for (const f of doc.fields) {
    if (f.archived) continue
    if (hasLeaves(f.visible_if)) {
      const rule: RuleRef = { kind: 'visible', id: f.id, name: f.visible_if.name || `Показ поля «${nameOf(f)}»` }
      out.push({
        id: `${f.id}:shown`,
        rule,
        title: 'Условие выполнено — поле видно',
        values: patch(f.visible_if, true),
        setup: [{ group: f.visible_if, want: true, label: 'Условие показа выполнено' }],
        expect: { visible: true },
      })
      out.push({
        id: `${f.id}:hidden`,
        rule,
        title: 'Условие не выполнено — поле скрыто',
        values: patch(f.visible_if, false),
        setup: [{ group: f.visible_if, want: false, label: 'Условие показа не выполнено' }],
        expect: { visible: false },
      })
    }
    if (hasLeaves(f.required_if)) {
      const rule: RuleRef = {
        kind: 'required',
        id: f.id,
        name: f.required_if.name || `Обязательность поля «${nameOf(f)}»`,
      }
      const shown = hasLeaves(f.visible_if) ? patch(f.visible_if, true) : {}
      out.push({
        id: `${f.id}:required`,
        rule,
        title: 'Условие выполнено — поле обязательно',
        values: { ...shown, ...patch(f.required_if, true), [f.id]: UNSET },
        setup: [{ group: f.required_if, want: true, label: 'Условие обязательности выполнено' }],
        expect: { visible: true, required: true },
      })
      out.push({
        id: `${f.id}:optional`,
        rule,
        title: 'Условие не выполнено — поле необязательно',
        values: { ...shown, ...patch(f.required_if, false), [f.id]: UNSET },
        setup: [{ group: f.required_if, want: false, label: 'Условие обязательности не выполнено' }],
        expect: { required: false },
      })
    }
  }
  return out
}

function clean(values: Values): Values {
  const out: Values = {}
  for (const [k, v] of Object.entries(values)) if (v !== undefined) out[k] = v
  return out
}

function masked(values: Values, vis: Record<string, boolean>): Values {
  const out = { ...values }
  for (const [id, v] of Object.entries(vis)) if (!v) delete out[id]
  return out
}

function holds(g: ConditionGroup, values: Values, env: Env): boolean | null {
  try {
    return evaluate(g, values, env)
  } catch {
    return null
  }
}

/**
 * Прогон сценария: подстановка правил (как у сервера — в пустые поля),
 * затем видимость, обязательность и нарушенные правила — и сверка с
 * ожиданием.
 */
export function runScenario(doc: SchemaDocument, s: RuleScenario, env: Env = {}): ScenarioResult {
  const vif = visibleIfMap(doc.fields)
  const { values } = applyFills(doc.rules, vif, clean(s.values), env)
  const vis = visibility(vif, values, env)
  const seen = masked(values, vis)
  const byId = new Map(doc.fields.map((f) => [f.id, f]))
  const label = (id: string) => {
    const f = byId.get(id)
    return f ? `«${nameOf(f)}»` : id
  }
  const problems: string[] = []

  for (const pre of s.setup) {
    if (holds(pre.group, seen, env) === pre.want) continue
    const hidden = conditionLeaves(pre.group)
      .map((c) => c.field)
      .filter((id) => vis[id] === false)
    problems.push(
      hidden.length
        ? `Не удалось подобрать значения (${pre.label}): поле ${hidden.map(label).join(', ')} скрыто условием показа`
        : `Не удалось подобрать значения (${pre.label}): условия противоречат друг другу`,
    )
  }

  const violations = checkRules(doc.rules, vif, values, env)
  const violated = violations.some((v) => v.ruleId === s.rule.id)
  const broken = (s.expect.together ?? []).filter((r) => violations.some((v) => v.ruleId === r.id))
  if (broken.length > 0) {
    problems.push(
      `Правила противоречат друг другу: при этих значениях не выполнить ${broken
        .map((r) => `«${r.name || 'без названия'}»`)
        .join(' и ')} — поправьте условия или значения`,
    )
  }
  const own = new Set([s.rule.id, ...(s.expect.together ?? []).map((r) => r.id)])
  const e = s.expect
  if (e.violated !== undefined && e.violated !== violated) {
    problems.push(e.violated ? 'Запись прошла бы, хотя правило не выполнено' : 'Запись не сохранилась бы — правило сочло значение неверным')
  }
  for (const [id, want] of Object.entries(e.filled ?? {})) {
    if (!same(values[id], want)) {
      problems.push(
        vis[id] === false
          ? `Значение не подставилось: поле ${label(id)} скрыто условием показа`
          : `Значение не подставилось в поле ${label(id)}`,
      )
    }
  }
  if (e.visible !== undefined && (vis[s.rule.id] !== false) !== e.visible) {
    problems.push(e.visible ? `Поле ${label(s.rule.id)} осталось скрытым` : `Поле ${label(s.rule.id)} осталось видимым`)
  }
  if (e.required !== undefined) {
    const req = Boolean(fieldRequirement(doc.fields, values, env)[s.rule.id])
    if (req !== e.required) {
      problems.push(e.required ? `Поле ${label(s.rule.id)} не стало обязательным` : `Поле ${label(s.rule.id)} осталось обязательным`)
    }
  }

  // Соседнее правило цепочки при подобранных значениях не выполнено — не
  // ошибка этого сценария, но видно, что сработает дальше.
  const notes = violations
    .filter((v) => !own.has(v.ruleId))
    .map((v) => `Дальше по цепочке: не выполнено правило «${v.name || 'без названия'}»`)
  return { scenario: s, values, ok: problems.length === 0, problems, notes }
}

/** Состояние правила при значениях записи — для живой проверки в превью. */
export type RuleState = 'off' | 'ok' | 'violated' | 'skipped' | 'shown' | 'hidden' | 'required' | 'optional'

export interface RuleStatus {
  rule: RuleRef
  state: RuleState
}

/** Как сейчас действует каждое правило формы при values. */
export function ruleStatuses(doc: SchemaDocument, values: Values, env: Env = {}): RuleStatus[] {
  const vif = visibleIfMap(doc.fields)
  const vis = visibility(vif, values, env)
  const seen = masked(values, vis)
  const violated = new Set(checkRules(doc.rules, vif, values, env).map((v) => v.ruleId))
  const req = fieldRequirement(doc.fields, values, env)
  return allRules(doc).map((rule) => {
    if (rule.kind === 'visible') return { rule, state: vis[rule.id] === false ? 'hidden' : 'shown' }
    if (rule.kind === 'required') return { rule, state: req[rule.id] ? 'required' : 'optional' }
    const r = (doc.rules ?? []).find((x) => x.id === rule.id)!
    if (violated.has(r.id)) return { rule, state: 'violated' }
    if (holds(r.when!, seen, env) !== true) return { rule, state: 'off' }
    const hidden = conditionLeaves(r.then).some((c) => vis[c.field] === false)
    return { rule, state: hidden ? 'skipped' : 'ok' }
  })
}

/** Поля, которые участвуют в правилах: их и стоит показывать в сценарии. */
export function scenarioFields(doc: SchemaDocument, s: RuleScenario): Field[] {
  const ids = new Set(Object.keys(s.values))
  return doc.fields.filter((f) => ids.has(f.id) && !isPresentation(f.type) && !isComputedField(f))
}
