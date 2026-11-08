import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { RunDetail } from './RunDetail'
import { RunLogTable, runStatusView } from './RunLogTable'
import type { AgentRun } from './types'

const run = (over: Partial<AgentRun> = {}): AgentRun => ({
  id: 'r1',
  status: 'completed',
  answer_md: '',
  citations: [],
  steps: [],
  suggested_actions: [],
  agent_id: 'a1',
  agent_name: 'Утренний стендап',
  trigger_kind: 'schedule',
  queued_at: '2026-11-06T06:30:00Z',
  started_at: '2026-11-06T06:30:02Z',
  finished_at: '2026-11-06T06:30:14Z',
  usage: { cost: 0.034 },
  ...over,
})

const rowOf = (name: RegExp | string) => screen.getByText(name).closest('tr')!

describe('RunLogTable', () => {
  it('колонки: время, агент, триггер, статус, стоимость, длительность', () => {
    render(<RunLogTable runs={[run()]} />)
    const heads = screen.getAllByRole('columnheader').map((h) => h.textContent)
    expect(heads).toEqual(['Время', 'Агент', 'Триггер', 'Статус', 'Стоимость', 'Длительность'])
    const row = rowOf('Утренний стендап')
    expect(within(row).getByText('По расписанию')).toBeInTheDocument()
    expect(within(row).getByText('Готово')).toBeInTheDocument()
    expect(within(row).getByText('0,03 $')).toBeInTheDocument()
    expect(within(row).getByText('12 с')).toBeInTheDocument()
  })

  it('триггеры: вручную, по расписанию, по событию', () => {
    render(
      <RunLogTable
        runs={[
          run({ id: '1', agent_name: 'А', trigger_kind: 'manual' }),
          run({ id: '2', agent_name: 'Б', trigger_kind: 'schedule' }),
          run({ id: '3', agent_name: 'В', trigger_kind: 'event' }),
        ]}
      />,
    )
    expect(within(rowOf('А')).getByText('Вручную')).toBeInTheDocument()
    expect(within(rowOf('Б')).getByText('По расписанию')).toBeInTheDocument()
    expect(within(rowOf('В')).getByText('По событию')).toBeInTheDocument()
  })

  it('пропущенный запуск объясняет причину человеческим текстом, а не кодом', () => {
    const reasons: Record<string, RegExp> = {
      budget: /Исчерпан дневной бюджет/,
      delegation_unavailable: /нет доступа к модулю ИИ/,
      no_manage_role: /роль.*Управление/,
      condition_false: /Условие запуска не выполнено/,
      condition_error: /Не удалось проверить условие/,
    }
    for (const [reason, re] of Object.entries(reasons)) {
      const { unmount } = render(
        <RunLogTable
          runs={[run({ status: 'skipped', skip_reason: reason, usage: undefined, finished_at: undefined })]}
        />,
      )
      const row = rowOf('Утренний стендап')
      expect(within(row).getByText('Пропущен')).toBeInTheDocument()
      expect(within(row).getByText(re)).toBeInTheDocument()
      expect(row.textContent).not.toContain(reason)
      expect(within(row).getByText('—', { selector: 'td:nth-of-type(5)' })).toBeInTheDocument()
      unmount()
    }
  })

  it('неизвестная причина пропуска не светит сырой код', () => {
    render(<RunLogTable runs={[run({ status: 'skipped', skip_reason: 'weird_new_code' })]} />)
    expect(screen.getByText('Запуск пропущен')).toBeInTheDocument()
    expect(screen.queryByText(/weird_new_code/)).toBeNull()
  })

  it('ошибка показывает текст сервера, в работе — «В работе», отменён — «Отменён»', () => {
    render(
      <RunLogTable
        runs={[
          run({ id: '1', agent_name: 'А', status: 'failed', error: 'Сервис недоступен' }),
          run({ id: '2', agent_name: 'Б', status: 'running', finished_at: undefined }),
          run({ id: '3', agent_name: 'В', status: 'queued', finished_at: undefined }),
          run({ id: '4', agent_name: 'Г', status: 'cancelled' }),
        ]}
      />,
    )
    expect(within(rowOf('А')).getByText('Ошибка')).toBeInTheDocument()
    expect(within(rowOf('А')).getByText('Сервис недоступен')).toBeInTheDocument()
    expect(within(rowOf('Б')).getByText('В работе')).toBeInTheDocument()
    expect(within(rowOf('В')).getByText('В работе')).toBeInTheDocument()
    expect(within(rowOf('Г')).getByText('Отменён')).toBeInTheDocument()
  })

  it('restricted: пометка «Содержимое видно только участнику», текста ошибки нет', () => {
    render(
      <RunLogTable
        runs={[run({ restricted: true, status: 'failed', error: 'тут мог быть чужой текст', answer_md: '' })]}
      />,
    )
    const row = rowOf('Утренний стендап')
    expect(within(row).getByText('Содержимое видно только участнику')).toBeInTheDocument()
    expect(within(row).getByText('Ошибка')).toBeInTheDocument()
    expect(screen.queryByText(/чужой текст/)).toBeNull()
  })

  it('удалённый агент подписан, колонку «Агент» можно убрать', () => {
    const { rerender } = render(<RunLogTable runs={[run({ agent_id: undefined, agent_name: undefined })]} />)
    expect(screen.getByText('Агент удалён')).toBeInTheDocument()
    rerender(<RunLogTable runs={[run()]} showAgent={false} />)
    expect(screen.queryByRole('columnheader', { name: 'Агент' })).toBeNull()
  })

  it('строка и кнопка времени открывают запуск ровно один раз', async () => {
    const onOpen = vi.fn()
    const r = run()
    render(<RunLogTable runs={[r]} onOpen={onOpen} selectedId="r1" />)
    const row = rowOf('Утренний стендап')
    fireEvent.click(row)
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onOpen).toHaveBeenCalledWith(r)
    const btn = within(row).getByRole('button')
    expect(btn).toHaveAttribute('aria-current', 'true')
    await userEvent.click(btn)
    expect(onOpen).toHaveBeenCalledTimes(2)
  })

  it('без onOpen строка не кликабельна, кнопок нет', () => {
    render(<RunLogTable runs={[run()]} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('пустое состояние и загрузка', () => {
    const { rerender } = render(<RunLogTable runs={[]} />)
    expect(screen.getByText('Запусков пока нет')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
    rerender(<RunLogTable runs={[]} emptyAction={<button type="button">Запустить агента</button>} />)
    expect(screen.getByRole('button', { name: 'Запустить агента' })).toBeInTheDocument()
    rerender(<RunLogTable runs={[]} loading />)
    expect(screen.getByRole('status')).toHaveTextContent('Загружаю журнал…')
    expect(screen.queryByText('Запусков пока нет')).toBeNull()
    rerender(<RunLogTable runs={[]} error="не удалось загрузить" />)
    expect(screen.getByRole('alert')).toHaveTextContent('не удалось загрузить')
    expect(screen.queryByText('Запусков пока нет')).toBeNull()
  })

  it('«Показать ещё» догружает; без страниц', async () => {
    const onLoadMore = vi.fn()
    const { rerender } = render(<RunLogTable runs={[run()]} hasMore onLoadMore={onLoadMore} />)
    await userEvent.click(screen.getByRole('button', { name: 'Показать ещё' }))
    expect(onLoadMore).toHaveBeenCalledTimes(1)
    rerender(<RunLogTable runs={[run()]} hasMore onLoadMore={onLoadMore} loadingMore />)
    expect(screen.getByRole('button', { name: 'Загружаю…' })).toBeDisabled()
    rerender(<RunLogTable runs={[run()]} onLoadMore={onLoadMore} />)
    expect(screen.queryByRole('button', { name: 'Показать ещё' })).toBeNull()
  })

  it('runStatusView: подпись и тон', () => {
    expect(runStatusView(run())).toMatchObject({ label: 'Готово', tone: 'ok' })
    expect(runStatusView(run({ status: 'skipped', skip_reason: 'budget' }))).toMatchObject({
      label: 'Пропущен',
      tone: 'warn',
    })
    expect(runStatusView(run({ status: 'failed' }))).toMatchObject({ label: 'Ошибка', tone: 'bad' })
    expect(runStatusView(run({ status: 'running' }))).toMatchObject({ label: 'В работе', tone: 'busy' })
  })
})

describe('RunDetail', () => {
  const full = run({
    answer_md: 'Вчера изменился лид «Офис» [1].',
    citations: [
      {
        n: 1,
        document_id: 'd1',
        title: 'Лид «Офис»',
        url: '/pm/leads/1',
        module: 'oup',
        snippet: 'Сменился ответственный',
      },
    ],
    steps: [
      { n: 1, kind: 'model', tool: '', title: '', ok: true },
      { n: 2, kind: 'tool', tool: 'search_workspace', title: 'Поиск по данным портала', ok: true },
      { n: 3, kind: 'tool', tool: 'search_workspace', title: 'Поиск по данным портала', ok: true },
    ],
  })

  it('заголовок, триггер, время, ответ с цитатой, источники, шаги — только инструменты', () => {
    render(<RunDetail run={full} />)
    expect(screen.getByRole('heading', { name: 'Утренний стендап' })).toBeInTheDocument()
    expect(screen.getByText('По расписанию')).toBeInTheDocument()
    expect(screen.getByText('Готово')).toBeInTheDocument()
    expect(
      screen.getByText(
        (_, el) => el?.tagName === 'P' && (el.textContent ?? '').replace(/\u00a0/g, ' ').includes('Вчера изменился лид «Офис»'),
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Источник 1: Лид «Офис»' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /Источники/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Лид «Офис»' })).toHaveAttribute('href', '/pm/leads/1')
    // Шаги: только инструмент, и повтор схлопнут.
    expect(screen.getByLabelText('Что смотрел агент')).toHaveTextContent('Поиск по данным портала ×2')
    expect(screen.getByText('0,03 $')).toBeInTheDocument()
    expect(screen.getByText('12 с')).toBeInTheDocument()
  })

  it('клик по цитате подсвечивает источник', async () => {
    render(<RunDetail run={full} />)
    await userEvent.click(screen.getByRole('button', { name: 'Источник 1: Лид «Офис»' }))
    expect(screen.getByLabelText('Источник 1: Лид «Офис»', { selector: 'article' })).toHaveAttribute('data-active')
  })

  it('источники показываются и пустыми у завершённого запуска', () => {
    render(<RunDetail run={run({ answer_md: 'Изменений нет.' })} />)
    expect(screen.getByText('Ответ без ссылок на документы портала.')).toBeInTheDocument()
  })

  it('отложенное действие: «Подтвердить» и «Отмена» зовут колбэки с действием', async () => {
    const onConfirmAction = vi.fn()
    const onCancelAction = vi.fn()
    const action = {
      id: 'act1',
      tool: 'oup_lead_create',
      title: 'Создать лид «Офис»',
      status: 'pending' as const,
      preview: { will_set: [{ field: 'Название', value: 'Офис' }] },
    }
    render(
      <RunDetail
        run={run({ answer_md: 'Готов предпросмотр.', pending_actions: [action] })}
        onConfirmAction={onConfirmAction}
        onCancelAction={onCancelAction}
        busyActionId={null}
        actionErrors={{ act1: 'Не удалось' }}
      />,
    )
    expect(screen.getByText('Название')).toBeInTheDocument()
    expect(screen.getByText('Не удалось')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Подтвердить' }))
    expect(onConfirmAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'act1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(onCancelAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'act1' }))
  })

  it('действие с пустым preview и результатом-объектом не ломает экран', () => {
    const action = {
      id: 'act2',
      tool: 't',
      title: 'Создать',
      status: 'done' as const,
      result: { id: 7 },
      preview: null,
    } as unknown as NonNullable<AgentRun['pending_actions']>[number]
    render(<RunDetail run={run({ answer_md: 'Ок', pending_actions: [action] })} />)
    expect(screen.getByText('Выполнено')).toBeInTheDocument()
  })

  it('пропуск: причина человеческим текстом, ответа и источников нет', () => {
    render(<RunDetail run={run({ status: 'skipped', skip_reason: 'budget', usage: undefined })} />)
    expect(screen.getByText('Запуск пропущен')).toBeInTheDocument()
    expect(screen.getByText('Исчерпан дневной бюджет агента')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /Источники/ })).toBeNull()
  })

  it('ошибка: текст сервера и «Повторить»', async () => {
    const onRetry = vi.fn()
    const r = run({ status: 'failed', error: 'Время запуска истекло' })
    render(<RunDetail run={r} onRetry={onRetry} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Время запуска истекло')
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(onRetry).toHaveBeenCalledWith(r)
  })

  it('«Повторить» не показывается пока идёт запуск, без агента и без колбэка', () => {
    const { rerender } = render(
      <RunDetail run={run({ status: 'running', finished_at: undefined })} onRetry={() => {}} />,
    )
    expect(screen.queryByRole('button', { name: 'Повторить' })).toBeNull()
    expect(screen.getByText('Агент ещё работает — результат появится здесь.')).toBeInTheDocument()
    rerender(<RunDetail run={run({ agent_id: undefined })} onRetry={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Повторить' })).toBeNull()
    rerender(<RunDetail run={run()} />)
    expect(screen.queryByRole('button', { name: 'Повторить' })).toBeNull()
  })

  it('restricted: только метаданные — ни ответа, ни источников, ни шагов, ни «Повторить»', () => {
    const onRetry = vi.fn()
    render(
      <RunDetail
        run={{ ...full, restricted: true, answer_md: 'секретный ответ', error: 'секретная ошибка' }}
        onRetry={onRetry}
        onConfirmAction={() => {}}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Утренний стендап' })).toBeInTheDocument()
    expect(screen.getByText('Содержимое видно только участнику')).toBeInTheDocument()
    expect(screen.getByText('По расписанию')).toBeInTheDocument()
    expect(screen.queryByText(/секретный/)).toBeNull()
    expect(screen.queryByRole('region', { name: /Источники/ })).toBeNull()
    expect(screen.queryByLabelText('Что смотрел агент')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Повторить' })).toBeNull()
  })

  it('«К журналу» — только если передан onBack', async () => {
    const onBack = vi.fn()
    const { rerender } = render(<RunDetail run={run()} />)
    expect(screen.queryByRole('button', { name: /К журналу/ })).toBeNull()
    rerender(<RunDetail run={run()} onBack={onBack} />)
    await userEvent.click(screen.getByRole('button', { name: /К журналу/ }))
    expect(onBack).toHaveBeenCalled()
  })
})
