/**
 * Операторы условий по типу поля-источника и их подписи. Тот же список
 * разрешает публикация (wh24-forms-api internal/schema/conditionops.go —
 * там он может быть только шире): оператор вне списка — условие, которое не
 * сработает так, как ожидал автор.
 */
import type { FieldType, Op } from '../types.js'

const CHOICE: Op[] = ['eq', 'ne', 'in', 'not_in', 'empty', 'not_empty']
const ORDERED: Op[] = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'empty', 'not_empty']
const TEXT: Op[] = ['eq', 'ne', 'contains', 'empty', 'not_empty']
const FILLED: Op[] = ['not_empty', 'empty']

/** Операторы для условия по полю этого типа (первый — по умолчанию). */
export function conditionOps(type: FieldType): Op[] {
  switch (type) {
    case 'checkbox':
      // «Отмечено / не отмечено» — это eq true / eq false.
      return ['eq']
    case 'select':
    case 'catalog':
    case 'user':
    case 'department':
      return CHOICE
    case 'multiselect':
      return ['in', 'not_in', 'contains', 'empty', 'not_empty']
    case 'number':
    case 'money':
    case 'date':
    case 'datetime':
      return ORDERED
    case 'text':
    case 'textarea':
    case 'email':
    case 'phone':
    case 'link':
      return TEXT
    case 'file':
    case 'table':
    case 'record_ref':
    case 'contact':
      return FILLED
    default:
      return []
  }
}

const OP_LABEL: Record<Op, string> = {
  eq: 'равно',
  ne: 'не равно',
  in: 'одно из',
  not_in: 'ни одно из',
  empty: 'пусто',
  not_empty: 'заполнено',
  gt: 'больше',
  gte: 'не меньше',
  lt: 'меньше',
  lte: 'не больше',
  contains: 'содержит',
}

const DATE_LABEL: Partial<Record<Op, string>> = {
  gt: 'позже',
  gte: 'не раньше',
  lt: 'раньше',
  lte: 'не позже',
}

const MULTI_LABEL: Partial<Record<Op, string>> = {
  in: 'содержит любое из',
  not_in: 'не содержит ни одного из',
  contains: 'содержит вариант',
}

/** Подпись оператора для поля этого типа: у дат «раньше/позже», у
 *  множественного списка — «содержит любое из». */
export function opLabel(type: FieldType | undefined, op: Op): string {
  if (type === 'date' || type === 'datetime') return DATE_LABEL[op] ?? OP_LABEL[op]
  if (type === 'multiselect') return MULTI_LABEL[op] ?? OP_LABEL[op]
  return OP_LABEL[op] ?? op
}

/** Оператор без значения (пусто / заполнено). */
export function opTakesValue(op: Op): boolean {
  return op !== 'empty' && op !== 'not_empty'
}

/** Оператор со списком значений. */
export function opTakesList(op: Op): boolean {
  return op === 'in' || op === 'not_in'
}
