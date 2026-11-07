import { describe, expect, it } from 'vitest'
import { findPyrusField, flattenPyrusFields, pyrusChoices, pyrusCompat, withoutPyrus } from './pyrusMapping.js'
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

describe('pyrusChoices — «Поле Pyrus» у любой формы', () => {
  const schema = {
    fields: [
      { field_id: 11, name: 'Счёт', type: 'text', required_step: 2 },
      { field_id: 12, name: 'Сумма', type: 'money' },
      { field_id: 13, name: 'Ответственный', type: 'person' },
      { field_id: 14, name: 'Реквизиты', type: 'title', children: [{ field_id: 15, name: 'ИНН', type: 'text' }] },
      { field_id: 16, name: 'Старое', type: 'text', deleted: true },
    ],
    steps: [{ step: 2, name: 'Согласование' }],
  }
  // Обычная форма — без binding: правила те же, что у карточки.
  const plain = (id: string, type: Field['type'], pyrus?: number): Field => {
    const f = field(type, { id, key: id, pyrus: pyrus ? { field_id: pyrus } : undefined })
    delete f.binding
    return f
  }
  const doc = {
    schema_version: 1,
    title_field: 'a',
    sections: [],
    fields: [plain('a', 'text', 11), plain('b', 'text')],
    pyrus: { form_id: 2500001 },
  }

  it('подходящие и свободные — в списке, с этапом обязательности; группы не выбираются', () => {
    const { options, unavailable } = pyrusChoices(doc, doc.fields[1], schema)
    // В текст можно любое значение Pyrus (сумму тоже).
    expect(options.map((o) => o.field.field_id)).toEqual([12, 15])
    const why = Object.fromEntries(unavailable.map((u) => [u.field.field_id, u.reason]))
    expect(why[11]).toMatch('уже сопоставлено с полем «Поле»')
    expect(why[12]).toBeUndefined()
    expect(why[13]).toMatch('сотрудник')
    expect(why[16]).toBeUndefined() // удалённые в Pyrus не показываются
    const own = pyrusChoices(doc, doc.fields[0], schema).options.find((o) => o.field.field_id === 11)
    expect(own?.hint).toBe('Текст · обязательно с этапа «Согласование»')
  })

  it('findPyrusField находит вложенное поле; withoutPyrus снимает связи полей вместе с формой', () => {
    expect(findPyrusField({ form_id: 1, name: 'x', ...schema }, 15)?.parent_name).toBe('Реквизиты')
    expect(findPyrusField(null, 15)).toBeNull()
    const off = withoutPyrus(doc)
    expect(off.pyrus).toBeUndefined()
    expect(off.fields.every((f) => !f.pyrus)).toBe(true)
    expect(doc.fields[0].pyrus).toEqual({ field_id: 11 }) // исходный документ не тронут
  })
})
