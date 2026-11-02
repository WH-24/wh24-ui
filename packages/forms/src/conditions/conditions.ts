/**
 * Вычислитель условной видимости (`visible_if`) — буквальный порт
 * wh24-forms-api/internal/conditions/conditions.go. Имена операторов, структур
 * и семантика краевых случаев (отсутствующее поле, нечисловое значение при gt,
 * пустая группа) — те же; фикстуры `fixtures/*.json` — те же файлы, что
 * гоняет Go-тест. Расхождение с бэкендом здесь — баг, а не свобода трактовки:
 * поле, скрытое на фронте и обязательное на бэке, ломает сохранение.
 */
import type { Condition, ConditionGroup, ConditionItem, Op } from '../types.js'
import { isNestedGroup } from '../types.js'

export type Values = Record<string, unknown>

/** Окружение вычисления: «сегодня» (ГГГГ-ММ-ДД) для относительных дат
 *  `{days: N}`. Не задано — сегодня по Москве. */
export interface Env {
  today?: string
}

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
export function evaluate(
  group: ConditionGroup | null | undefined,
  values: Values,
  env: Env = {},
): boolean {
  if (!group) return true
  for (const c of group.all ?? []) {
    if (!evalItem(c, values, env)) return false
  }
  const any = group.any ?? []
  if (any.length === 0) return true
  for (const c of any) {
    if (evalItem(c, values, env)) return true
  }
  return false
}

/** Сравнение или вложенная группа («скобки»). */
function evalItem(c: ConditionItem, values: Values, env: Env): boolean {
  if (isNestedGroup(c)) return evaluate(c, values, env)
  return evalCondition(c, values, env)
}

function evalCondition(cond: Condition, values: Values, env: Env): boolean {
  const c = { ...cond, value: resolveValue(cond.value, env) }
  const present = Object.prototype.hasOwnProperty.call(values, c.field)
  const val = values[c.field]
  switch (c.op) {
    case 'empty':
      return isEmptyValue(val)
    case 'not_empty':
      return !isEmptyValue(val)
    case 'eq':
      return present && valueEqual(val, c.value)
    case 'ne':
      // Симметрично eq: без значения сравнивать не с чем → false, а не true
      // по умолчанию, иначе незаполненная запись включала бы поля «не равно X».
      return present && !valueEqual(val, c.value)
    case 'in':
      return present && inList(val, c.value)
    case 'not_in':
      return present && !inList(val, c.value)
    case 'contains':
      return present && containsValue(val, c.value)
    case 'not_contains':
      // Пустое поле «не содержит» ничего — false, как ne без значения.
      return present && !isEmptyValue(val) && !containsValue(val, c.value)
    case 'between': {
      const b = c.value
      if (!Array.isArray(b) || b.length !== 2) return false
      return compareOrdered('gte', val, b[0]) && compareOrdered('lte', val, b[1])
    }
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      return compareOrdered(c.op, val, c.value)
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

/** gt/gte/lt/lte: обе стороны — числа (или числовые строки) либо обе даты
 *  (см. toDate); иначе — false, не ошибка. */
function compareOrdered(op: Op, val: unknown, other: unknown): boolean {
  let a = toFloat(val)
  let b = toFloat(other)
  if (a === null || b === null) {
    const da = toDate(val)
    const db = toDate(other)
    if (!da || !db) return false
    ;[a, b] = dateKeys(da, db)
  }
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

/** Москва, +03:00 без летнего времени — то же фиксированное смещение, что у Go. */
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const RFC3339_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

/** Дата из значения: `ГГГГ-ММ-ДД` (номер дня) или RFC 3339 (момент, мс). */
interface DateValue {
  /** Номер календарного дня по Москве. */
  day: number
  /** Момент в мс; у даты без времени — null. */
  ms: number | null
}

function toDate(v: unknown): DateValue | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  const m = DATE_RE.exec(s)
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
    const utc = Date.UTC(y, mo - 1, d)
    const back = new Date(utc)
    // Go не принимает несуществующие даты (2026-02-30) — и мы тоже.
    if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) {
      return null
    }
    return { day: utc / DAY_MS, ms: null }
  }
  if (!RFC3339_RE.test(s)) return null
  const ms = Date.parse(s)
  if (!Number.isFinite(ms)) return null
  return { day: Math.floor((ms + MSK_OFFSET_MS) / DAY_MS), ms }
}

/** Две даты как сравнимые числа: хотя бы одна без времени — по дням (МСК),
 *  обе со временем — моменты. */
function dateKeys(a: DateValue, b: DateValue): [number, number] {
  if (a.ms === null || b.ms === null) return [a.day, b.day]
  return [a.ms, b.ms]
}

/** eq/ne: дата со временем против даты без времени — по календарному дню;
 *  остальное — looseEqual. */
function valueEqual(a: unknown, b: unknown): boolean {
  const da = toDate(a)
  const db = da && toDate(b)
  if (da && db && (da.ms === null) !== (db.ms === null)) return da.day === db.day
  return looseEqual(a, b)
}

/** Сегодня по Москве, ГГГГ-ММ-ДД. */
export function todayMsk(now: number = Date.now()): string {
  return new Date(now + MSK_OFFSET_MS).toISOString().slice(0, 10)
}

/** {days: N} → «ГГГГ-ММ-ДД» сегодняшнего дня + N (в т.ч. внутри пары between). */
function resolveValue(v: unknown, env: Env): unknown {
  if (Array.isArray(v)) return v.map((x) => resolveValue(x, env))
  if (v && typeof v === 'object') {
    const keys = Object.keys(v)
    const n = toFloat((v as { days?: unknown }).days)
    if (keys.length === 1 && keys[0] === 'days' && n !== null) {
      const base = Date.parse(`${env.today ?? todayMsk()}T00:00:00Z`)
      return new Date(base + Math.trunc(n) * DAY_MS).toISOString().slice(0, 10)
    }
  }
  return v
}

/** Текст для сравнения без учёта регистра и крайних пробелов. */
function fold(s: string): string {
  return s.trim().toLowerCase()
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
  return fold(sprint(a)) === fold(sprint(b))
}

/** val в списке other; если val — массив («Несколько из списка»), это «есть
 *  хотя бы один общий элемент». */
function inList(val: unknown, other: unknown): boolean {
  if (!Array.isArray(other)) return false
  if (Array.isArray(val)) return val.some((item) => inList(item, other))
  return other.some((item) => looseEqual(val, item))
}

/** Для строк — подстрока, для массивов (multiselect) — членство элемента. */
function containsValue(val: unknown, needle: unknown): boolean {
  if (typeof val === 'string') return fold(val).includes(fold(sprint(needle)))
  if (Array.isArray(val)) return val.some((item) => looseEqual(item, needle))
  return false
}
