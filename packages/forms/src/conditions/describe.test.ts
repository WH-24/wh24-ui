import { describe, expect, it } from 'vitest'

import type { Field } from '../types'
import { describeCondition, describeGroup } from './describe'

const base = { section_id: 's', span: 12, required: false, show_in_list: false, filterable: false, archived: false } as const
const fld = (id: string, type: Field['type'], label: string, config?: Field['config']): Field =>
  ({ ...base, id, key: id, type, label, config }) as Field

const kind = fld('kind', 'select', 'Тип', {
  options: [
    { value: 'contract', label: 'Договор' },
    { value: 'invoice', label: 'Счёт' },
  ],
} as Field['config'])
const sum = fld('sum', 'money', 'Сумма')
const due = fld('due', 'date', 'Срок')
const urgent = fld('urgent', 'checkbox', 'Срочно')
const tags = fld('tags', 'multiselect', 'Теги', { options: [{ value: 'a', label: 'Альфа' }] } as Field['config'])
const owner = fld('owner', 'user', 'Ответственный')
const city = fld('city', 'text', 'Город')
const fields = [kind, sum, due, urgent, tags, owner, city]

describe('describeCondition', () => {
  it.each([
    [{ field: 'kind', op: 'eq', value: 'contract' }, kind, 'Тип = Договор'],
    [{ field: 'kind', op: 'in', value: ['contract', 'invoice'] }, kind, 'Тип — одно из: Договор, Счёт'],
    [{ field: 'sum', op: 'gt', value: 100000 }, sum, 'Сумма > 100 000'],
    [{ field: 'due', op: 'lt', value: '2026-12-01' }, due, 'Срок раньше 01.12.2026'],
    [{ field: 'due', op: 'eq', value: '2026-12-01' }, due, 'Срок = 01.12.2026'],
    [{ field: 'urgent', op: 'eq', value: true }, urgent, 'Срочно: отмечено'],
    [{ field: 'urgent', op: 'eq', value: false }, urgent, 'Срочно: не отмечено'],
    [{ field: 'tags', op: 'in', value: ['a'] }, tags, 'Теги содержит любое из: Альфа'],
    [{ field: 'city', op: 'contains', value: 'Мос' }, city, 'Город содержит «Мос»'],
    [{ field: 'city', op: 'empty' }, city, 'Город пусто'],
    [{ field: 'kind', op: 'eq' }, kind, 'Тип = …'],
    [{ field: 'ghost', op: 'not_empty' }, undefined, 'поле удалено заполнено'],
  ] as const)('%j', (c, src, want) => {
    expect(describeCondition(c as never, src)).toBe(want)
  })

  it('сотрудник — по справочнику из контекста', () => {
    const ctx = { staff: [{ id: 'u1', label: 'Иванов' }] } as never
    expect(describeCondition({ field: 'owner', op: 'eq', value: 'u1' }, owner, ctx)).toBe(
      'Ответственный = Иванов',
    )
  })
})

describe('describeGroup', () => {
  it('все — через «и», любое — через «или», оба — any в скобках', () => {
    const a = { field: 'kind', op: 'eq', value: 'contract' } as const
    const b = { field: 'urgent', op: 'eq', value: true } as const
    const c = { field: 'city', op: 'not_empty' } as const
    expect(describeGroup({ all: [a, b] }, fields)).toBe('Тип = Договор и Срочно: отмечено')
    expect(describeGroup({ any: [a, b] }, fields)).toBe('Тип = Договор или Срочно: отмечено')
    expect(describeGroup({ all: [a], any: [b, c] }, fields)).toBe(
      'Тип = Договор и (Срочно: отмечено или Город заполнено)',
    )
    expect(describeGroup(undefined, fields)).toBe('')
  })
})
