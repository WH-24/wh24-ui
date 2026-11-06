import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { BrainApiError } from '../api'
import { MemoryImportDialog } from './MemoryImportDialog'
import { MemoryPanel } from './MemoryPanel'
import { linesLabel, parseImportText } from './labels'
import type { MemoryApi } from './client'
import type { MemoryItem, UserMemory } from './types'

const item = (id: string, kind: MemoryItem['kind'], text: string, source: MemoryItem['source'] = 'manual'): MemoryItem => ({ id, kind, text, source })

function memory(over: Partial<UserMemory> = {}): UserMemory {
  return {
    enabled: true,
    nickname: '',
    role: '',
    items: [],
    limits: { max_items: 100, max_text: 300 },
    ...over,
  }
}

function makeApi(initial: UserMemory) {
  let state = initial
  const memoryApi: MemoryApi = {
    get: vi.fn(async () => state),
    update: vi.fn(async (patch) => {
      state = { ...state, ...patch }
      return state
    }),
    addItem: vi.fn(async (body) => {
      const it = item(`n${state.items.length + 1}`, body.kind, body.text)
      state = { ...state, items: [...state.items, it] }
      return it
    }),
    removeItem: vi.fn(async (id) => {
      state = { ...state, items: state.items.filter((i) => i.id !== id) }
    }),
    forget: vi.fn(async () => {
      state = { ...state, items: [], nickname: '', role: '' }
    }),
    importText: vi.fn(async () => ({ added: 0, skipped: 0, items: [] })),
  }
  return { api: { memory: memoryApi }, memoryApi }
}

describe('parseImportText', () => {
  it('убирает маркеры и нумерацию, пустые строки и дубли', () => {
    const r = parseImportText('- любит кратко\n* Любит кратко\n1) проект Север\n\n• работает в ОУП\n2. ещё', 300)
    expect(r.lines).toEqual(['любит кратко', 'проект Север', 'работает в ОУП', 'ещё'])
    expect(r.overLimit).toBe(0)
  })

  it('больше 50 строк — лишние отмечаются; длинные считаются', () => {
    const text = Array.from({ length: 53 }, (_, i) => `строка ${i}`).join('\n') + '\n' + 'я'.repeat(400)
    const r = parseImportText(text, 300)
    expect(r.lines).toHaveLength(50)
    expect(r.overLimit).toBe(4)
    expect(parseImportText('я'.repeat(301), 300).tooLong).toBe(1)
  })

  it('linesLabel склоняет', () => {
    expect([1, 2, 5, 11, 21].map(linesLabel)).toEqual(['1 строка', '2 строки', '5 строк', '11 строк', '21 строка'])
  })
})

describe('MemoryPanel', () => {
  it('загрузка → разделы; ошибка загрузки с «Повторить»', async () => {
    const { api, memoryApi } = makeApi(memory({ nickname: 'Тарас', role: 'владелец' }))
    vi.mocked(memoryApi.get).mockRejectedValueOnce(new BrainApiError(500, 'HTTP 500'))
    render(<MemoryPanel api={api} />)
    expect(screen.getByRole('status')).toHaveTextContent('Загружаю память…')
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить память.')
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByLabelText('Как к вам обращаться')).toHaveValue('Тарас')
    expect(screen.getByLabelText('Роль')).toHaveValue('владелец')
    for (const h of ['Использовать память', 'Мои предпочтения', 'С кем работаю', 'Факты о работе', 'Что ИИ запомнил сам']) {
      expect(screen.getByRole('heading', { name: h })).toBeInTheDocument()
    }
  })

  it('обращение сохраняется по потере фокуса и Enter, «Сохранено» в живой области; без изменений запроса нет', async () => {
    const { api, memoryApi } = makeApi(memory())
    render(<MemoryPanel api={api} />)
    const nick = await screen.findByLabelText('Как к вам обращаться')
    await userEvent.click(nick)
    await userEvent.tab()
    expect(memoryApi.update).not.toHaveBeenCalled()
    await userEvent.type(nick, 'Тарас{Enter}')
    await waitFor(() => expect(memoryApi.update).toHaveBeenCalledWith({ nickname: 'Тарас' }))
    expect(await screen.findByText('Сохранено')).toBeInTheDocument()
    const role = screen.getByLabelText('Роль')
    await userEvent.type(role, 'владелец')
    await userEvent.tab()
    await waitFor(() => expect(memoryApi.update).toHaveBeenCalledWith({ role: 'владелец' }))
  })

  it('ошибка сохранения обращения — под полем, без «HTTP 500»', async () => {
    const { api, memoryApi } = makeApi(memory())
    vi.mocked(memoryApi.update).mockRejectedValueOnce(new BrainApiError(500, 'HTTP 500'))
    render(<MemoryPanel api={api} />)
    await userEvent.type(await screen.findByLabelText('Как к вам обращаться'), 'Т{Enter}')
    expect(await screen.findByText('Не удалось сохранить.')).toBeInTheDocument()
  })

  it('переключатель «Использовать память»: сохраняет, при ошибке откатывает и сообщает', async () => {
    const { api, memoryApi } = makeApi(memory())
    const onToast = vi.fn()
    render(<MemoryPanel api={api} onToast={onToast} />)
    const sw = await screen.findByRole('switch')
    expect(sw).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(sw)
    await waitFor(() => expect(memoryApi.update).toHaveBeenCalledWith({ enabled: false }))
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
    vi.mocked(memoryApi.update).mockRejectedValueOnce(new BrainApiError(500, 'HTTP 500'))
    await userEvent.click(screen.getByRole('switch'))
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('Не удалось переключить память.', 'error'))
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('добавление и удаление предпочтения; пустая строка не отправляется', async () => {
    const { api, memoryApi } = makeApi(memory())
    render(<MemoryPanel api={api} />)
    const input = await screen.findByLabelText('Мои предпочтения: новая запись')
    const add = within(input.closest('form')!).getByRole('button', { name: 'Добавить' })
    expect(add).toBeDisabled()
    await userEvent.type(input, 'Отвечай коротко')
    await userEvent.click(add)
    await waitFor(() => expect(memoryApi.addItem).toHaveBeenCalledWith({ kind: 'preference', text: 'Отвечай коротко' }))
    const list = await screen.findByRole('list', { name: 'Мои предпочтения' })
    expect(within(list).getByText('Отвечай коротко')).toBeInTheDocument()
    expect(input).toHaveValue('')
    await userEvent.click(screen.getByRole('button', { name: 'Удалить: Отвечай коротко' }))
    await waitFor(() => expect(memoryApi.removeItem).toHaveBeenCalledWith('n1'))
    await waitFor(() => expect(screen.queryByRole('list', { name: 'Мои предпочтения' })).toBeNull())
  })

  it('неудачное удаление возвращает запись и сообщает', async () => {
    const { api, memoryApi } = makeApi(memory({ items: [item('a', 'fact', 'Веду проект Север')] }))
    vi.mocked(memoryApi.removeItem).mockRejectedValueOnce(new BrainApiError(500, 'HTTP 500'))
    const onToast = vi.fn()
    render(<MemoryPanel api={api} onToast={onToast} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Удалить: Веду проект Север' }))
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('Не удалось удалить запись.', 'error'))
    expect(screen.getByText('Веду проект Север')).toBeInTheDocument()
  })

  it('«Что ИИ запомнил сам» — только записи ИИ, с видом; в обычных разделах их нет', async () => {
    const { api } = makeApi(
      memory({
        items: [item('1', 'fact', 'Ручной факт'), item('2', 'preference', 'ИИ запомнил: кратко', 'ai'), item('3', 'person', 'Иван Петров')],
      }),
    )
    render(<MemoryPanel api={api} />)
    const ai = await screen.findByRole('list', { name: 'Что ИИ запомнил сам' })
    expect(within(ai).getByText('ИИ запомнил: кратко')).toBeInTheDocument()
    expect(within(ai).getByText('Предпочтение')).toBeInTheDocument()
    expect(within(ai).queryByText('Ручной факт')).toBeNull()
    expect(within(screen.getByRole('list', { name: 'Факты о работе' })).getByText('Ручной факт')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'С кем работаю' })).getByText('Иван Петров')).toBeInTheDocument()
    // В разделе ИИ нет поля добавления.
    expect(screen.queryByLabelText('Что ИИ запомнил сам: новая запись')).toBeNull()
  })

  it('«С кем работаю»: выбор коллеги из списка и свободный ввод; уже добавленные в списке не предлагаются', async () => {
    const { api, memoryApi } = makeApi(memory({ items: [item('p', 'person', 'Анна Сидорова')] }))
    render(<MemoryPanel api={api} peopleOptions={[{ id: '1', name: 'Анна Сидорова' }, { id: '2', name: 'Иван Петров' }]} />)
    const combo = await screen.findByRole('combobox', { name: 'Выбрать коллегу' })
    await userEvent.click(combo)
    expect(screen.queryByRole('option', { name: /Анна Сидорова/ })).toBeNull()
    await userEvent.click(await screen.findByRole('option', { name: /Иван Петров/ }))
    await waitFor(() => expect(memoryApi.addItem).toHaveBeenCalledWith({ kind: 'person', text: 'Иван Петров' }))
    const input = screen.getByLabelText('С кем работаю: новая запись')
    await userEvent.type(input, 'Внешний подрядчик{Enter}')
    await waitFor(() => expect(memoryApi.addItem).toHaveBeenCalledWith({ kind: 'person', text: 'Внешний подрядчик' }))
  })

  it('предел записей: поля добавления выключены, счётчик; 409 от сервера — понятный текст', async () => {
    const full = memory({ items: [item('1', 'fact', 'а'), item('2', 'fact', 'б')], limits: { max_items: 2, max_text: 300 } })
    const { api } = makeApi(full)
    render(<MemoryPanel api={api} />)
    expect(await screen.findByText(/Записей: 2 из 2 — предел достигнут/)).toBeInTheDocument()
    expect(screen.getByLabelText('Мои предпочтения: новая запись')).toBeDisabled()

  })

  it('409 при добавлении (запись успели добавить с другого устройства) — понятный текст про предел', async () => {
    const { api, memoryApi } = makeApi(memory())
    vi.mocked(memoryApi.addItem).mockRejectedValueOnce(new BrainApiError(409, 'лимит'))
    render(<MemoryPanel api={api} />)
    await userEvent.type(await screen.findByLabelText('Факты о работе: новая запись'), 'новый{Enter}')
    expect(await screen.findByText(/Достигнут предел — 100 записей/)).toBeInTheDocument()
  })

  it('«Забыть всё»: подтверждение, очистка и уведомление; отмена ничего не делает', async () => {
    const { api, memoryApi } = makeApi(memory({ nickname: 'Тарас', items: [item('1', 'fact', 'Факт')] }))
    const onToast = vi.fn()
    render(<MemoryPanel api={api} onToast={onToast} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Забыть всё' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Отмена' }))
    expect(memoryApi.forget).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Забыть всё' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Забыть всё' }))
    await waitFor(() => expect(memoryApi.forget).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('Память очищена.', 'info'))
    expect(screen.getByLabelText('Как к вам обращаться')).toHaveValue('')
    expect(screen.getByText('Записей: 0 из 100')).toBeInTheDocument()
  })

  it('импорт: открывается из панели, добавляет записи и сообщает итог', async () => {
    const { api, memoryApi } = makeApi(memory())
    vi.mocked(memoryApi.importText).mockResolvedValueOnce({ added: 2, skipped: 1, items: [item('i1', 'fact', 'Любит кратко', 'import'), item('i2', 'fact', 'Работает в ОУП', 'import')] })
    const onToast = vi.fn()
    render(<MemoryPanel api={api} onToast={onToast} />)
    await userEvent.click(await screen.findByRole('button', { name: /Импорт памяти/ }))
    const dlg = screen.getByRole('dialog', { name: 'Импорт памяти' })
    expect(within(dlg).getByRole('button', { name: 'Импортировать' })).toBeDisabled()
    await userEvent.type(within(dlg).getByLabelText('Текст для импорта'), '- Любит кратко{Enter}- Работает в ОУП{Enter}- Любит кратко')
    expect(within(dlg).getByRole('status')).toHaveTextContent('Распознано: 2 строки.')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Импортировать (2)' }))
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('Импортировано записей: 2, пропущено: 1.', 'info'))
    expect(memoryApi.importText).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('MemoryImportDialog', () => {
  it('ошибка импорта остаётся в окне', async () => {
    const importText = vi.fn().mockRejectedValue(new BrainApiError(400, 'Слишком много строк.', { field: 'text' }))
    render(<MemoryImportDialog api={{ memory: { importText } }} open onClose={() => {}} />)
    await userEvent.type(screen.getByLabelText('Текст для импорта'), 'раз')
    await userEvent.click(screen.getByRole('button', { name: 'Импортировать (1)' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Слишком много строк.')
  })

  it('больше 50 строк и слишком длинные — предупреждения', async () => {
    render(<MemoryImportDialog api={{ memory: { importText: vi.fn() } }} open onClose={() => {}} maxText={10} />)
    const ta = screen.getByLabelText('Текст для импорта')
    await userEvent.click(ta)
    await userEvent.paste(Array.from({ length: 52 }, (_, i) => `строка номер ${i}`).join('\n'))
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Распознано: 50 строк.')
    expect(status).toHaveTextContent('ещё 2 не войдёт')
    expect(status).toHaveTextContent('Слишком длинных (больше 10 знаков)')
  })
})
