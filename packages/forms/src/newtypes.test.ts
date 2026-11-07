import { describe, expect, it } from 'vitest'

import { conditionOps } from './conditions/ops'
import type { Field, SchemaDocument } from './types'
import {
  COMPUTED_SYSTEM_KEYS,
  FIELD_TYPES,
  RATING_DEFAULT_MAX,
  SYSTEM_FIELD_TYPES,
  TABLE_COLUMN_TYPES,
} from './types'
import { validateRecord } from './validate'

// Типы шага 1 «до уровня Monday» (06.11.2026): зеркало wh24-forms-api.

const f = (over: Partial<Field> & Pick<Field, 'id' | 'type'>): Field => ({
  key: over.id,
  label: over.id,
  section_id: 's',
  span: 6,
  required: false,
  show_in_list: false,
  filterable: false,
  archived: false,
  ...over,
})
const doc = (...fields: Field[]): SchemaDocument => ({
  schema_version: 1,
  title_field: fields[0]?.id ?? '',
  sections: [{ id: 's', title: 'Основное', sort: 0 }],
  fields,
})
const codes = (errs: { code: string }[]) => errs.map((e) => e.code)

describe('контракт новых типов', () => {
  it('восемь типов объявлены', () => {
    for (const t of ['rating', 'time', 'date_range', 'duration', 'percent', 'tags', 'location', 'color'])
      expect(FIELD_TYPES).toContain(t)
  })
  it('системные number/updated_at/updated_by вычисляемые с типами number/datetime/user', () => {
    expect(SYSTEM_FIELD_TYPES.number).toBe('number')
    expect(SYSTEM_FIELD_TYPES.updated_at).toBe('datetime')
    expect(SYSTEM_FIELD_TYPES.updated_by).toBe('user')
    expect(COMPUTED_SYSTEM_KEYS).toEqual(expect.arrayContaining(['number', 'updated_at', 'updated_by']))
  })
  it('колонки таблицы: добавлены user, link, rating, percent, duration, date_range, time; catalog — нет (нет catalog_key у колонки)', () => {
    for (const t of ['user', 'link', 'rating', 'percent', 'duration', 'date_range', 'time'])
      expect(TABLE_COLUMN_TYPES).toContain(t)
    expect(TABLE_COLUMN_TYPES).not.toContain('tags')
    expect(TABLE_COLUMN_TYPES).not.toContain('catalog')
  })
  it('операторы условий', () => {
    expect(conditionOps('rating')).toContain('gt')
    expect(conditionOps('tags')).toContain('contains')
    expect(conditionOps('color')).toEqual(['eq', 'ne', 'in', 'not_in', 'empty', 'not_empty'])
    expect(conditionOps('date_range')).toEqual(['not_empty', 'empty'])
    expect(conditionOps('location')).toEqual(['not_empty', 'empty'])
  })
  it('RATING_DEFAULT_MAX = 5', () => expect(RATING_DEFAULT_MAX).toBe(5))
})

describe('validateRecord — новые типы', () => {
  const cases: Array<[string, Field, unknown, string | null]> = [
    ['оценка 4', f({ id: 'r', type: 'rating', config: { max: 5 } }), 4, null],
    ['оценка 0', f({ id: 'r', type: 'rating' }), 0, 'min'],
    ['оценка 6 при max 5', f({ id: 'r', type: 'rating', config: { max: 5 } }), 6, 'max'],
    ['оценка дробная', f({ id: 'r', type: 'rating' }), 2.5, 'type'],
    ['время 09:30', f({ id: 't', type: 'time' }), '09:30', null],
    ['время 24:00', f({ id: 't', type: 'time' }), '24:00', 'format'],
    ['время 9:30', f({ id: 't', type: 'time' }), '9:30', 'format'],
    ['период', f({ id: 'd', type: 'date_range' }), { start: '2026-02-01', end: '2026-02-05' }, null],
    ['период start>end', f({ id: 'd', type: 'date_range' }), { start: '2026-02-05', end: '2026-02-01' }, 'range'],
    ['период без end', f({ id: 'd', type: 'date_range' }), { start: '2026-02-05' }, 'type'],
    ['длительность 90', f({ id: 'du', type: 'duration' }), 90, null],
    ['длительность -1', f({ id: 'du', type: 'duration' }), -1, 'min'],
    ['длительность дробная', f({ id: 'du', type: 'duration' }), 1.5, 'type'],
    ['процент 100', f({ id: 'p', type: 'percent' }), 100, null],
    ['процент 101', f({ id: 'p', type: 'percent' }), 101, 'max'],
    ['теги', f({ id: 'tg', type: 'tags' }), ['срочно', 'клиент'], null],
    ['теги дубль после trim', f({ id: 'tg', type: 'tags' }), ['a', ' a'], 'duplicate'],
    ['теги 31', f({ id: 'tg', type: 'tags' }), Array.from({ length: 31 }, (_, i) => `t${i}`), 'max_items'],
    ['тег длиннее 50', f({ id: 'tg', type: 'tags' }), ['x'.repeat(51)], 'max_length'],
    ['тег пустой', f({ id: 'tg', type: 'tags' }), ['a', '  '], 'type'],
    ['тег с пробелами по краям', f({ id: 'tg', type: 'tags' }), [' срочно'], 'format'],
    ['адрес', f({ id: 'l', type: 'location' }), { address: 'Москва' }, null],
    ['адрес lat 91', f({ id: 'l', type: 'location' }), { address: 'Москва', lat: 91, lon: 37 }, 'format'],
    ['адрес lat без lon', f({ id: 'l', type: 'location' }), { address: 'Москва', lat: 55.7 }, 'format'],
    ['адрес пустой', f({ id: 'l', type: 'location' }), { address: ' ' }, 'type'],
    ['цвет teal', f({ id: 'c', type: 'color' }), 'teal', null],
    ['цвет hex', f({ id: 'c', type: 'color' }), '#fff', 'format'],
  ]
  for (const [name, fld, value, code] of cases) {
    it(name, () => {
      const errs = validateRecord(doc(fld), { [fld.id]: value })
      if (code === null) expect(codes(errs)).toEqual([])
      else expect(codes(errs)).toEqual([code])
    })
  }
})
