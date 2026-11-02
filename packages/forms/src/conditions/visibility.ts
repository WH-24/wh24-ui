/**
 * Видимость полей с учётом цепочек условий — порт
 * wh24-forms-api/internal/conditions/visibility.go (фикстуры
 * `fixtures/visibility/*.json` — те же файлы).
 */
import type { ConditionGroup, Field } from '../types.js'
import { conditionLeaves } from '../types.js'
import { evaluate, type Env, type Values } from './conditions.js'

/**
 * Видимость каждого поля из rules (id поля → visible_if; нет условия — видно
 * всегда) при значениях записи.
 *
 * Поле, скрытое своим условием, для зависящих от него полей считается ПУСТЫМ,
 * даже если значение в записи осталось: иначе «A, если B = X» при скрытом B
 * показывало бы A по старому, невидимому пользователю значению. Сами values не
 * меняются. Невычислимое условие — поле видно; цикл не зацикливает (повторный
 * вход — видно).
 */
export function visibility(
  rules: Record<string, ConditionGroup | null | undefined>,
  values: Values,
  env: Env = {},
): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  const busy = new Set<string>()
  const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)

  const visible = (id: string): boolean => {
    if (has(out, id)) return out[id]!
    const g = rules[id]
    if (!g || busy.has(id)) return true
    busy.add(id)
    let masked: Values = values
    for (const ref of conditionLeaves(g).map((c) => c.field)) {
      if (!has(values, ref) || visible(ref)) continue
      if (masked === values) masked = { ...values }
      delete masked[ref]
    }
    let ok: boolean
    try {
      ok = evaluate(g, masked, env)
    } catch {
      ok = true
    }
    busy.delete(id)
    out[id] = ok
    return ok
  }

  for (const id of Object.keys(rules)) out[id] = visible(id)
  return out
}

/** Видимость полей документа: id поля → видно ли оно при значениях записи. */
export function fieldVisibility(
  fields: readonly Pick<Field, 'id' | 'visible_if'>[],
  values: Values,
  env: Env = {},
): Record<string, boolean> {
  const rules: Record<string, ConditionGroup | undefined> = {}
  for (const f of fields) rules[f.id] = f.visible_if
  return visibility(rules, values, env)
}

/**
 * Обязательные сейчас поля: required, или required_if выполнено — и поле
 * видно. Условие видит скрытые поля пустыми (как зависимые поля). Невычислимое
 * условие поле обязательным не делает. Порт validate.Record из forms-api.
 */
export function fieldRequirement(
  fields: readonly Pick<Field, 'id' | 'visible_if' | 'required' | 'required_if'>[],
  values: Values,
  env: Env = {},
): Record<string, boolean> {
  const vis = fieldVisibility(fields, values, env)
  let seen: Values = values
  for (const id of Object.keys(vis)) {
    if (vis[id] || !Object.prototype.hasOwnProperty.call(values, id)) continue
    if (seen === values) seen = { ...values }
    delete seen[id]
  }
  const out: Record<string, boolean> = {}
  for (const f of fields) {
    let byCondition = false
    if (f.required_if) {
      try {
        byCondition = evaluate(f.required_if, seen, env)
      } catch {
        byCondition = false
      }
    }
    out[f.id] = vis[f.id] !== false && (f.required || byCondition)
  }
  return out
}
