import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BrainApiError } from '../api'
import type { AdminApi } from './client'
import { IndexStatusDialog } from './IndexStatusDialog'
import { ModelSelect } from './ModelSelect'
import { ModelSettingsDialog } from './ModelSettingsDialog'
import { coveragePercent, formatCount, relativeTime } from './format'
import type { EmbeddingsState, IndexStatus } from './types'

afterEach(() => vi.useRealTimers())

const models = [
  { id: 'gpt-5.5', label: 'GPT-5.5' },
  { id: 'gpt-5.5-pro', label: 'GPT-5.5 Pro' },
]

describe('format', () => {
  it('coveragePercent: целое, без деления на ноль, не больше 100', () => {
    expect(coveragePercent(undefined)).toBe(0)
    expect(coveragePercent({ embedded: 0, total: 0 })).toBe(0)
    expect(coveragePercent({ embedded: 83, total: 100 })).toBe(83)
    expect(coveragePercent({ embedded: 2, total: 3 })).toBe(66)
    expect(coveragePercent({ embedded: 9, total: 3 })).toBe(100)
  })

  it('relativeTime', () => {
    const now = new Date('2026-11-06T12:00:00Z').getTime()
    expect(relativeTime(undefined, now)).toBeNull()
    expect(relativeTime('мусор', now)).toBeNull()
    expect(relativeTime('2026-11-06T11:59:40Z', now)).toBe('только что')
    expect(relativeTime('2026-11-06T11:55:00Z', now)).toBe('5 мин назад')
    expect(relativeTime('2026-11-06T09:00:00Z', now)).toBe('3 ч назад')
    expect(relativeTime('2026-11-01T09:00:00Z', now)).toMatch(/ноя/)
  })

  it('formatCount группирует тысячи', () => {
    expect(formatCount(12345)).toBe('12 345')
    expect(formatCount(undefined)).toBe('0')
  })
})

describe('ModelSelect', () => {
  it('показывает модель по умолчанию, когда выбор пуст; выбор другой вызывает onChange', async () => {
    const onChange = vi.fn()
    render(<ModelSelect models={models} value="" defaultModel="gpt-5.5" onChange={onChange} />)
    const input = screen.getByRole('combobox')
    expect(input).toHaveValue('GPT-5.5')
    await userEvent.click(input)
    expect(screen.getByRole('option', { name: /GPT-5\.5 .*по умолчанию/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('option', { name: /GPT-5\.5 Pro/ }))
    expect(onChange).toHaveBeenCalledWith('gpt-5.5-pro')
  })

  it('«Настроить модели…» — последний пункт: вызывает onConfigure и не меняет выбор', async () => {
    const onChange = vi.fn()
    const onConfigure = vi.fn()
    render(<ModelSelect models={models} value="gpt-5.5-pro" onChange={onChange} onConfigure={onConfigure} />)
    await userEvent.click(screen.getByRole('combobox'))
    const options = screen.getAllByRole('option')
    expect(options[options.length - 1]).toHaveTextContent('Настроить модели…')
    await userEvent.click(options[options.length - 1]!)
    expect(onConfigure).toHaveBeenCalledTimes(1)
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('combobox')).toHaveValue('GPT-5.5 Pro')
  })

  it('без моделей и без onConfigure — ничего не рисует', () => {
    const { container } = render(<ModelSelect models={[]} value="" onChange={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})

function embeddings(over: Partial<EmbeddingsState> = {}): EmbeddingsState {
  return {
    provider: 'local',
    active_model: 'multilingual-e5-large',
    target_model: 'multilingual-e5-large',
    switching: false,
    available: { local: true, relay: true },
    coverage: [{ model: 'multilingual-e5-large', embedded: 830, total: 1000, pending: 170, failed: 0 }],
    ...over,
  }
}

function makeAdmin(state: EmbeddingsState): { admin: AdminApi; calls: Record<string, ReturnType<typeof vi.fn>> } {
  let cur = state
  const calls = {
    setDefaultModel: vi.fn(async (m: string) => m),
    get: vi.fn(async () => cur),
    put: vi.fn(async (p: 'local' | 'relay') => {
      cur = embeddings({ provider: p, switching: true, target_model: 'text-embedding-3-large@1024', coverage: [{ model: 'text-embedding-3-large@1024', embedded: 0, total: 1000, pending: 1000, failed: 0 }] })
      return cur
    }),
    activate: vi.fn(async () => {
      cur = embeddings({ provider: 'relay', active_model: 'text-embedding-3-large@1024', target_model: 'text-embedding-3-large@1024' })
      return cur
    }),
    check: vi.fn(async () => ({ provider: 'local' as const, model: 'multilingual-e5-large', dims: 1024, ms: 412 })),
    status: vi.fn(),
    sync: vi.fn(async () => {}),
    reindex: vi.fn(async () => {}),
  }
  return {
    admin: {
      setDefaultModel: calls.setDefaultModel,
      embeddings: { get: calls.get, put: calls.put, activate: calls.activate, check: calls.check },
      index: { status: calls.status, sync: calls.sync, reindex: calls.reindex },
    },
    calls,
  }
}

const modelsApi = { list: vi.fn(async () => ({ models, default_model: 'gpt-5.5' })) }

describe('ModelSettingsDialog', () => {
  it('загрузка → модель по умолчанию, провайдер, покрытие и предупреждение о переиндексации', async () => {
    const { admin } = makeAdmin(embeddings())
    render(<ModelSettingsDialog api={{ models: modelsApi, admin }} open onClose={() => {}} />)
    expect(screen.getByRole('status')).toHaveTextContent('Загружаю настройки…')
    expect(await screen.findByText(/Смена провайдера запускает переиндексацию/)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Модель по умолчанию' })).toHaveValue('GPT-5.5')
    expect(screen.getByRole('combobox', { name: 'Провайдер эмбеддингов' })).toHaveValue('Локальная модель')
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '83')
    expect(screen.getByText(/83% проиндексировано, считается: 170/)).toBeInTheDocument()
  })

  it('смена модели по умолчанию: PUT, «Сохранено», onChanged', async () => {
    const { admin, calls } = makeAdmin(embeddings())
    const onChanged = vi.fn()
    render(<ModelSettingsDialog api={{ models: modelsApi, admin }} open onClose={() => {}} onChanged={onChanged} />)
    const combo = await screen.findByRole('combobox', { name: 'Модель по умолчанию' })
    await userEvent.click(combo)
    await userEvent.click(await screen.findByRole('option', { name: 'GPT-5.5 Pro' }))
    await waitFor(() => expect(calls.setDefaultModel).toHaveBeenCalledWith('gpt-5.5-pro'))
    expect(await screen.findByText('Сохранено')).toBeInTheDocument()
    expect(onChanged).toHaveBeenCalledWith({ defaultModel: 'gpt-5.5-pro' })
  })

  it('смена провайдера: подтверждение → put → «идёт переиндексация» и кнопка переключения; отмена ничего не меняет', async () => {
    const { admin, calls } = makeAdmin(embeddings())
    render(<ModelSettingsDialog api={{ models: modelsApi, admin }} open onClose={() => {}} />)
    const combo = await screen.findByRole('combobox', { name: 'Провайдер эмбеддингов' })
    await userEvent.click(combo)
    await userEvent.click(await screen.findByRole('option', { name: /OpenAI через релей/ }))
    const confirm = screen.getAllByRole('dialog').at(-1)!
    expect(confirm).toHaveTextContent('Сменить провайдера на «OpenAI через релей»?')
    await userEvent.click(within(confirm).getByRole('button', { name: 'Отмена' }))
    expect(calls.put).not.toHaveBeenCalled()

    await userEvent.click(combo)
    await userEvent.click(await screen.findByRole('option', { name: /OpenAI через релей/ }))
    await userEvent.click(within(screen.getAllByRole('dialog').at(-1)!).getByRole('button', { name: 'Сменить' }))
    await waitFor(() => expect(calls.put).toHaveBeenCalledWith('relay'))
    expect(await screen.findByText(/Идёт переиндексация на модель/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Переключить поиск на новую модель' })).toBeInTheDocument()
    expect(screen.getByText(/Новая модель: 0% проиндексировано/)).toBeInTheDocument()
  })

  it('недоступный провайдер выбрать нельзя: пояснение, запрос не уходит', async () => {
    const { admin, calls } = makeAdmin(embeddings({ available: { local: true, relay: false } }))
    render(<ModelSettingsDialog api={{ models: modelsApi, admin }} open onClose={() => {}} />)
    await userEvent.click(await screen.findByRole('combobox', { name: 'Провайдер эмбеддингов' }))
    await userEvent.click(await screen.findByRole('option', { name: /не настроен в окружении/ }))
    expect(await screen.findByText(/не настроен в окружении сервиса — выбрать его нельзя/)).toBeInTheDocument()
    expect(calls.put).not.toHaveBeenCalled()
  })

  it('переключение поиска: при покрытии < 99% предупреждает; подтверждение вызывает activate', async () => {
    const { admin, calls } = makeAdmin(
      embeddings({
        provider: 'relay',
        switching: true,
        target_model: 'text-embedding-3-large@1024',
        coverage: [
          { model: 'multilingual-e5-large', embedded: 1000, total: 1000, pending: 0, failed: 0 },
          { model: 'text-embedding-3-large@1024', embedded: 400, total: 1000, pending: 600, failed: 2 },
        ],
      }),
    )
    render(<ModelSettingsDialog api={{ models: modelsApi, admin }} open onClose={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Переключить поиск на новую модель' }))
    const confirm = screen.getAllByRole('dialog').at(-1)!
    expect(confirm).toHaveTextContent('посчитана только на 40%')
    await userEvent.click(within(confirm).getByRole('button', { name: 'Переключить' }))
    await waitFor(() => expect(calls.activate).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Поиск переключён на новую модель.')).toBeInTheDocument()
    expect(screen.queryByText(/Идёт переиндексация/)).toBeNull()
  })

  it('«Проверить провайдера»: размерность и время; 502 — понятный текст', async () => {
    const { admin, calls } = makeAdmin(embeddings())
    render(<ModelSettingsDialog api={{ models: modelsApi, admin }} open onClose={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Проверить провайдера' }))
    expect(await screen.findByText(/размерность 1024, 412 мс/)).toBeInTheDocument()
    calls.check.mockRejectedValueOnce(new BrainApiError(502, 'HTTP 502'))
    await userEvent.click(screen.getByRole('button', { name: 'Проверить провайдера' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Провайдер не ответил или вернул вектор неверной формы.')
  })

  it('«Переиндексировать» только после подтверждения', async () => {
    const { admin, calls } = makeAdmin(embeddings())
    render(<ModelSettingsDialog api={{ models: modelsApi, admin }} open onClose={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Переиндексировать' }))
    expect(calls.reindex).not.toHaveBeenCalled()
    await userEvent.click(within(screen.getAllByRole('dialog').at(-1)!).getByRole('button', { name: 'Переиндексировать' }))
    await waitFor(() => expect(calls.reindex).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(/Переиндексация поставлена в очередь/)).toBeInTheDocument()
  })

  it('ошибка загрузки с «Повторить»; без прав — текст сервера', async () => {
    const { admin, calls } = makeAdmin(embeddings())
    calls.get.mockRejectedValueOnce(new BrainApiError(403, 'Только для управляющего.'))
    render(<ModelSettingsDialog api={{ models: modelsApi, admin }} open onClose={() => {}} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Только для управляющего.')
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByRole('combobox', { name: 'Модель по умолчанию' })).toBeInTheDocument()
  })

  it('пока идёт смена провайдера, покрытие обновляется само', async () => {
    const { admin, calls } = makeAdmin(embeddings({ switching: true, target_model: 'new', coverage: [{ model: 'new', embedded: 100, total: 1000, pending: 900, failed: 0 }] }))
    render(<ModelSettingsDialog api={{ models: modelsApi, admin }} open onClose={() => {}} pollMs={30} />)
    await screen.findByText(/Идёт переиндексация/)
    const before = calls.get.mock.calls.length
    await waitFor(() => expect(calls.get.mock.calls.length).toBeGreaterThan(before), { timeout: 1000 })
    await act(async () => {})
  })
})

describe('IndexStatusDialog', () => {
  const status: IndexStatus = {
    connectors: [
      { connector: 'wowhaus', last_ok_at: new Date(Date.now() - 5 * 60000).toISOString(), docs_total: 12345, backfill_done: true },
      { connector: 'wiki', last_error: 'таймаут источника', backfill_done: false },
    ],
    modules: [
      { module: 'oup', entity_type: 'lead', documents: 1200, chunks: 3400, newest_at: new Date(Date.now() - 3600_000 * 3).toISOString() },
      { module: 'wiki', entity_type: 'material', documents: 300, chunks: 900 },
    ],
  }
  const makeApi = () => ({
    admin: { index: { status: vi.fn(async () => status), sync: vi.fn(async () => {}), reindex: vi.fn(async () => {}) } },
  })

  it('модули таблицей с итогом, источники со свежестью и ошибкой', async () => {
    render(<IndexStatusDialog api={makeApi()} open onClose={() => {}} />)
    const table = await screen.findByRole('table')
    expect(within(table).getByText('ОУП')).toBeInTheDocument()
    expect(within(table).getByText('Вики')).toBeInTheDocument()
    expect(within(table).getByText('1 200')).toBeInTheDocument()
    expect(within(table).getByText('3 ч назад')).toBeInTheDocument()
    expect(within(table).getByText('1 500')).toBeInTheDocument() // всего документов
    expect(screen.getByText(/12 345 документов · синхронизирован 5 мин назад/)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Последняя ошибка: таймаут источника')
    expect(screen.getByText(/Идёт первичная загрузка/)).toBeInTheDocument()
  })

  it('«Синхронизировать» запускает проход и перечитывает статус; «Переиндексировать» — через подтверждение', async () => {
    const api = makeApi()
    render(<IndexStatusDialog api={api} open onClose={() => {}} />)
    await screen.findByRole('table')
    await userEvent.click(screen.getByRole('button', { name: /Синхронизировать/ }))
    await waitFor(() => expect(api.admin.index.sync).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(api.admin.index.status).toHaveBeenCalledTimes(2))
    expect(await screen.findByText(/Синхронизация запущена/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Переиндексировать' }))
    expect(api.admin.index.reindex).not.toHaveBeenCalled()
    await userEvent.click(within(screen.getAllByRole('dialog').at(-1)!).getByRole('button', { name: 'Переиндексировать' }))
    await waitFor(() => expect(api.admin.index.reindex).toHaveBeenCalledTimes(1))
  })

  it('без canManage кнопок действий нет; ошибка загрузки — с «Повторить»', async () => {
    const api = makeApi()
    api.admin.index.status.mockRejectedValueOnce(new BrainApiError(403, 'Только для управляющего.'))
    render(<IndexStatusDialog api={api} open onClose={() => {}} canManage={false} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Только для управляющего.')
    expect(screen.queryByRole('button', { name: /Синхронизировать/ })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
  })

  it('пустой индекс и нет источников — пояснения', async () => {
    const api = { admin: { index: { status: vi.fn(async () => ({ connectors: [], modules: [] })), sync: vi.fn(), reindex: vi.fn() } } }
    render(<IndexStatusDialog api={api} open onClose={() => {}} />)
    expect(await screen.findByText(/Индекс пока пуст/)).toBeInTheDocument()
    expect(screen.getByText(/Источники не настроены/)).toBeInTheDocument()
  })
})
