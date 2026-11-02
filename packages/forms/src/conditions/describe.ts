/**
 * Условие показа одной строкой по-русски: «Тип = Договор и Сумма > 100 000».
 * Одна функция для сводки в настройках поля, плитки на канвасе редактора и
 * итога в окне условий — чтобы правило везде читалось одинаково.
 */
import type { Condition, ConditionGroup, Field } from '../types.js'
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

function valueText(f: Field | undefined, v: unknown, ctx: FormatContext): string {
  if (v == null || v === '') return '…'
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
  if (c.op === 'in' || c.op === 'not_in') {
    return type === 'multiselect'
      ? `${name} ${opLabel(type, c.op)}: ${value}`
      : `${name} — ${opLabel(type, c.op)}: ${value}`
  }
  const dated = type === 'date' || type === 'datetime'
  const sym = SYMBOL[c.op]
  if (sym && !(dated && c.op !== 'eq' && c.op !== 'ne')) return `${name} ${sym} ${value}`
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
  const one = (c: Condition) => describeCondition(c, byId.get(c.field), ctx)
  const all = (group.all ?? []).map(one)
  const any = (group.any ?? []).map(one)
  if (any.length === 0) return all.join(' и ')
  const anyText = any.join(' или ')
  if (all.length === 0) return anyText
  return [...all, any.length > 1 ? `(${anyText})` : anyText].join(' и ')
}
