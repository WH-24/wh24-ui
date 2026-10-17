import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { Field, Form, FormRecord, SchemaDocument } from '../types'
import type { FormsApi } from '../api'
import { normalize, validateForPublish } from '../schema'
import { validateRecord } from '../validate'
import { systemValue, withSystemValues } from '../render/system'
import { FormRecordEditor } from './FormRecordEditor'
import { FormRecordView } from './FormRecordView'
import { FormRecordsPage } from './FormRecordsPage'

// Системные поля (владелец 17.10.2026, как в Pyrus): автор, дата создания и
// форма заполняются сами и в data не хранятся; ответственный и срок — обычные
// значения записи.

const f = (over: Partial<Field> & Pick<Field, 'id' | 'type'>): Field => ({
  key: over.id,
  label: over.id,
  section_id: 's1',
  span: 6,
  required: false,
  show_in_list: false,
  filterable: false,
  archived: false,
  ...over,
})

const schema: SchemaDocument = {
  schema_version: 1,
  title_field: 'name',
  sections: [{ id: 's1', title: 'Основное', sort: 0 }],
  fields: [
    f({ id: 'name', type: 'text', label: 'Название', required: true }),
    f({ id: 'author', type: 'user', label: 'Автор', system: 'author', show_in_list: true }),
    f({ id: 'resp', type: 'user', label: 'Ответственный', system: 'responsible' }),
    f({ id: 'created', type: 'datetime', label: 'Дата создания', system: 'created_at' }),
    f({ id: 'due', type: 'date', label: 'Срок', system: 'due' }),
    f({ id: 'form', type: 'text', label: 'Форма', system: 'form', show_in_list: true }),
  ],
}

const form = {
  id: 'form-1',
  module_key: 'oup',
  key: 'zayavka',
  name: 'Заявка на подрядчика',
  nav_label: 'Заявки',
  status: 'published',
  current_version: 1,
} as Form

const staff = [
  { id: 'staff-1', label: 'Агапова Анастасия', auth_user_id: 'iam-1' },
  { id: 'staff-2', label: 'Андреева Мария' },
]

const record: FormRecord = {
  id: 'r1',
  form_id: 'form-1',
  form_version: 1,
  number: 7,
  title: 'ИП Сидоров',
  data: { name: 'ИП Сидоров', resp: 'staff-2', due: '2026-10-20' },
  status: 'open',
  created_by: 'iam-1',
  updated_by: null,
  created_at: '2026-10-17T09:05:00Z',
  updated_at: '2026-10-17T09:05:00Z',
  deleted_at: null,
}

describe('системные поля: схема и проверки', () => {
  it('normalize: тип, повтор, обязательность вычисляемого', () => {
    expect(normalize(schema)).toBeNull()
    expect(
      normalize({ ...schema, fields: [...schema.fields, f({ id: 'a2', type: 'user', system: 'author' })] }),
    ).toMatch(/уже есть в форме/)
    expect(normalize({ ...schema, fields: [f({ id: 'd', type: 'text', system: 'due' })] })).toMatch(/должно быть типа "date"/)
    expect(
      normalize({ ...schema, fields: [f({ id: 'a', type: 'user', system: 'author', required: true })] }),
    ).toMatch(/обязательным быть не может/)
  })

  it('публикация: название не из вычисляемого, условие по нему и смена назначения — блокеры', () => {
    const msgs = (prev: SchemaDocument | null, next: SchemaDocument) => validateForPublish(prev, next).map((e) => e.message)
    expect(msgs(null, { ...schema, title_field: 'form' })).toContain(
      'Поле «Форма» заполняется само и не подходит для названия записи',
    )
    const cond = {
      ...schema,
      fields: [...schema.fields, f({ id: 'x', type: 'text', label: 'Икс', visible_if: { all: [{ field: 'created', op: 'not_empty' }] } })],
    }
    expect(msgs(null, cond).join('\n')).toMatch(/условие показа по полю «Дата создания» не сработает/)
    const plain = { ...schema, fields: schema.fields.map((x) => (x.id === 'resp' ? { ...x, system: undefined } : x)) }
    expect(msgs(schema, plain).join('\n')).toMatch(/«Ответственный»: системное назначение нельзя менять/)
    expect(msgs(schema, schema)).toEqual([])
  })

  it('validateRecord: значение автора с клиента — неизвестное поле', () => {
    expect(validateRecord(schema, { name: 'x' })).toEqual([])
    expect(validateRecord(schema, { name: 'x', author: 'iam-1' }).map((e) => `${e.field_id}:${e.code}`)).toEqual([
      'author:unknown_field',
    ])
  })

  it('значения из записи: автор — сотрудник по учётке IAM, иначе сама учётка', () => {
    const src = { record, formName: form.name, staff }
    const v = withSystemValues(schema, record.data, src)
    expect(v).toMatchObject({ author: 'staff-1', created: '2026-10-17T09:05:00Z', form: 'Заявка на подрядчика', resp: 'staff-2' })
    expect(record.data).not.toHaveProperty('author')
    expect(systemValue({ system: 'author' }, { record: { ...record, created_by: 'iam-9' }, staff })).toBe('iam-9')
    expect(systemValue({ system: 'author' }, { record: null })).toBeUndefined()
    expect(systemValue({ system: 'due' }, src)).toBeUndefined()
  })
})

describe('системные поля на страницах', () => {
  it('карточка записи: автор по имени, дата создания и форма', () => {
    render(<FormRecordView form={form} schema={schema} record={record} ctx={{ staff }} />)
    const row = (label: string) => screen.getByText(label, { selector: 'label, span, div' }).closest('div')!.parentElement!
    expect(row('Автор').textContent).toContain('Агапова Анастасия')
    expect(row('Форма').textContent).toContain('Заявка на подрядчика')
    expect(row('Дата создания').textContent).toMatch(/17\.10\.2026/)
    expect(row('Ответственный').textContent).toContain('Андреева Мария')
  })

  it('правка: вычисляемые поля не редактируются и не уходят в data', async () => {
    const user = userEvent.setup()
    const update = vi.fn(async () => record)
    const api = { records: { update, uploadFile: vi.fn(), fileUrl: vi.fn() } } as unknown as FormsApi
    render(
      <FormRecordEditor form={form} schema={schema} api={api} record={record} ctx={{ staff }} onSaved={vi.fn()} onCancel={vi.fn()} />,
    )
    expect(screen.queryByLabelText('Форма')).toBeNull()
    expect(screen.getByText('Заявка на подрядчика')).toBeTruthy()
    await user.click(screen.getAllByRole('button', { name: 'Сохранить' })[0]!)
    await waitFor(() => expect(update).toHaveBeenCalled())
    const body = (update.mock.calls[0] as unknown[])[2] as { data: Record<string, unknown> }
    expect(Object.keys(body.data).sort()).toEqual(['due', 'name', 'resp'])
  })

  it('список: колонки автора и формы заполнены из записи', async () => {
    const list = vi.fn(async () => ({ data: [record], total: 1 }))
    const api = { records: { list, exportCsvUrl: () => '' } } as unknown as FormsApi
    render(<FormRecordsPage form={form} schema={schema} api={api} ctx={{ staff }} onOpen={vi.fn()} />)
    const row = await screen.findByRole('row', { name: /ИП Сидоров/ })
    expect(within(row).getByText('Агапова Анастасия')).toBeTruthy()
    expect(within(row).getByText('Заявка на подрядчика')).toBeTruthy()
  })
})
