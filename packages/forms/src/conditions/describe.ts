/**
 * Условие показа одной строкой по-русски: «Тип = Договор и Сумма > 100 000».
 * Одна функция для сводки в настройках поля, плитки на канвасе редактора и
 * итога в окне условий — чтобы правило везде читалось одинаково.
 */
import type { Condition, ConditionGroup, ConditionItem, Field } from '../types.js'
import { isNestedGroup } from '../types.js'
import { formatDate, formatDateTime, formatNumber, optionLabel, type FormatContext } from '../render/format.js'
import { opLabel, opTakesValue } from './ops.js'

/** Подпись поля-источника; удалённое — «поле удалено». */
function fieldName(f: Field | undefined): string {
  return f ? f.label || f.key : 'поле удалено'
}

const SYMBOL: Partial<Record<Condition['op'], string>> = {
  eq: '=',
  ne: '≠',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
}

/** {days: N} → число N, иначе null. */
function relativeDays(v: unknown): number | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const n = (v as { days?: unknown }).days
  return typeof n === 'number' ? n : null
}

function relativeText(n: number): string {
  if (n === 0) return 'сегодня'
  return n > 0 ? `сегодня + ${n} дн.` : `сегодня − ${-n} дн.`
}

function valueText(f: Field | undefined, v: unknown, ctx: FormatContext): string {
  if (v == null || v === '') return '…'
  const rel = relativeDays(v)
  if (rel !== null) return relativeText(rel)
  if (Array.isArray(v)) return v.length ? v.map((x) => valueText(f, x, ctx)).join(', ') : '…'
  if (!f) return String(v)
  switch (f.type) {
    case 'number':
    case 'money':
      return typeof v === 'number' ? formatNumber(v) : String(v)
    case 'date':
      return formatDate(String(v))
    case 'datetime':
      return /T/.test(String(v)) ? formatDateTime(String(v)) : formatDate(String(v))
    case 'select':
    case 'multiselect':
    case 'catalog':
    case 'user':
    case 'department':
      return optionLabel(f, String(v), ctx)
    default:
      return `«${String(v)}»`
  }
}

function dated(type: Field['type'] | undefined): boolean {
  return type === 'date' || type === 'datetime'
}

/** Одно условие: «Сумма > 100 000», «Срочно: отмечено», «Тип — одно из: А, Б». */
export function describeCondition(
  c: Condition,
  source: Field | undefined,
  ctx: FormatContext = {},
): string {
  const name = fieldName(source)
  const type = source?.type
  if (type === 'checkbox' && (c.op === 'eq' || c.op === 'ne')) {
    const on = (c.value !== false) === (c.op === 'eq')
    return `${name}: ${on ? 'отмечено' : 'не отмечено'}`
  }
  if (!opTakesValue(c.op)) return `${name} ${opLabel(type, c.op)}`
  const value = valueText(source, c.value, ctx)
  if (c.op === 'between') {
    const [from, to] = Array.isArray(c.value) ? c.value : []
    const a = relativeDays(from)
    const b = relativeDays(to)
    if (dated(type) && a !== null && b === 0 && a < 0) return `${name} за последние ${-a} дн.`
    if (dated(type) && a === 0 && b !== null && b > 0) return `${name} в ближайшие ${b} дн.`
    return `${name} между ${valueText(source, from, ctx)} и ${valueText(source, to, ctx)}`
  }
  if (c.op === 'in' || c.op === 'not_in') {
    return type === 'multiselect'
      ? `${name} ${opLabel(type, c.op)}: ${value}`
      : `${name} — ${opLabel(type, c.op)}: ${value}`
  }
  const sym = SYMBOL[c.op]
  if (sym && !(dated(type) && c.op !== 'eq' && c.op !== 'ne')) return `${name} ${sym} ${value}`
  return `${name} ${opLabel(type, c.op)} ${value}`
}

/**
 * Вся группа: условия через «и» (all) / «или» (any). Если заданы оба списка —
 * «все из all и хотя бы одно из any», any — в скобках. Пустая группа — ''.
 */
export function describeGroup(
  group: ConditionGroup | null | undefined,
  fields: readonly Field[],
  ctx: FormatContext = {},
): string {
  if (!group) return ''
  const byId = new Map(fields.map((f) => [f.id, f]))
  const one = (c: ConditionItem): string => {
    if (!isNestedGroup(c)) return describeCondition(c, byId.get(c.field), ctx)
    const inner = describeGroup(c, fields, ctx)
    const count = (c.all?.length ?? 0) + (c.any?.length ?? 0)
    return count > 1 ? `(${inner})` : inner
  }
  const all = (group.all ?? []).map(one)
  const any = (group.any ?? []).map(one)
  if (any.length === 0) return all.join(' и ')
  const anyText = any.join(' или ')
  if (all.length === 0) return anyText
  return [...all, any.length > 1 ? `(${anyText})` : anyText].join(' и ')
}
