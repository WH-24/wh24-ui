import { describe, expect, it } from 'vitest'
import { flattenPyrusFields, pyrusCompat } from './pyrusMapping.js'
import type { Field } from './types.js'

const field = (type: Field['type'], extra: Partial<Field> = {}): Field => ({
  id: 'f',
  key: 'k',
  label: 'Поле',
  type,
  section_id: 's',
  span: 6,
  required: false,
  show_in_list: false,
  filterable: false,
  archived: false,
  binding: { storage: 'custom' },
  ...extra,
})
const p = (type: string, extra: { deleted?: boolean; parent_type?: string } = {}) => ({
  type,
  deleted: false,
  parent_type: '',
  ...extra,
})

describe('pyrusCompat — те же правила, что cardimport.PyrusCompat', () => {
  it('совместимые пары', () => {
    expect(pyrusCompat(field('text'), p('multiple_choice'))).toBeNull()
    expect(pyrusCompat(field('phone'), p('phone'))).toBeNull()
    expect(pyrusCompat(field('link'), p('text'))).toBeNull()
    expect(pyrusCompat(field('money'), p('number'))).toBeNull()
    expect(pyrusCompat(field('date'), p('due_date'))).toBeNull()
    expect(pyrusCompat(field('checkbox'), p('checkmark'))).toBeNull()
    expect(pyrusCompat(field('select'), p('catalog'))).toBeNull()
    expect(
      pyrusCompat(field('select', { config: { options: [{ value: 'Да' }, { value: 'Нет' }] } }), p('checkmark')),
    ).toBeNull()
    const nat = field('date', { key: 'sys_starts_on', binding: { storage: 'native' } })
    expect(pyrusCompat(nat, p('date'))).toBeNull()
  })
  it('несовместимые — с причиной', () => {
    expect(pyrusCompat(field('number'), p('text'))).toMatch('не подходит')
    expect(pyrusCompat(field('text'), p('person'))).toMatch('сотрудник')
    expect(pyrusCompat(field('text'), p('file'))).toMatch('нет одного значения')
    expect(pyrusCompat(field('text'), p('text', { deleted: true }))).toMatch('удалено')
    expect(pyrusCompat(field('text'), p('text', { parent_type: 'table' }))).toMatch('таблиц')
    expect(pyrusCompat(field('select'), p('checkmark'))).toMatch('«Да»/«Нет»')
    expect(pyrusCompat(field('user'), p('text'))).toMatch('сотрудник')
    expect(pyrusCompat(field('text', { key: 'sys_code', binding: { storage: 'native' } }), p('text'))).toMatch(
      'не наполняет',
    )
    expect(
      pyrusCompat(field('date', { key: 'sys_ends_on', binding: { storage: 'native' } }), p('text')),
    ).toMatch('дата')
  })
})

describe('flattenPyrusFields', () => {
  it('дерево → список с родителем', () => {
    const flat = flattenPyrusFields([
      { field_id: 1, name: 'КП', type: 'title', children: [{ field_id: 2, name: 'Дата', type: 'date', required_step: 2 }] },
      { field_id: 3, name: 'Контакты', type: 'table', children: [{ field_id: 4, name: 'ФИО', type: 'text' }] },
    ])
    expect(flat.map((f) => [f.field_id, f.parent_type, f.required_step])).toEqual([
      [1, '', null],
      [2, 'title', 2],
      [3, '', null],
      [4, 'table', null],
    ])
  })
})
