/**
 * Вычислитель условной видимости (`visible_if`) — буквальный порт
 * wh24-forms-api/internal/conditions/conditions.go. Имена операторов, структур
 * и семантика краевых случаев (отсутствующее поле, нечисловое значение при gt,
 * пустая группа) — те же; фикстуры `fixtures/*.json` — те же файлы, что
 * гоняет Go-тест. Расхождение с бэкендом здесь — баг, а не свобода трактовки:
 * поле, скрытое на фронте и обязательное на бэке, ломает сохранение.
 */
import type { Condition, ConditionGroup, Op } from '../types.js'

export type Values = Record<string, unknown>

export class UnknownOpError extends Error {
  constructor(public readonly op: string) {
    super(`conditions: неизвестный оператор "${op}"`)
    this.name = 'UnknownOpError'
  }
}

/**
 * Видимость по группе условий и текущим значениям записи (id поля → значение).
 *
 * Условие на отсутствующее поле НЕ ошибка — оно просто не проходит (кроме
 * `empty`, для которого отсутствие поля неотличимо от пустого значения).
 * Единственная ошибка — неизвестный оператор: это опечатка в схеме, у неё нет
 * разумной трактовки «какой бы ни была форма».
 */
export function evaluate(group: ConditionGroup | null | undefined, values: Values): boolean {
  if (!group) return true
  for (const c of group.all ?? []) {
    if (!evalCondition(c, values)) return false
  }
  const any = group.any ?? []
  if (any.length === 0) return true
  for (const c of any) {
    if (evalCondition(c, values)) return true
  }
  return false
}

function evalCondition(c: Condition, values: Values): boolean {
  const present = Object.prototype.hasOwnProperty.call(values, c.field)
  const val = values[c.field]
  switch (c.op) {
    case 'empty':
      return isEmptyValue(val)
    case 'not_empty':
      return !isEmptyValue(val)
    case 'eq':
      return present && looseEqual(val, c.value)
    case 'ne':
      // Симметрично eq: без значения сравнивать не с чем → false, а не true
      // по умолчанию, иначе незаполненная запись включала бы поля «не равно X».
      return present && !looseEqual(val, c.value)
    case 'in':
      return present && inList(val, c.value)
    case 'not_in':
      return present && !inList(val, c.value)
    case 'contains':
      return present && containsValue(val, c.value)
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      return compareNumeric(c.op, val, c.value)
    default:
      throw new UnknownOpError(String(c.op))
  }
}

/** null/undefined, пустая строка, пустой массив или объект без ключей. */
export function isEmptyValue(v: unknown): boolean {
  if (v == null) return true
  if (typeof v === 'string') return v === ''
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === 'object') return Object.keys(v as object).length === 0
  return false
}

/** Число из значения: number или строка, которая парсится как число.
 *  Не число → null (вызывающая сторона решает; у gt/lt это «ложно»). */
function toFloat(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') {
    const s = v.trim()
    if (s === '') return null
    const f = Number(s)
    return Number.isFinite(f) ? f : null
  }
  return null
}

function compareNumeric(op: Op, val: unknown, other: unknown): boolean {
  const a = toFloat(val)
  const b = toFloat(other)
  if (a === null || b === null) return false
  switch (op) {
    case 'gt':
      return a > b
    case 'gte':
      return a >= b
    case 'lt':
      return a < b
    case 'lte':
      return a <= b
    default:
      return false
  }
}

/** Го-шный fmt.Sprint для скаляров: bool → "true", число → без хвостов. */
function sprint(v: unknown): string {
  if (v == null) return '<nil>'
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}

/**
 * Сравнение значения поля со значением условия так, чтобы число/строка/bool
 * из JSON совпадали независимо от того, как получены. Числовое сравнение —
 * только когда ОБА уже числового вида: eq "05" против "здание 5" не должно
 * стать сравнением 5 == NaN.
 */
function looseEqual(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return a == null && b == null
  const af = toFloat(a)
  const bf = toFloat(b)
  if (af !== null && bf !== null && typeof a !== 'string' && typeof b !== 'string') {
    return af === bf
  }
  return sprint(a) === sprint(b)
}

function inList(val: unknown, other: unknown): boolean {
  if (!Array.isArray(other)) return false
  return other.some((item) => looseEqual(val, item))
}

/** Для строк — подстрока, для массивов (multiselect) — членство элемента. */
function containsValue(val: unknown, needle: unknown): boolean {
  if (typeof val === 'string') return val.includes(sprint(needle))
  if (Array.isArray(val)) return val.some((item) => looseEqual(item, needle))
  return false
}
