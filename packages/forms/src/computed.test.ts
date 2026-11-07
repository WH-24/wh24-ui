import { describe, expect, it } from 'vitest'

import { conditionOps } from './conditions/ops'
import { computeFormulas, evaluateFormula, FORMULA_FUNCTIONS, formulaOrder, formulaScope, parseFormula } from './formula/formula'
import { validateForPublish } from './schema'
import type { Field, SchemaDocument } from './types'
import { FIELD_TYPES, formulaResultField, isComputedField } from './types'
import { validateRecord } from './validate'

// Шаг 2 типов полей (06.11.2026): formula и lookup — контракт как в Go.

const f = (over: Partial<Field> & Pick<Field, 'id' | 'key' | 'type'>): Field =>
  ({ label: over.key, section_id: 's1', sort: 0, span: 12, required: false, show_in_list: false, filterable: false, archived: false, ...over }) as Field

const fx = (id: string, key: string, expr: string, result: 'number' | 'money' | 'text' | 'date' = 'number') =>
  f({ id, key, type: 'formula', config: { expr, result } })

const doc = (fields: Field[], over: Partial<SchemaDocument> = {}): SchemaDocument => ({
  schema_version: 1,
  title_field: 'title',
  sections: [{ id: 's1', title: 'Основное', sort: 0 }],
  fields: [f({ id: 'title', key: 'title', type: 'text' }), ...fields],
  ...over,
})

describe('контракт formula/lookup', () => {
  it('типы объявлены, lookup — вычисляемое, formula — нет', () => {
    expect(FIELD_TYPES).toContain('formula')
    expect(FIELD_TYPES).toContain('lookup')
    expect(isComputedField({ type: 'lookup' })).toBe(true)
    expect(isComputedField({ type: 'formula' })).toBe(false)
  })
  it('formulaResultField — тип результата и валюта', () => {
    const m = formulaResultField(f({ id: 'm', key: 'm', type: 'formula', config: { expr: '1', result: 'money', currency: 'USD' } }))
    expect(m.type).toBe('money')
    expect((m.config as { currency?: string }).currency).toBe('USD')
    expect(formulaResultField(fx('d', 'd', 'TODAY()', 'date')).type).toBe('date')
  })
  it('операторы условий: формула по результату, подстановка — ни одного', () => {
    expect(conditionOps('formula', fx('x', 'x', '1'))).toContain('gt')
    expect(conditionOps('formula', fx('x', 'x', '"a"', 'text'))).toContain('contains')
    expect(conditionOps('formula', fx('x', 'x', '"a"', 'text'))).not.toContain('gt')
    expect(conditionOps('lookup')).toEqual([])
  })
  it('FORMULA_FUNCTIONS описывает все функции', () => {
    expect(FORMULA_FUNCTIONS.map((x) => x.name).sort()).toEqual(
      ['ABS', 'CONCAT', 'COUNT', 'DAYS', 'IF', 'LEN', 'MAX', 'MIN', 'ROUND', 'SUM', 'TODAY'].sort(),
    )
  })
})

describe('formulaScope / formulaOrder / computeFormulas', () => {
  const tbl = f({ id: 't', key: 'items', type: 'table', config: { columns: [{ id: 'c1', key: 'sum', label: 'Сумма', type: 'money' }] } })
  const d = doc([
    f({ id: 'p', key: 'price', type: 'number' }),
    f({ id: 'q', key: 'qty', type: 'number' }),
    tbl,
    fx('vat', 'vat', 'ROUND({total}*0.2, 2)'),
    fx('total', 'total', '{price}*{qty}'),
    fx('bad', 'bad', '{price}/0'),
    fx('tsum', 'tsum', 'SUM({items.sum})'),
    f({ id: 'lk', key: 'lk', type: 'lookup', config: { source_field: 'r', target_field: 'x' } }),
  ])
  it('область — по ключам, таблица — по ключам колонок, формулы и подстановки не входят', () => {
    const scope = formulaScope(d, { p: 20, t: [{ c1: 10 }], total: 999, lk: 'x' })
    expect(scope).toEqual({ price: 20, items: [{ sum: 10 }] })
  })
  it('порядок зависимостей и цикл', () => {
    // Проходами, как в Go: сначала всё без зависимостей, затем vat (ждала total).
    expect(formulaOrder(d).ordered.map((x) => x.key)).toEqual(['total', 'bad', 'tsum', 'vat'])
    const loop = doc([fx('x', 'x', '{y}'), fx('y', 'y', '{x}'), fx('z', 'z', '1')])
    const r = formulaOrder(loop)
    expect(r.cycle.sort()).toEqual(['x', 'y'])
    expect(r.ordered.map((x) => x.key)).toEqual(['z'])
  })
  it('computeFormulas — значения по id, ошибка → ключа нет', () => {
    const out = computeFormulas(d, { p: 20, q: 3, t: [{ c1: 10 }, { c1: 5.5 }] })
    expect(out).toEqual({ total: 60, vat: 12, tsum: 15.5 })
  })
})

describe('validateRecord и validateForPublish', () => {
  it('значение формулы с клиента не проверяется, подстановка — неизвестное поле', () => {
    const d = doc([fx('x', 'x', '1'), f({ id: 'lk', key: 'lk', type: 'lookup', config: {} })])
    expect(validateRecord(d, { title: 'a', x: 'что угодно' })).toEqual([])
    expect(validateRecord(d, { title: 'a', lk: 1 }).map((e) => e.code)).toEqual(['unknown_field'])
  })
  it('блокеры публикации: разбор, ключ, источник подстановки', () => {
    const msgs = (d: SchemaDocument) => validateForPublish(null, d).map((e) => e.message).join('\n')
    expect(msgs(doc([fx('x', 'x', 'FOO(1)')]))).toContain('неизвестная функция')
    expect(msgs(doc([fx('x', 'x', '{nope}')]))).toContain('нет поля с ключом «nope»')
    expect(msgs(doc([f({ id: 'lk', key: 'lk', type: 'lookup', config: {} })]))).toContain('выберите поле «Форма»')
    expect(msgs(doc([fx('x', 'x', '{title}')]))).toBe('')
    expect(msgs(doc([fx('x', 'x', '{y}'), fx('y', 'y', '{x}')]))).toContain('ссылаются друг на друга')
  })
})

// Ревью 06.11: паритет с Go и защита от «бомбы».
describe('formula — правки ревью', () => {
  it('глубина вложенности ограничена, как в Go (64)', () => {
    expect(() => parseFormula('('.repeat(200000) + '1' + ')'.repeat(200000))).toThrow(/слож/)
  })
  it('дата-время без зоны — не дата (как в Go)', () => {
    expect(evaluateFormula(parseFormula('{a}'), { a: '2026-11-06T22:30' }, 'date')).toBeNull()
    expect(evaluateFormula(parseFormula('{a}'), { a: '2026-11-06T22:30:00+03:00' }, 'date')).toBe('2026-11-06')
  })
  it('скрытое условием поле для формулы пусто', () => {
    const d = doc([
      f({ id: 'fl', key: 'flag', type: 'checkbox' }),
      f({ id: 'd', key: 'discount', type: 'number', visible_if: { all: [{ field: 'fl', op: 'eq', value: true }] } }),
      f({ id: 'p', key: 'price', type: 'number' }),
      fx('t', 'total', '{price}*(1-{discount}/100)'),
    ])
    expect(computeFormulas(d, { fl: false, d: 10, p: 100 })).toEqual({ t: 100 })
    expect(computeFormulas(d, { fl: true, d: 10, p: 100 })).toEqual({ t: 90 })
  })
})
