import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { Combobox } from '@wowhaus-24/ui-react'

import { BrainApiError } from '../api'
import { AiFieldCell } from './AiFieldCell'
import { AiFieldColumnMenu } from './AiFieldColumnMenu'
import { AiFieldDialog } from './AiFieldDialog'
import { BrainDialog } from './Dialog'
import type { AiField, FieldPreview } from './types'

const field: AiField = {
  id: 'f1',
  module: 'oup',
  entity_type: 'lead',
  scope: '',
  label: 'Теплота лида',
  kind: 'categorize',
  prompt: '',
  params: { options: ['Горячий', 'Тёплый'] },
  model: '',
  on_change: false,
  visibility: 'private',
  enabled: true,
  created_by: 'u1',
  can: { edit: true },
}

describe('AiFieldCell', () => {
  it('нет значения — тире с подписью для скринридера', () => {
    render(<AiFieldCell label="Теплота" />)
    expect(screen.getByLabelText('Теплота: не заполнено')).toBeInTheDocument()
  })

  it('готово — текст; длинный сворачивается и раскрывается по клику', async () => {
    const long = 'Очень длинное описание записи. '.repeat(8)
    const { rerender } = render(<AiFieldCell value={{ status: 'fresh', text: 'Горячий' }} />)
    expect(screen.getByText('Горячий')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()

    rerender(<AiFieldCell value={{ status: 'fresh', text: long }} />)
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(btn)
    expect(btn).toHaveAttribute('aria-expanded', 'true')
  })

  it('устарело — текст и метка «запись изменилась» с подсказкой', () => {
    render(<AiFieldCell value={{ status: 'stale', text: 'Тёплый' }} />)
    expect(screen.getByText('Тёплый')).toBeInTheDocument()
    expect(screen.getByText('запись изменилась')).toHaveAttribute('title', expect.stringMatching(/обновите колонку/))
  })

  it('в работе — «Считаю…» в живой области', () => {
    render(<AiFieldCell value={{ status: 'computing', text: '' }} />)
    expect(screen.getByText('Считаю…')).toHaveAttribute('aria-live', 'polite')
  })

  it('ошибка — текст сервера или по коду и «Повторить»', async () => {
    const retry = vi.fn()
    const { rerender } = render(<AiFieldCell label="Теплота" value={{ status: 'failed', text: '', error_code: 'daily_limit' }} onRetry={retry} />)
    expect(screen.getByText('Дневной лимит колонки исчерпан')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Повторить: Теплота' }))
    expect(retry).toHaveBeenCalledTimes(1)

    rerender(<AiFieldCell value={{ status: 'failed', text: '', error: 'ИИ отключён для вашего отдела' }} />)
    expect(screen.getByText('ИИ отключён для вашего отдела')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('AiFieldColumnMenu', () => {
  const handlers = () => ({ onFillEmpty: vi.fn(), onRefreshAll: vi.fn(), onConfigure: vi.fn(), onRemove: vi.fn() })

  it('пункты по порядку; «Настроить…» и «Удалить…» — только автору', async () => {
    const h = handlers()
    const { rerender } = render(<AiFieldColumnMenu field={field} dailyLimit={500} {...h} />)
    await userEvent.click(screen.getByRole('button', { name: /Колонка «Теплота лида»: действия/ }))
    const menu = screen.getByRole('menu')
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      'Заполнить пустые',
      'Обновить все',
      'Настроить…',
      'Удалить…',
    ])
    expect(within(menu).getByText('Лимит колонки: 500 расчётов в сутки')).toBeInTheDocument()
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Обновить все' }))
    expect(h.onRefreshAll).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()

    rerender(<AiFieldColumnMenu field={{ ...field, can: { edit: false } }} {...h} />)
    await userEvent.click(screen.getByRole('button', { name: /действия/ }))
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Заполнить пустые', 'Обновить все'])
  })

  it('остаток лимита, Esc возвращает фокус на кнопку, busy блокирует заполнение', async () => {
    const h = handlers()
    render(<AiFieldColumnMenu field={field} dailyLimit={500} limitLeft={120} busy {...h} />)
    const btn = screen.getByRole('button', { name: /действия/ })
    await userEvent.click(btn)
    expect(screen.getByText('Сегодня осталось 120 из 500 расчётов')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Заполнить пустые' })).toBeDisabled()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(btn).toHaveFocus()
  })
})

describe('BrainDialog', () => {
  function Host({ onClose = () => {}, busy = false }: { onClose?: () => void; busy?: boolean }) {
    const [open, setOpen] = useState(false)
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Открыть
        </button>
        <BrainDialog
          open={open}
          onClose={() => {
            onClose()
            setOpen(false)
          }}
          title="Окно"
          busy={busy}
          footer={<button type="button">Сохранить</button>}
        >
          <input aria-label="Поле" />
        </BrainDialog>
      </>
    )
  }

  it('role=dialog с названием; фокус внутри; Esc закрывает и возвращает фокус на кнопку', async () => {
    const onClose = vi.fn()
    render(<Host onClose={onClose} />)
    const opener = screen.getByRole('button', { name: 'Открыть' })
    await userEvent.click(opener)
    const dlg = screen.getByRole('dialog', { name: 'Окно' })
    expect(dlg).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByLabelText('Поле')).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(opener).toHaveFocus()
  })

  it('Tab не выходит из окна, Shift+Tab с первого — на последний', async () => {
    render(<Host />)
    await userEvent.click(screen.getByRole('button', { name: 'Открыть' }))
    const field = screen.getByLabelText('Поле')
    field.focus()
    await userEvent.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Закрыть' })).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Сохранить' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Закрыть' })).toHaveFocus()
  })

  it('Esc закрывает открытый список общего Combobox, а не окно', async () => {
    render(
      <BrainDialog open onClose={() => {}} title="Окно">
        <Combobox options={[{ value: 'a', label: 'Первый' }]} value="" onChange={() => {}} ariaLabel="Выбор" />
      </BrainDialog>,
    )
    const combo = screen.getByRole('combobox')
    await userEvent.click(combo)
    expect(combo).toHaveAttribute('aria-expanded', 'true')
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(combo).toHaveAttribute('aria-expanded', 'false')
  })

  it('пока идёт сохранение (busy), Esc и крестик не закрывают', async () => {
    const onClose = vi.fn()
    render(<Host onClose={onClose} busy />)
    await userEvent.click(screen.getByRole('button', { name: 'Открыть' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Закрыть' })).toBeDisabled()
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('AiFieldDialog', () => {
  const makeApi = (over: Partial<Record<string, unknown>> = {}) => ({
    fields: {
      create: vi.fn(async (b: { label: string }) => ({ ...field, label: b.label })),
      update: vi.fn(async () => ({ field, values_reset: false })),
      preview: vi.fn(async () => ({ preview_id: 'p1' })),
      getPreview: vi.fn(
        async (): Promise<FieldPreview> => ({
          id: 'p1',
          status: 'done',
          rows: [
            { entity_id: 'l1', title: 'Офис на Мясницкой', text: 'Горячий', done: true },
            { entity_id: 'l2', title: 'Склад', text: '', error: 'ИИ не успел ответить', done: true },
          ],
          cost_usd: 0.012,
        }),
      ),
      ...over,
    },
  })
  const open = (api: ReturnType<typeof makeApi>, extra: Partial<React.ComponentProps<typeof AiFieldDialog>> = {}) =>
    render(<AiFieldDialog api={api} open onClose={() => {}} module="oup" entityType="lead" {...extra} />)

  it('пустое название и «Свой промпт» без текста — ошибки у полей, запрос не уходит', async () => {
    const api = makeApi()
    open(api)
    await userEvent.click(screen.getByRole('button', { name: 'Создать поле' }))
    expect(screen.getByText('Дайте колонке название.')).toBeInTheDocument()
    expect(api.fields.create).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/Название колонки/)).toHaveFocus()
  })

  it('категория: варианты добавляются Enter-ом, дубль отвергается, создание шлёт описание', async () => {
    const api = makeApi()
    const onSaved = vi.fn()
    const onClose = vi.fn()
    open(api, { onSaved, onClose })
    await userEvent.type(screen.getByLabelText(/Название колонки/), 'Теплота')
    // Вид — общий Combobox.
    await userEvent.click(screen.getByRole('combobox', { name: 'Что заполнять' }))
    await userEvent.click(screen.getByRole('option', { name: /Категория/ }))
    await userEvent.type(screen.getByLabelText('Новый вариант'), 'Горячий{Enter}')
    await userEvent.type(screen.getByLabelText('Новый вариант'), 'горячий{Enter}')
    expect(screen.getByText('Вариант «горячий» уже есть.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Создать поле' }))
    expect(screen.getByText('Добавьте хотя бы два варианта.')).toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText('Новый вариант'))
    await userEvent.type(screen.getByLabelText('Новый вариант'), 'Холодный')
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }))
    await userEvent.click(screen.getByRole('button', { name: 'Создать поле' }))
    await waitFor(() => expect(api.fields.create).toHaveBeenCalledTimes(1))
    expect(api.fields.create).toHaveBeenCalledWith({
      module: 'oup',
      entity_type: 'lead',
      label: 'Теплота',
      kind: 'categorize',
      prompt: '',
      params: { options: ['Горячий', 'Холодный'] },
      on_change: false,
      visibility: 'private',
    })
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ label: 'Теплота' }), { created: true, valuesReset: false })
    expect(onClose).toHaveBeenCalled()
  })

  it('«Видна всем» — только управляющему и уходит как public', async () => {
    const api = makeApi()
    const { unmount } = open(api)
    expect(screen.queryByText('Видна всем')).toBeNull()
    unmount()

    open(api, { canManage: true })
    await userEvent.type(screen.getByLabelText(/Название колонки/), 'Итог')
    await userEvent.click(screen.getByRole('switch', { name: /Видна всем/ }))
    await userEvent.click(screen.getByRole('switch', { name: /Обновлять при изменении/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Создать поле' }))
    await waitFor(() => expect(api.fields.create).toHaveBeenCalled())
    expect(api.fields.create).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'public', on_change: true, kind: 'summary' }))
  })

  it('ошибка сервера с полем подсвечивает его, а не общее сообщение', async () => {
    const api = makeApi({
      create: vi.fn(async () => {
        throw new BrainApiError(400, 'Название длиннее 60 символов.', { code: 'bad_request', field: 'label' })
      }),
    })
    open(api)
    await userEvent.type(screen.getByLabelText(/Название колонки/), 'Колонка')
    await userEvent.click(screen.getByRole('button', { name: 'Создать поле' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Название длиннее 60 символов.')
    // Ошибка привязана к полю: aria-invalid + aria-describedby на её узел.
    const input = screen.getByLabelText(/Название колонки/)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input.getAttribute('aria-describedby')).toBe(alert.id)
  })

  it('общая ошибка: «HTTP 502» не показываем', async () => {
    const api = makeApi({
      create: vi.fn(async () => {
        throw new BrainApiError(502, 'HTTP 502')
      }),
    })
    open(api)
    await userEvent.type(screen.getByLabelText(/Название колонки/), 'Колонка')
    await userEvent.click(screen.getByRole('button', { name: 'Создать поле' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Не получилось. Попробуйте ещё раз.')
  })

  it('правка: вид не меняется, сохраняется PATCH и сообщается values_reset', async () => {
    const api = makeApi({ update: vi.fn(async () => ({ field, values_reset: true })) })
    const onSaved = vi.fn()
    open(api, { field, onSaved })
    expect(screen.getByRole('heading', { name: 'Настроить поле ИИ' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Что заполнять' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/Название колонки/), ' 2')
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(api.fields.update).toHaveBeenCalled())
    expect(api.fields.update).toHaveBeenCalledWith('f1', {
      label: 'Теплота лида 2',
      prompt: '',
      params: { options: ['Горячий', 'Тёплый'] },
      on_change: false,
    })
    expect(onSaved).toHaveBeenCalledWith(field, { created: false, valuesReset: true })
  })

  it('проба: ставится на первые 3 записи, показывает результаты, ошибки и стоимость; без записей кнопки нет', async () => {
    const api = makeApi()
    const { unmount } = open(api, { previewIds: ['l1', 'l2', 'l3', 'l4'] })
    await userEvent.type(screen.getByLabelText(/Название колонки/), 'Кратко')
    await userEvent.click(screen.getByRole('button', { name: 'Попробовать на 3 строках' }))
    expect(await screen.findByText('Офис на Мясницкой')).toBeInTheDocument()
    expect(api.fields.preview).toHaveBeenCalledWith(expect.objectContaining({ kind: 'summary', entity_ids: ['l1', 'l2', 'l3'] }))
    expect(screen.getByText('Горячий')).toBeInTheDocument()
    expect(screen.getByText('ИИ не успел ответить')).toBeInTheDocument()
    expect(screen.getByText(/Стоимость пробы: 0,01/)).toBeInTheDocument()
    // Правка описания сбрасывает пробу: она уже про другое.
    await userEvent.type(screen.getByLabelText(/Название колонки/), '!')
    expect(screen.queryByText('Горячий')).toBeNull()
    unmount()

    open(api)
    expect(screen.queryByRole('button', { name: /Попробовать/ })).toBeNull()
  })

  it('проба: «не больше двух проб сразу» (429 too_many) — текст сервера, без «HTTP 429»', async () => {
    const msg = 'Уже идут две пробы — дождитесь их результата.'
    const api = makeApi({
      preview: vi.fn(async () => {
        throw new BrainApiError(429, msg, { code: 'too_many', error: msg })
      }),
    })
    open(api, { previewIds: ['l1'] })
    await userEvent.type(screen.getByLabelText(/Название колонки/), 'Кратко')
    await userEvent.click(screen.getByRole('button', { name: 'Попробовать на 1 строке' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(msg)
    expect(screen.queryByText(/HTTP/)).toBeNull()
  })

  it('в запросах нет model: выставлять её вправе только управляющий, диалог её не трогает', async () => {
    const api = makeApi()
    open(api, { canManage: true })
    await userEvent.type(screen.getByLabelText(/Название колонки/), 'Итог')
    await userEvent.click(screen.getByRole('button', { name: 'Создать поле' }))
    await waitFor(() => expect(api.fields.create).toHaveBeenCalled())
    expect(api.fields.create.mock.calls[0]![0]).not.toHaveProperty('model')
  })

  it('записи формы: scope (id формы) уходит в создание и в пробу; без scope ключа в теле нет', async () => {
    const api = makeApi()
    const { unmount } = open(api, { module: 'forms', entityType: 'form_record', scope: 'form-7', previewIds: ['r1'] })
    await userEvent.type(screen.getByLabelText(/Название колонки/), 'Итог')
    await userEvent.click(screen.getByRole('button', { name: 'Попробовать на 1 строке' }))
    await waitFor(() => expect(api.fields.preview).toHaveBeenCalled())
    expect(api.fields.preview).toHaveBeenCalledWith(expect.objectContaining({ module: 'forms', entity_type: 'form_record', scope: 'form-7', entity_ids: ['r1'] }))
    await userEvent.click(screen.getByRole('button', { name: 'Создать поле' }))
    await waitFor(() => expect(api.fields.create).toHaveBeenCalled())
    expect(api.fields.create).toHaveBeenCalledWith(expect.objectContaining({ module: 'forms', entity_type: 'form_record', scope: 'form-7' }))
    unmount()

    const api2 = makeApi()
    open(api2)
    await userEvent.type(screen.getByLabelText(/Название колонки/), 'Итог')
    await userEvent.click(screen.getByRole('button', { name: 'Создать поле' }))
    await waitFor(() => expect(api2.fields.create).toHaveBeenCalled())
    expect(api2.fields.create.mock.calls[0]![0]).not.toHaveProperty('scope')
  })

  it('ошибка 400 по полю без места в форме (scope) — общим блоком, сообщение сервера не теряется', async () => {
    const api = makeApi({
      create: vi.fn(async () => {
        throw new BrainApiError(400, 'Выберите форму.', { code: 'bad_request', field: 'scope' })
      }),
    })
    open(api, { module: 'forms', entityType: 'form_record' })
    await userEvent.type(screen.getByLabelText(/Название колонки/), 'Итог')
    await userEvent.click(screen.getByRole('button', { name: 'Создать поле' }))
    // Поля scope в форме нет — сообщение сервера не теряется, а выводится общим блоком.
    expect(await screen.findByRole('alert')).toHaveTextContent('Выберите форму.')
  })
})
