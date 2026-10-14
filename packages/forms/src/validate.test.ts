import { describe, expect, it } from 'vitest'

import type { Field, SchemaDocument } from './types'
import { validateRecord } from './validate'

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

const codes = (errs: { code: string }[]) => errs.map((e) => e.code).sort()

describe('validateRecord — контрольный прогон на корректных данных', () => {
  it('все 17 типов с правильными значениями → ошибок нет', () => {
    const d = doc(
      f({ id: 'text', type: 'text', config: { max_length: 10 } }),
      f({ id: 'textarea', type: 'textarea' }),
      f({ id: 'number', type: 'number', config: { min: 0, max: 100 } }),
      f({ id: 'money', type: 'money' }),
      f({ id: 'date', type: 'date' }),
      f({ id: 'datetime', type: 'datetime' }),
      f({ id: 'checkbox', type: 'checkbox' }),
      f({ id: 'email', type: 'email' }),
      f({ id: 'phone', type: 'phone' }),
      f({ id: 'link', type: 'link' }),
      f({ id: 'select', type: 'select', config: { options: [{ value: 'a', label: 'A' }] } }),
      f({
        id: 'multi',
        type: 'multiselect',
        config: {
          options: [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
          ],
        },
      }),
      f({ id: 'catalog', type: 'catalog' }),
      f({ id: 'user', type: 'user' }),
      f({ id: 'dept', type: 'department' }),
      f({
        id: 'table',
        type: 'table',
        config: {
          columns: [
            { id: 'c1', key: 'sum', label: 'Сумма', type: 'money' },
            { id: 'c2', key: 'd', label: 'Срок', type: 'date' },
          ],
        },
      }),
      f({ id: 'file', type: 'file', config: { max_files: 2 } }),
      f({ id: 'sec', type: 'section' }),
      f({ id: 'note', type: 'note' }),
    )
    const errs = validateRecord(d, {
      text: 'короткий',
      textarea: 'много\nстрок',
      number: 42,
      money: 1500.5,
      date: '2026-03-15',
      datetime: '2026-03-15T10:00:00+03:00',
      checkbox: true,
      email: 'ivan@example.com',
      phone: '+7 (999) 123-45-67',
      link: 'https://example.com/x',
      select: 'a',
      multi: ['a', 'b'],
      catalog: 'КР',
      user: 'u-1',
      dept: 'd-1',
      table: [{ c1: 3200000, c2: '2026-04-30' }, { c1: 5400000 }],
      file: ['f1', 'f2'],
    })
    expect(errs).toEqual([])
  })
})

describe('validateRecord — правила', () => {
  it('обязательное скрытое поле не требуется; видимое — требуется', () => {
    const d = doc(
      f({ id: 'over', type: 'checkbox' }),
      f({
        id: 'reason',
        type: 'text',
        required: true,
        visible_if: { all: [{ field: 'over', op: 'eq', value: true }] },
      }),
    )
    expect(validateRecord(d, { over: false })).toEqual([])
    expect(codes(validateRecord(d, { over: true }))).toEqual(['required'])
  })

  it('ошибки списком, а не первой попавшейся', () => {
    const d = doc(
      f({ id: 'a', type: 'text', required: true }),
      f({ id: 'b', type: 'number' }),
      f({ id: 'c', type: 'email' }),
    )
    const errs = validateRecord(d, { b: 'не число', c: 'нет-собаки' })
    expect(codes(errs)).toEqual(['format', 'required', 'type'])
    expect(errs.map((e) => e.field_id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('архивное поле со значением — не ошибка; обязательное архивное — не требуется', () => {
    const d = doc(f({ id: 'old', type: 'number', required: true, archived: true }))
    expect(validateRecord(d, { old: 'мусор' })).toEqual([])
    expect(validateRecord(d, {})).toEqual([])
  })

  it('неизвестное поле в data → unknown_field', () => {
    const d = doc(f({ id: 'a', type: 'text' }))
    expect(codes(validateRecord(d, { zzz: 1 }))).toEqual(['unknown_field'])
  })

  it('сообщения по-русски и с подписью поля', () => {
    const d = doc(f({ id: 'a', type: 'text', label: 'Название', required: true }))
    expect(validateRecord(d, {})[0]?.message).toBe('поле «Название» обязательно для заполнения')
  })

  it('невычислимое условие → поле считается видимым', () => {
    const d = doc(
      f({
        id: 'a',
        type: 'text',
        required: true,
        visible_if: { all: [{ field: 'x', op: 'regex' as never }] },
      }),
    )
    expect(codes(validateRecord(d, {}))).toEqual(['required'])
  })
})

describe('validateRecord — типы', () => {
  it('text: max_length считает символы, не байты', () => {
    const d = doc(f({ id: 'a', type: 'text', config: { max_length: 3 } }))
    expect(validateRecord(d, { a: 'ёёё' })).toEqual([])
    expect(codes(validateRecord(d, { a: 'ёёёё' }))).toEqual(['max_length'])
  })

  it('number: min/max, строка — type', () => {
    const d = doc(f({ id: 'a', type: 'number', config: { min: 1, max: 5 } }))
    expect(codes(validateRecord(d, { a: 0 }))).toEqual(['min'])
    expect(codes(validateRecord(d, { a: 6 }))).toEqual(['max'])
    expect(codes(validateRecord(d, { a: '3' }))).toEqual(['type'])
  })

  it('date: только ГГГГ-ММ-ДД и существующая дата', () => {
    const d = doc(f({ id: 'a', type: 'date' }))
    expect(codes(validateRecord(d, { a: '15.03.2026' }))).toEqual(['type'])
    expect(codes(validateRecord(d, { a: '2026-02-31' }))).toEqual(['type'])
    expect(validateRecord(d, { a: '2026-02-28' })).toEqual([])
  })

  it('datetime: RFC 3339', () => {
    const d = doc(f({ id: 'a', type: 'datetime' }))
    expect(validateRecord(d, { a: '2026-03-15T10:00:00Z' })).toEqual([])
    expect(codes(validateRecord(d, { a: '2026-03-15 10:00' }))).toEqual(['type'])
  })

  it('checkbox: только boolean', () => {
    const d = doc(f({ id: 'a', type: 'checkbox' }))
    expect(codes(validateRecord(d, { a: 'true' }))).toEqual(['type'])
  })

  it('link: только http(s) с хостом — javascript:/data:/file: отклоняются', () => {
    const d = doc(f({ id: 'a', type: 'link' }))
    expect(codes(validateRecord(d, { a: 'example.com' }))).toEqual(['format'])
    expect(codes(validateRecord(d, { a: 'javascript://example.com/%0aalert(1)' }))).toEqual([
      'format',
    ])
    expect(codes(validateRecord(d, { a: 'data:text/html,hi' }))).toEqual(['format'])
    expect(codes(validateRecord(d, { a: 'file:///etc/passwd' }))).toEqual(['format'])
    expect(validateRecord(d, { a: 'http://example.com' })).toEqual([])
    expect(validateRecord(d, { a: 'https://example.com/x?y=1' })).toEqual([])
  })

  it('table: max_rows — серверный предел, не только кнопка', () => {
    const d = doc(
      f({
        id: 't',
        type: 'table',
        config: { max_rows: 2, columns: [{ id: 'c', key: 'c', label: 'C', type: 'text' }] },
      }),
    )
    expect(codes(validateRecord(d, { t: [{ c: '1' }, { c: '2' }, { c: '3' }] }))).toEqual([
      'max_rows',
    ])
    expect(validateRecord(d, { t: [{ c: '1' }, { c: '2' }] })).toEqual([])
  })

  it('phone: хотя бы одна цифра', () => {
    const d = doc(f({ id: 'a', type: 'phone' }))
    expect(codes(validateRecord(d, { a: 'позвонить' }))).toEqual(['format'])
  })

  it('select/multiselect: значение из вариантов; без вариантов — что угодно', () => {
    const opts = { options: [{ value: 'a', label: 'A' }] }
    const d = doc(
      f({ id: 's', type: 'select', config: opts }),
      f({ id: 'm', type: 'multiselect', config: opts }),
      f({ id: 'free', type: 'select' }),
    )
    expect(codes(validateRecord(d, { s: 'zzz', m: ['a', 'q'], free: 'anything' }))).toEqual([
      'not_in_options',
      'not_in_options',
    ])
    expect(codes(validateRecord(d, { m: 'a' }))).toEqual(['type'])
  })

  it('file: список строк, не больше max_files', () => {
    const d = doc(f({ id: 'a', type: 'file', config: { max_files: 1 } }))
    expect(codes(validateRecord(d, { a: ['x', 'y'] }))).toEqual(['max_files'])
    expect(codes(validateRecord(d, { a: [1] }))).toEqual(['type'])
  })

  it('table: неизвестная колонка, тип ячейки, строка не объект', () => {
    const d = doc(
      f({
        id: 't',
        type: 'table',
        label: 'Смета',
        config: { columns: [{ id: 'c1', key: 'sum', label: 'Сумма', type: 'money' }] },
      }),
    )
    const errs = validateRecord(d, { t: [{ c1: 'x' }, { zz: 1 }, 'строка', { c1: '' }] })
    expect(codes(errs)).toEqual(['type', 'type', 'unknown_column'])
    expect(errs[0]?.message).toContain('Смета → Сумма (строка 1)')
  })
})
