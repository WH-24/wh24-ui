/**
 * Правила формы «Если …, то …» — порт wh24-forms-api/internal/conditions/rules.go
 * (фикстуры `fixtures/rules/*.json` — те же файлы).
 *
 * when выполнено, а then нет — запись не сохраняется. При fill сравнения «=»
 * верхнего уровня then подставляются в поля: сервер и applyFills — только в
 * пустые, форма при вводе (applyFillsOnChange) — и поверх прежнего значения,
 * когда правило только что включилось («сменили ответственного на Т —
 * наблюдатель стал А»).
 */
import type { ConditionGroup, Field, FormRule } from '../types.js'
import { conditionLeaves, isNestedGroup } from '../types.js'
import { evaluate, isEmptyValue, type Env, type Values } from './conditions.js'
import { visibility } from './visibility.js'

/** Нарушенное правило; field — первое поле следствия (его подсвечивает форма). */
export interface RuleViolation {
  ruleId: string
  name: string
  field?: string
}

type VisibleIf = Record<string, ConditionGroup | null | undefined>

/** Условия показа полей: id → visible_if. */
export function visibleIfMap(fields: readonly Pick<Field, 'id' | 'visible_if'>[]): VisibleIf {
  const out: VisibleIf = {}
  for (const f of fields) out[f.id] = f.visible_if
  return out
}

/** Что подставляет правило: «поле = значение» из eq верхнего уровня then.all. */
export function fillTargets(r: FormRule): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (!r.fill || !r.then) return out
  for (const c of r.then.all ?? []) {
    if (!isNestedGroup(c) && c.op === 'eq' && c.field && c.value != null) out[c.field] = c.value
  }
  return out
}

function maskHidden(values: Values, vis: Record<string, boolean>): Values {
  let masked = values
  for (const [id, v] of Object.entries(vis)) {
    if (v || !Object.prototype.hasOwnProperty.call(values, id)) continue
    if (masked === values) masked = { ...values }
    delete masked[id]
  }
  return masked
}

function holds(g: ConditionGroup | undefined, values: Values, env: Env): boolean | null {
  try {
    return evaluate(g, values, env)
  } catch {
    return null
  }
}

function hasLeaves(g: ConditionGroup | undefined): boolean {
  return conditionLeaves(g).length > 0
}

/** Правило включено: «если» задано и выполнено при values (скрытые поля — пустые). */
function active(r: FormRule, masked: Values, env: Env): boolean {
  return hasLeaves(r.when) && holds(r.when, masked, env) === true
}

/**
 * Подставляет значения правил с fill в ПУСТЫЕ видимые поля (как сервер до
 * проверки). Подстановка может включить следующее правило, поэтому проходов
 * несколько. values не меняются.
 */
export function applyFills(
  rules: readonly FormRule[] | undefined,
  visibleIf: VisibleIf,
  values: Values,
  env: Env = {},
): { values: Values; filled: string[] } {
  return fill(rules ?? [], visibleIf, values, env, () => false)
}

/**
 * Подстановка при вводе в форме: правило, которое при prev не действовало, а
 * при next действует, ставит свои значения и поверх выбранного раньше — так
 * «если Т, то наблюдатель А» срабатывает в момент выбора Т. Остальные правила
 * заполняют только пустые поля.
 */
export function applyFillsOnChange(
  rules: readonly FormRule[] | undefined,
  visibleIf: VisibleIf,
  prev: Values,
  next: Values,
  env: Env = {},
): { values: Values; filled: string[] } {
  const list = rules ?? []
  if (list.length === 0) return { values: next, filled: [] }
  const wasActive = new Set(
    list
      .filter((r) => active(r, maskHidden(prev, visibility(visibleIf, prev, env)), env))
      .map((r) => r.id),
  )
  return fill(list, visibleIf, next, env, (r) => !wasActive.has(r.id))
}

function fill(
  rules: readonly FormRule[],
  visibleIf: VisibleIf,
  values: Values,
  env: Env,
  overwrite: (r: FormRule) => boolean,
): { values: Values; filled: string[] } {
  let cur = values
  const filled: string[] = []
  const done = new Set<string>()
  for (let pass = 0; pass <= rules.length; pass++) {
    const vis = visibility(visibleIf, cur, env)
    const masked = maskHidden(cur, vis)
    let changed = false
    for (const r of rules) {
      const targets = fillTargets(r)
      if (Object.keys(targets).length === 0 || !active(r, masked, env)) continue
      const force = overwrite(r) && !done.has(r.id)
      done.add(r.id)
      for (const [id, v] of Object.entries(targets)) {
        if (isEmptyValue(v) || vis[id] === false) continue
        const same = JSON.stringify(cur[id]) === JSON.stringify(v)
        if (same || (!isEmptyValue(cur[id]) && !force)) continue
        if (cur === values) cur = { ...values }
        cur[id] = v
        filled.push(id)
        changed = true
      }
    }
    if (!changed) break
  }
  return { values: cur, filled }
}

/**
 * Нарушенные правила при values. Правило без «если» или «то» ни к чему не
 * обязывает; невычислимое условие не нарушает; следствие со скрытым полем не
 * проверяется.
 */
export function checkRules(
  rules: readonly FormRule[] | undefined,
  visibleIf: VisibleIf,
  values: Values,
  env: Env = {},
): RuleViolation[] {
  const vis = visibility(visibleIf, values, env)
  const masked = maskHidden(values, vis)
  const out: RuleViolation[] = []
  for (const r of rules ?? []) {
    if (!hasLeaves(r.then) || !active(r, masked, env)) continue
    const refs = conditionLeaves(r.then).map((c) => c.field)
    if (refs.some((id) => vis[id] === false)) continue
    if (holds(r.then, masked, env) !== false) continue
    out.push({ ruleId: r.id, name: r.name, field: refs[0] })
  }
  return out
}

/** Сообщение об ошибке правила — как у сервера (validate.Record). */
export function ruleViolationMessage(v: RuleViolation, fields: readonly Field[]): string {
  const name = v.name.trim()
  let msg = name ? `не выполнено правило «${name}»` : 'не выполнено правило формы'
  const f = fields.find((x) => x.id === v.field)
  if (f) msg += `: проверьте поле «${f.label || f.key}»`
  return msg
}
