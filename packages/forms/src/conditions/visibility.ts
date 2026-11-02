/**
 * Видимость полей с учётом цепочек условий — порт
 * wh24-forms-api/internal/conditions/visibility.go (фикстуры
 * `fixtures/visibility/*.json` — те же файлы).
 */
import type { ConditionGroup, Field } from '../types.js'
import { evaluate, type Values } from './conditions.js'

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
    for (const ref of [...(g.all ?? []), ...(g.any ?? [])].map((c) => c.field)) {
      if (!has(values, ref) || visible(ref)) continue
      if (masked === values) masked = { ...values }
      delete masked[ref]
    }
    let ok: boolean
    try {
      ok = evaluate(g, masked)
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
): Record<string, boolean> {
  const rules: Record<string, ConditionGroup | undefined> = {}
  for (const f of fields) rules[f.id] = f.visible_if
  return visibility(rules, values)
}
