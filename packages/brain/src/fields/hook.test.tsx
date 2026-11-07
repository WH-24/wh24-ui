import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AiField, AiFieldFillResult, AiFieldValues } from './types'
import { fillSummary, useAiFieldColumns, type UseAiFieldColumnsOptions } from './useAiFieldColumns'

interface Row {
  id: string
  name: string
}
const rows: Row[] = [
  { id: 'l1', name: 'Офис' },
  { id: 'l2', name: 'Склад' },
  { id: 'l3', name: 'Дача' },
  { id: 'l4', name: 'Школа' },
]

const field = (over: Partial<AiField> = {}): AiField => ({
  id: 'f1',
  module: 'oup',
  entity_type: 'lead',
  scope: '',
  label: 'Теплота',
  kind: 'categorize',
  prompt: '',
  params: { options: ['Горячий', 'Тёплый'] },
  model: '',
  on_change: false,
  visibility: 'private',
  enabled: true,
  created_by: 'u1',
  can: { edit: true },
  ...over,
})

type Api = UseAiFieldColumnsOptions<Row>['api']

function makeApi(over: { fields?: AiField[]; supported?: boolean; values?: (ids: string[]) => AiFieldValues; fill?: AiFieldFillResult } = {}) {
  const fields = over.fields ?? [field()]
  const api = {
    fields: {
      list: vi.fn(async () => ({ fields, daily_limit: 500, supported: over.supported !== false })),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(async () => {}),
      values: vi.fn(async (_m: string, _e: string, ids: string[]) => over.values?.(ids) ?? {}),
      fill: vi.fn(async () => over.fill ?? { queued: 1, requested: 1, no_access: 0, skipped_limit: 0, up_to_date: 0, limit_left: 499 }),
      preview: vi.fn(),
      getPreview: vi.fn(),
    },
  }
  return api as unknown as Api & typeof api
}

function Harness(props: Partial<UseAiFieldColumnsOptions<Row>> & { api: Api }) {
  const ai = useAiFieldColumns<Row>({
    module: 'oup',
    entityType: 'lead',
    rows,
    getId: (r) => r.id,
    canCreate: true,
    canManage: false,
    pollMs: 15,
    ...props,
  })
  return (
    <div>
      {ai.addButton}
      <span data-testid="state">{`${ai.supported}/${ai.loading}/${ai.columns.length}`}</span>
      <table>
        <thead>
          <tr>
            {ai.columns.map((c) => (
              <th key={c.key}>
                {c.label}
                {c.headerActions}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} data-testid={`row-${r.id}`}>
              {ai.columns.map((c) => (
                <td key={c.key}>{c.render(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {ai.dialogs}
    </div>
  )
}

const cell = (id: string) => within(screen.getByTestId(`row-${id}`))

afterEach(() => vi.restoreAllMocks())

describe('useAiFieldColumns', () => {
  it('enabled=false — ни одного запроса, ни колонок, ни кнопки', async () => {
    const api = makeApi()
    render(<Harness api={api} enabled={false} />)
    await new Promise((r) => setTimeout(r, 30))
    expect(api.fields.list).not.toHaveBeenCalled()
    expect(api.fields.values).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /Поле ИИ/ })).toBeNull()
    expect(screen.getByTestId('state')).toHaveTextContent('false/false/0')
  })

  it('список не поддерживается — кнопки «Поле ИИ» нет, значения не грузятся', async () => {
    const api = makeApi({ supported: false, fields: [] })
    render(<Harness api={api} />)
    await waitFor(() => expect(api.fields.list).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('false/false/0'))
    expect(screen.queryByRole('button', { name: /Поле ИИ/ })).toBeNull()
    expect(api.fields.values).not.toHaveBeenCalled()
  })

  it('колонок нет и заводить нельзя — значения не запрашиваются; кнопки нет', async () => {
    const api = makeApi({ fields: [] })
    render(<Harness api={api} canCreate={false} />)
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('true/false/0'))
    expect(api.fields.values).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /Поле ИИ/ })).toBeNull()
  })

  it('нет колонок, но можно заводить — кнопка «Поле ИИ» открывает диалог с первыми тремя записями для пробы', async () => {
    const api = makeApi({ fields: [] })
    render(<Harness api={api} />)
    const add = await screen.findByRole('button', { name: /Поле ИИ/ })
    await userEvent.click(add)
    expect(screen.getByRole('dialog', { name: 'Новое поле ИИ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Попробовать на 3 строках' })).toBeInTheDocument()
  })

  it('колонки — только включённые; значения для всех строк одним вызовом; ячейки по статусам', async () => {
    const api = makeApi({
      fields: [field(), field({ id: 'f2', label: 'Выключена', enabled: false })],
      values: () => ({
        f1: {
          l1: { status: 'fresh', text: 'Горячий' },
          l2: { status: 'stale', text: 'Тёплый' },
          l3: { status: 'failed', text: '', error_code: 'quota' },
        },
      }),
    })
    render(<Harness api={api} />)
    expect(await screen.findByText('Горячий')).toBeInTheDocument()
    expect(screen.getByTestId('state')).toHaveTextContent('true/false/1')
    expect(screen.queryByText('Выключена')).toBeNull()
    expect(api.fields.values).toHaveBeenCalledTimes(1)
    expect(api.fields.values).toHaveBeenCalledWith('oup', 'lead', ['l1', 'l2', 'l3', 'l4'], undefined)
    expect(cell('l2').getByText('запись изменилась')).toBeInTheDocument()
    expect(cell('l3').getByText('Лимит ИИ исчерпан — попробуйте позже')).toBeInTheDocument()
    expect(cell('l4').getByLabelText('Теплота: не заполнено')).toBeInTheDocument()
  })

  it('опрос: пока есть «Считаю…» — раз в паузу и только по ячейкам в работе; дошло до fresh — опрос стоит', async () => {
    let tick = 0
    const api = makeApi({
      values: (ids) => {
        tick++
        if (tick === 1) return { f1: { l1: { status: 'computing', text: '' }, l2: { status: 'queued', text: '' }, l3: { status: 'fresh', text: 'Холодный' } } }
        if (tick === 2) return { f1: { l1: { status: 'fresh', text: 'Горячий' }, l2: { status: 'computing', text: '' } } }
        return { f1: { l2: { status: 'fresh', text: 'Тёплый' } } }
      },
    })
    render(<Harness api={api} />)
    await waitFor(() => expect(cell('l1').getByText('Считаю…')).toBeInTheDocument())
    await waitFor(() => expect(cell('l2').getByText('Тёплый')).toBeInTheDocument())
    expect(cell('l1').getByText('Горячий')).toBeInTheDocument()
    expect(cell('l3').getByText('Холодный')).toBeInTheDocument()
    const calls = api.fields.values.mock.calls
    expect(calls).toHaveLength(3)
    // Первый — все строки, дальше — только то, что ещё считалось.
    expect(calls[0]![2]).toEqual(['l1', 'l2', 'l3', 'l4'])
    expect([...calls[1]![2]].sort()).toEqual(['l1', 'l2'])
    expect(calls[2]![2]).toEqual(['l2'])
    // Всё посчитано — дальше запросов нет.
    await new Promise((r) => setTimeout(r, 80))
    expect(api.fields.values).toHaveBeenCalledTimes(3)
  })

  it('скрытая вкладка: опрос ждёт, пока вкладку откроют', async () => {
    let state: DocumentVisibilityState = 'visible'
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => state)
    let tick = 0
    const api = makeApi({
      values: () => {
        tick++
        return tick === 1 ? { f1: { l1: { status: 'computing', text: '' } } } : { f1: { l1: { status: 'fresh', text: 'Готово' } } }
      },
    })
    render(<Harness api={api} />)
    await waitFor(() => expect(api.fields.values).toHaveBeenCalledTimes(1))
    state = 'hidden'
    await new Promise((r) => setTimeout(r, 60))
    expect(api.fields.values).toHaveBeenCalledTimes(1)
    state = 'visible'
    act(() => void document.dispatchEvent(new Event('visibilitychange')))
    expect(await screen.findByText('Готово')).toBeInTheDocument()
  })

  it('«Заполнить пустые» отправляет только пустые, неудачные и устаревшие; результат — подсказка; ячейки в очередь', async () => {
    let filled = false
    const api = makeApi({
      values: (ids) =>
        filled && ids.includes('l4')
          ? { f1: { l4: { status: 'queued', text: '' } } }
          : {
              f1: {
                l1: { status: 'fresh', text: 'Горячий' },
                l2: { status: 'stale', text: 'Тёплый' },
                l3: { status: 'failed', text: '', error_code: 'upstream' },
              },
            },
      fill: { queued: 3, requested: 4, no_access: 1, skipped_limit: 0, up_to_date: 1, limit_left: 497 },
    })
    api.fields.fill.mockImplementation(async () => {
      filled = true
      return { queued: 3, requested: 4, no_access: 1, skipped_limit: 0, up_to_date: 1, limit_left: 497 }
    })
    render(<Harness api={api} />)
    await screen.findByText('Горячий')
    await userEvent.click(screen.getByRole('button', { name: /Колонка «Теплота»: действия/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Заполнить пустые' }))
    await waitFor(() => expect(api.fields.fill).toHaveBeenCalledTimes(1))
    expect(api.fields.fill).toHaveBeenCalledWith('f1', { entity_ids: ['l2', 'l3', 'l4'], force: false })
    expect(await screen.findByText(/Заполняю 3 ячейки/)).toBeInTheDocument()
    expect(screen.getByText(/Пропущено 1 запись: нет доступа/)).toBeInTheDocument()
    expect(screen.getByText(/1 уже актуальна/)).toBeInTheDocument()
    // Сразу после постановки — внеочередной опрос только по этим записям.
    await waitFor(() => expect(api.fields.values.mock.calls.some((c) => c[2].length === 3)).toBe(true))
    // Остаток лимита появляется в меню.
    await userEvent.click(screen.getByRole('button', { name: /Колонка «Теплота»: действия/ }))
    expect(screen.getByText('Сегодня осталось 497 из 500 расчётов')).toBeInTheDocument()
  })

  it('всё уже заполнено — подсказка без запроса; «Обновить все» шлёт force для всех записей', async () => {
    const api = makeApi({
      values: () => ({
        f1: Object.fromEntries(rows.map((r) => [r.id, { status: 'fresh', text: `v-${r.id}` }])),
      }),
    })
    render(<Harness api={api} />)
    await screen.findByText('v-l1')
    await userEvent.click(screen.getByRole('button', { name: /действия/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Заполнить пустые' }))
    expect(await screen.findByText('Все ячейки уже заполнены.')).toBeInTheDocument()
    expect(api.fields.fill).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: /действия/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Обновить все' }))
    await waitFor(() => expect(api.fields.fill).toHaveBeenCalled())
    expect(api.fields.fill).toHaveBeenCalledWith('f1', { entity_ids: ['l1', 'l2', 'l3', 'l4'], force: true })
  })

  it('«Повторить» в ячейке пересчитывает одну запись принудительно', async () => {
    const api = makeApi({ values: () => ({ f1: { l3: { status: 'failed', text: '', error_code: 'timeout' } } }) })
    render(<Harness api={api} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Повторить: Теплота' }))
    await waitFor(() => expect(api.fields.fill).toHaveBeenCalledWith('f1', { entity_ids: ['l3'], force: true }))
  })

  it('«Удалить…» спрашивает подтверждение, потом удаляет и перечитывает колонки', async () => {
    const api = makeApi()
    render(<Harness api={api} />)
    await userEvent.click(await screen.findByRole('button', { name: /действия/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Удалить…' }))
    const dlg = screen.getByRole('dialog', { name: 'Удалить колонку «Теплота»?' })
    // Опасное действие: фокус на «Отмена».
    expect(within(dlg).getByRole('button', { name: 'Отмена' })).toHaveFocus()
    await userEvent.click(within(dlg).getByRole('button', { name: 'Удалить' }))
    await waitFor(() => expect(api.fields.remove).toHaveBeenCalledWith('f1'))
    await waitFor(() => expect(api.fields.list).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Колонка «Теплота» удалена.')).toBeInTheDocument()
  })

  it('своё подтверждение и свои уведомления хоста (confirm/notify) вместо встроенных', async () => {
    const api = makeApi()
    const confirm = vi.fn(async () => false)
    const notify = vi.fn()
    render(<Harness api={api} confirm={confirm} notify={notify} />)
    await userEvent.click(await screen.findByRole('button', { name: /действия/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Удалить…' }))
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Удалить колонку «Теплота»?', danger: true }))
    expect(api.fields.remove).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: /действия/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Заполнить пустые' }))
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.stringMatching(/Заполняю/), 'info'))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('ошибка списка колонок не ломает страницу — просто без колонок', async () => {
    const api = makeApi()
    api.fields.list.mockRejectedValueOnce(new Error('403'))
    render(<Harness api={api} />)
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('false/false/0'))
    expect(screen.queryByRole('button', { name: /Поле ИИ/ })).toBeNull()
  })
})

describe('useAiFieldColumns — scope (записи формы)', () => {
  it('scope уходит в list и values; смена scope перечитывает колонки', async () => {
    const api = makeApi({ fields: [field({ module: 'forms', entity_type: 'form_record', scope: 'form-1' })], values: () => ({ f1: { l1: { status: 'fresh', text: 'Итог' } } }) })
    const { rerender } = render(<Harness api={api} module="forms" entityType="form_record" scope="form-1" />)
    await screen.findByText('Итог')
    expect(api.fields.list).toHaveBeenCalledWith('forms', 'form_record', 'form-1')
    expect(api.fields.values).toHaveBeenCalledWith('forms', 'form_record', ['l1', 'l2', 'l3', 'l4'], 'form-1')

    rerender(<Harness api={api} module="forms" entityType="form_record" scope="form-2" />)
    await waitFor(() => expect(api.fields.list).toHaveBeenCalledWith('forms', 'form_record', 'form-2'))
  })

  it('без scope у форм сервер отвечает supported:false — кнопки «Поле ИИ» нет', async () => {
    const api = makeApi({ fields: [], supported: false })
    render(<Harness api={api} module="forms" entityType="form_record" />)
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('false/false/0'))
    expect(api.fields.list).toHaveBeenCalledWith('forms', 'form_record', undefined)
    expect(screen.queryByRole('button', { name: /Поле ИИ/ })).toBeNull()
  })

  it('диалог создания получает scope: колонка заводится в этой форме', async () => {
    const api = makeApi({ fields: [] })
    api.fields.create.mockImplementation(async (b: unknown) => ({ ...field(), ...(b as object) }) as never)
    render(<Harness api={api} module="forms" entityType="form_record" scope="form-1" />)
    await userEvent.click(await screen.findByRole('button', { name: /Поле ИИ/ }))
    await userEvent.type(screen.getByLabelText(/Название колонки/), 'Итог')
    await userEvent.click(screen.getByRole('button', { name: 'Создать поле' }))
    await waitFor(() => expect(api.fields.create).toHaveBeenCalled())
    expect(api.fields.create).toHaveBeenCalledWith(expect.objectContaining({ module: 'forms', entity_type: 'form_record', scope: 'form-1' }))
  })
})

describe('fillSummary', () => {
  it('склонения и тон', () => {
    expect(fillSummary({ queued: 1, requested: 1, no_access: 0, skipped_limit: 0, up_to_date: 0, limit_left: 1 }, false)).toEqual({
      text: 'Заполняю 1 ячейку — результат появится в колонке.',
      tone: 'info',
    })
    expect(fillSummary({ queued: 22, requested: 40, no_access: 5, skipped_limit: 3, up_to_date: 10, limit_left: 0 }, false)).toEqual({
      text: 'Заполняю 22 ячейки — результат появится в колонке. 10 уже актуальны. Пропущено 5 записей: нет доступа. Дневной лимит колонки исчерпан: не поставлено 3.',
      tone: 'warn',
    })
    expect(fillSummary({ queued: 0, requested: 4, no_access: 0, skipped_limit: 0, up_to_date: 0, limit_left: 9 }, true).text).toBe('Нечего обновлять.')
    // Без force всё уже свежее — понятно, что именно пропущено.
    expect(fillSummary({ queued: 0, requested: 4, no_access: 0, skipped_limit: 0, up_to_date: 4, limit_left: 9 }, false).text).toBe(
      'Все ячейки уже заполнены. 4 уже актуальны.',
    )
    expect(fillSummary({ queued: 2, requested: 3, no_access: 0, skipped_limit: 0, up_to_date: 1, limit_left: 9 }, false).text).toContain('1 уже актуальна.')
  })
})
