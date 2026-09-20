import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FormsApiError, type FormsApi } from '../api'
import type { Field, Form, FormRecord, SchemaDocument } from '../types'
import { FormRecordEditor } from './FormRecordEditor'
import { FormRecordView } from './FormRecordView'
import { FormRecordsPage } from './FormRecordsPage'
import { Pager, pageItems } from './Pager'

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
    f({ id: 'budget', type: 'money', label: 'Бюджет', show_in_list: true, config: { currency: 'RUB' } }),
    f({ id: 'owner', type: 'user', label: 'Ответственный', show_in_list: true }),
    f({ id: 'note', type: 'textarea', label: 'Заметка' }),
  ],
}

const form: Form = {
  id: 'form-1',
  module_key: 'oup',
  key: 'finmodel',
  name: 'Финансовая модель',
  nav_label: 'Финансовые модели',
  page_title: 'Финансовые модели',
  description: 'Бюджеты контрактов',
  icon: 'chart',
  status: 'published',
  current_version: 3,
  draft_schema: null,
  draft_updated_at: null,
  draft_updated_by: null,
  record_access: 'module',
  sort_order: 0,
  created_by: 'u0',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  archived_at: null,
}

const rec = (n: number, over: Partial<FormRecord> = {}): FormRecord => ({
  id: `r${n}`,
  form_id: form.id,
  form_version: 3,
  number: n,
  title: `Запись ${n}`,
  data: { name: `Запись ${n}`, budget: n * 1000000, owner: 'u1' },
  status: 'open',
  created_by: 'u1',
  updated_by: null,
  created_at: '2026-03-01T10:00:00Z',
  updated_at: '2026-03-01T10:00:00Z',
  deleted_at: null,
  ...over,
})

function mockApi(over: Partial<{ list: unknown; create: unknown; update: unknown; history: unknown }> = {}) {
  const list = vi.fn(async () => ({ data: [rec(1), rec(2)], total: 2 }))
  const create = vi.fn(async (_f: string, body: { title: string; data: unknown }) => rec(9, { title: body.title }))
  const update = vi.fn(async (_f: string, _id: string, body: { title: string }) => rec(1, { title: body.title }))
  const history = vi.fn(async () => [])
  const api = {
    records: {
      list: (over.list as typeof list) ?? list,
      create: (over.create as typeof create) ?? create,
      update: (over.update as typeof update) ?? update,
      history: (over.history as typeof history) ?? history,
      uploadFile: vi.fn(),
      fileUrl: vi.fn(),
      exportCsvUrl: (id: string) => `/api/v1/forms/${id}/export.csv`,
    },
  } as unknown as FormsApi
  return { api, list, create, update, history }
}

const ctx = { staff: [{ id: 'u1', label: 'Иван Петров' }] }

beforeEach(() => {
  localStorage.clear()
})

describe('Pager', () => {
  it('pageItems: окно с многоточиями', () => {
    expect(pageItems(1, 5)).toEqual([1, 2, 3, 4, 5])
    expect(pageItems(1, 26)).toEqual([1, 2, 3, 4, '…', 26])
    expect(pageItems(13, 26)).toEqual([1, '…', 12, 13, 14, '…', 26])
    expect(pageItems(26, 26)).toEqual([1, '…', 23, 24, 25, 26])
  })

  it('диапазон, границы и переход по Enter', async () => {
    const user = userEvent.setup()
    const onPage = vi.fn()
    render(<Pager page={2} pageSize={50} total={1284} onPage={onPage} />)
    expect(screen.getByText(/51–100 из 1\s284/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Предыдущая страница' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Страница 26' }))
    expect(onPage).toHaveBeenCalledWith(26)
    const goto = screen.getByLabelText('Перейти к странице')
    await user.clear(goto)
    await user.type(goto, '999{Enter}')
    expect(onPage).toHaveBeenLastCalledWith(26) // clamp к последней
  })

  it('на последней странице «Следующая» выключена; total=0 → «0 из 0»', () => {
    render(<Pager page={1} pageSize={50} total={0} onPage={() => {}} />)
    expect(screen.getByRole('button', { name: 'Следующая страница' })).toBeDisabled()
    expect(screen.getByText('0 из 0')).toBeInTheDocument()
  })
})

describe('FormRecordsPage', () => {
  it('строки из API, колонки по show_in_list, счётчик, клик по строке', async () => {
    const user = userEvent.setup()
    const { api, list } = mockApi()
    const onOpen = vi.fn()
    render(<FormRecordsPage form={form} schema={schema} api={api} ctx={ctx} onOpen={onOpen} />)
    expect(await screen.findByText('Запись 1')).toBeInTheDocument()
    expect(screen.getByText(/2 записи/)).toBeInTheDocument()
    const heads = screen.getAllByRole('columnheader').map((h) => h.textContent)
    expect(heads).toEqual(['№', 'Название', 'Бюджет', 'Ответственный', 'Статус', 'Обновлено'])
    expect(screen.getByText(/1\s000\s000\s₽/)).toBeInTheDocument()
    expect(screen.getAllByText('Иван Петров')).toHaveLength(2)
    expect(list).toHaveBeenCalledWith('form-1', { search: undefined, page: 1, limit: 50, sort: 'created_at_desc' })
    await user.click(screen.getByText('Запись 2'))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'r2' }))
  })

  it('поиск уходит на сервер с задержкой и сбрасывает страницу', async () => {
    const user = userEvent.setup()
    const { api, list } = mockApi()
    render(<FormRecordsPage form={form} schema={schema} api={api} />)
    await screen.findByText('Запись 1')
    await user.type(screen.getByLabelText('Поиск по названию'), 'Ло')
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith('form-1', expect.objectContaining({ search: 'Ло', page: 1 })),
    )
    // Промежуточное «Л» не улетало — дебаунс.
    expect(list.mock.calls.some((c) => (c[1] as { search?: string }).search === 'Л')).toBe(false)
  })

  it('403 → «нет доступа»; 503 → авария с «Повторить», не отказ', async () => {
    const user = userEvent.setup()
    const forbidden = mockApi({ list: vi.fn(async () => { throw new FormsApiError(403, 'forbidden') }) })
    const { unmount } = render(<FormRecordsPage form={form} schema={schema} api={forbidden.api} />)
    expect(await screen.findByText('Нет доступа к записям')).toBeInTheDocument()
    unmount()

    let calls = 0
    const flaky = mockApi({
      list: vi.fn(async () => {
        calls += 1
        if (calls === 1) throw new FormsApiError(503, 'модуль недоступен')
        return { data: [rec(1)], total: 1 }
      }),
    })
    render(<FormRecordsPage form={form} schema={schema} api={flaky.api} />)
    expect(await screen.findByText('Сервис временно недоступен')).toBeInTheDocument()
    expect(screen.queryByText('Нет доступа к записям')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByText('Запись 1')).toBeInTheDocument()
  })

  it('пусто → «Пока нет записей» + Создать (только с правом и у опубликованной формы)', async () => {
    const { api } = mockApi({ list: vi.fn(async () => ({ data: [], total: 0 })) })
    const onCreate = vi.fn()
    const { rerender } = render(
      <FormRecordsPage form={form} schema={schema} api={api} canCreate onCreate={onCreate} />,
    )
    expect(await screen.findByText('Пока нет записей')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Создать/ }).length).toBeGreaterThan(0)

    rerender(
      <FormRecordsPage form={{ ...form, status: 'archived' }} schema={schema} api={api} canCreate onCreate={onCreate} />,
    )
    expect(await screen.findByText(/Форма в архиве/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Создать/ })).not.toBeInTheDocument()
  })

  it('поиск без результата → «Ничего не найдено» и «Сбросить»', async () => {
    const user = userEvent.setup()
    const { api } = mockApi({
      list: vi.fn(async (_f: string, q: { search?: string }) =>
        q.search ? { data: [], total: 0 } : { data: [rec(1)], total: 1 },
      ),
    })
    render(<FormRecordsPage form={form} schema={schema} api={api} />)
    await screen.findByText('Запись 1')
    await user.type(screen.getByLabelText('Поиск по названию'), 'zzz')
    expect(await screen.findByText('Ничего не найдено')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Сбросить' }))
    expect(await screen.findByText('Запись 1')).toBeInTheDocument()
  })

  it('меню «Колонки» скрывает колонку и запоминает выбор', async () => {
    const user = userEvent.setup()
    const { api } = mockApi()
    const { unmount } = render(<FormRecordsPage form={form} schema={schema} api={api} />)
    await screen.findByText('Запись 1')
    await user.click(screen.getByRole('button', { name: 'Колонки' }))
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Бюджет' }))
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).not.toContain('Бюджет')
    expect(screen.getByRole('menuitemcheckbox', { name: '№' })).toBeDisabled()
    unmount()
    render(<FormRecordsPage form={form} schema={schema} api={api} />)
    await screen.findByText('Запись 1')
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).not.toContain('Бюджет')
  })
})

describe('FormRecordView', () => {
  it('шапка, статус, тело; история грузится по кнопке и показывает было → стало', async () => {
    const user = userEvent.setup()
    const loadHistory = vi.fn(async () => [
      {
        id: 'h1',
        record_id: 'r1',
        form_version: 3,
        actor: 'u1',
        at: '2026-03-02T09:00:00Z',
        action: 'updated' as const,
        changes: { budget: { from: 1000000, to: 1500000 } },
      },
    ])
    render(
      <FormRecordView
        form={form}
        schema={schema}
        record={rec(1)}
        ctx={ctx}
        loadHistory={loadHistory}
        actorName={(id) => (id === 'u1' ? 'Иван Петров' : id)}
        currentVersion={4}
      />,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Запись 1')
    expect(screen.getByText('Открыта')).toBeInTheDocument()
    expect(screen.getByText(/v3, текущая — v4/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /История/ }))
    expect(await screen.findByText('Изменена')).toBeInTheDocument()
    expect(loadHistory).toHaveBeenCalledTimes(1)
    const diff = screen.getByText('Бюджет', { selector: 'span' }).parentElement!
    expect(within(diff).getByText(/1\s000\s000/)).toBeInTheDocument()
    expect(within(diff).getByText(/1\s500\s000/)).toBeInTheDocument()
  })
})

describe('FormRecordEditor', () => {
  it('локальная валидация блокирует отправку; правка поля снимает ошибку', async () => {
    const user = userEvent.setup()
    const { api, create } = mockApi()
    render(<FormRecordEditor form={form} schema={schema} api={api} onSaved={vi.fn()} onCancel={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Создать запись' }))
    expect(create).not.toHaveBeenCalled()
    expect(screen.getByText('поле «Название» обязательно для заполнения')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Название*'), 'Лофт')
    expect(screen.queryByText('поле «Название» обязательно для заполнения')).not.toBeInTheDocument()
  })

  it('создание: название берётся из title_field, onSaved получает запись, dirty сообщается', async () => {
    const user = userEvent.setup()
    const { api, create } = mockApi()
    const onSaved = vi.fn()
    const onDirtyChange = vi.fn()
    render(
      <FormRecordEditor form={form} schema={schema} api={api} onSaved={onSaved} onCancel={vi.fn()} onDirtyChange={onDirtyChange} />,
    )
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
    await user.type(screen.getByLabelText('Название*'), 'Лофт на Кутузовском')
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Лофт на Кутузовском')
    await user.click(screen.getByRole('button', { name: 'Создать запись' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(create).toHaveBeenCalledWith('form-1', { title: 'Лофт на Кутузовском', data: { name: 'Лофт на Кутузовском' } })
  })

  it('серверные 400 fields ложатся инлайн; 409 — баннер «не опубликована»', async () => {
    const user = userEvent.setup()
    const { api } = mockApi({
      create: vi.fn(async () => {
        throw new FormsApiError(400, 'значения не прошли проверку', [
          { field_id: 'budget', code: 'min', message: 'поле «Бюджет»: не меньше 0' },
        ])
      }),
    })
    const { unmount } = render(
      <FormRecordEditor form={form} schema={schema} api={api} onSaved={vi.fn()} onCancel={vi.fn()} />,
    )
    await user.type(screen.getByLabelText('Название*'), 'x')
    await user.click(screen.getByRole('button', { name: 'Создать запись' }))
    expect(await screen.findByText('поле «Бюджет»: не меньше 0')).toBeInTheDocument()
    expect(screen.getByLabelText('Бюджет')).toHaveAttribute('aria-invalid', 'true')
    unmount()

    const conflict = mockApi({ create: vi.fn(async () => { throw new FormsApiError(409, 'форма не опубликована') }) })
    render(<FormRecordEditor form={form} schema={schema} api={conflict.api} onSaved={vi.fn()} onCancel={vi.fn()} />)
    await user.type(screen.getByLabelText('Название*'), 'x')
    await user.click(screen.getByRole('button', { name: 'Создать запись' }))
    expect(await screen.findByText(/Форма не опубликована/)).toBeInTheDocument()
  })

  it('редактирование старой записи: баннер «Форма обновлена» и бейдж НОВОЕ; update с прежним id', async () => {
    const user = userEvent.setup()
    const { api, update } = mockApi()
    const oldSchema: SchemaDocument = { ...schema, fields: schema.fields.filter((x) => x.id !== 'note') }
    const onSaved = vi.fn()
    render(
      <FormRecordEditor
        form={form}
        schema={schema}
        recordSchema={oldSchema}
        record={rec(1, { form_version: 2 })}
        api={api}
        ctx={ctx}
        onSaved={onSaved}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText(/Форма обновлена \(v2 → v3\)/)).toBeInTheDocument()
    expect(screen.getByText('НОВОЕ')).toBeInTheDocument()
    // У существующей записи файлов нет в схеме — но заголовок из title_field на месте.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Запись 1')
    await user.click(screen.getAllByRole('button', { name: 'Сохранить' })[0]!)
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(update).toHaveBeenCalledWith('form-1', 'r1', expect.objectContaining({ title: 'Запись 1' }))
  })

  it('без title_field название вводится вручную и обязательно', async () => {
    const user = userEvent.setup()
    const { api, create } = mockApi()
    render(
      <FormRecordEditor form={form} schema={{ ...schema, title_field: '' }} api={api} onSaved={vi.fn()} onCancel={vi.fn()} />,
    )
    await user.type(screen.getByLabelText('Название*'), 'x')
    await user.click(screen.getByRole('button', { name: 'Создать запись' }))
    expect(screen.getByText('укажите название записи')).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('Название записи'), 'Ручное')
    await user.click(screen.getByRole('button', { name: 'Создать запись' }))
    await waitFor(() => expect(create).toHaveBeenCalledWith('form-1', expect.objectContaining({ title: 'Ручное' })))
  })
})
