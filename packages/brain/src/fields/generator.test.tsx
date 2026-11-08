import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BrainApiError } from '../api'
import type { Run } from '../types'
import { GeneratorDialog, type GeneratorDialogProps } from './GeneratorDialog'
import { defaultPeriod, isoDate, periodDays, periodLabel } from './period'

// Последнее слово перед номером источника рисуется вместе с чипом — фраза
// разбита на узлы, поэтому ищем пункт списка по его тексту целиком.
const liWith = (phrase: string) => (_: string, el: Element | null) =>
  el?.tagName === 'LI' && (el.textContent ?? '').replace(/\u00a0/g, ' ').includes(phrase)

const doneRun = (over: Partial<Run> = {}): Run => ({
  id: 'r1',
  status: 'completed',
  answer_md: '## Сделано\n\n- Согласовали КП [1]',
  citations: [{ n: 1, document_id: 'd1', title: 'Лид «Офис»', url: '/pm/leads/l1' }],
  steps: [],
  suggested_actions: [],
  ...over,
})

function makeApi(run: Run | Error = doneRun()) {
  return {
    generate: vi.fn(async () => ({ run_id: 'r1' })),
    waitForRun: vi.fn(async () => {
      if (run instanceof Error) throw run
      return run
    }),
  }
}

const open = (api: ReturnType<typeof makeApi>, props: Partial<GeneratorDialogProps> = {}) =>
  render(<GeneratorDialog api={api as unknown as GeneratorDialogProps['api']} open onClose={() => {}} {...props} />)

afterEach(() => vi.restoreAllMocks())

describe('период по умолчанию', () => {
  it('итог недели — пн–вс текущей недели, остальное — последние 7 дней', () => {
    // Среда 4 ноября 2026.
    const wed = new Date(2026, 10, 4, 15, 0)
    expect(defaultPeriod('week_summary', wed)).toEqual({ from: '2026-11-02', to: '2026-11-08' })
    // Воскресенье принадлежит своей неделе, понедельник — новой.
    expect(defaultPeriod('week_summary', new Date(2026, 10, 8)).from).toBe('2026-11-02')
    expect(defaultPeriod('week_summary', new Date(2026, 10, 9)).from).toBe('2026-11-09')
    expect(defaultPeriod('standup', wed)).toEqual({ from: '2026-10-29', to: '2026-11-04' })
    expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
  it('дней в периоде и подпись', () => {
    expect(periodDays('2026-11-02', '2026-11-08')).toBe(7)
    expect(periodDays('2026-11-02', '2026-11-02')).toBe(1)
    expect(periodDays('2026-11-05', '2026-11-02')).toBe(-2)
    expect(periodDays('', '2026-11-02')).toBeNaN()
    expect(periodLabel('2026-11-02', '2026-11-08')).toBe('02.11.2026 — 08.11.2026')
    expect(periodLabel('2026-11-02', '2026-11-02')).toBe('02.11.2026')
  })
})

describe('GeneratorDialog', () => {
  it('итог недели: параметры → запуск → Markdown с цитатой, источники, копирование', async () => {
    const api = makeApi()
    const write = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true })
    open(api, { kind: 'week_summary', defaults: { selfName: 'Иван Петров' } })
    expect(screen.getByRole('dialog', { name: 'Итог недели' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Составить итог недели' }))
    expect(api.generate).toHaveBeenCalledWith(
      'week_summary',
      expect.objectContaining({ self_name: 'Иван Петров', from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), to: expect.any(String) }),
    )
    expect(await screen.findByText(liWith('Согласовали КП'))).toBeInTheDocument()
    // Цитата [1] стала чипом, источник — карточкой.
    expect(screen.getByRole('button', { name: /Источник 1/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Скопировать/ }))
    expect(write).toHaveBeenCalledWith(expect.stringContaining('Согласовали КП'))
    expect(await screen.findByText('Скопировано')).toBeInTheDocument()
  })

  it('стендап: без людей — ошибка у поля, запрос не уходит; люди уходят с именами', async () => {
    const api = makeApi()
    open(api, {
      kind: 'standup',
      peopleOptions: [
        { user_id: 'u1', name: 'Иван Петров' },
        { user_id: 'u2', name: 'Анна Сидорова' },
      ],
    })
    await userEvent.click(screen.getByRole('button', { name: 'Составить стендап' }))
    expect(screen.getByText('Выберите хотя бы одного человека.')).toBeInTheDocument()
    expect(api.generate).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('combobox', { name: /Люди/ }))
    await userEvent.click(screen.getByRole('option', { name: /Иван Петров/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Составить стендап' }))
    await waitFor(() => expect(api.generate).toHaveBeenCalled())
    expect(api.generate).toHaveBeenCalledWith('standup', expect.objectContaining({ people: [{ user_id: 'u1', name: 'Иван Петров' }] }))
  })

  it('люди из defaults выбраны сразу', async () => {
    const api = makeApi()
    open(api, { kind: 'standup', defaults: { people: [{ user_id: 'u9', name: 'Пётр Орлов' }] } })
    await userEvent.click(screen.getByRole('button', { name: 'Составить стендап' }))
    await waitFor(() => expect(api.generate).toHaveBeenCalled())
    expect(api.generate).toHaveBeenCalledWith('standup', expect.objectContaining({ people: [{ user_id: 'u9', name: 'Пётр Орлов' }] }))
  })

  it('дайджест проекта: без проекта — подсказка, с проектом — project_id и название', async () => {
    const api = makeApi()
    const { unmount } = open(api, { kind: 'project_update' })
    await userEvent.click(screen.getByRole('button', { name: 'Составить дайджест' }))
    expect(screen.getByText(/Не выбран проект/)).toBeInTheDocument()
    expect(api.generate).not.toHaveBeenCalled()
    unmount()

    open(api, { kind: 'project_update', defaults: { projectId: 'p7', projectTitle: 'Офис «Север»' } })
    expect(screen.getByText('Офис «Север»')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Составить дайджест' }))
    await waitFor(() => expect(api.generate).toHaveBeenCalled())
    expect(api.generate).toHaveBeenCalledWith('project_update', expect.objectContaining({ project_id: 'p7', project_title: 'Офис «Север»' }))
  })

  it('несколько генераторов — сегмент; выбор меняет форму и подпись кнопки', async () => {
    const api = makeApi()
    open(api, { kinds: ['standup', 'project_update'], defaults: { projectId: 'p1', projectTitle: 'Проект' } })
    const group = screen.getByRole('radiogroup', { name: 'Что составить' })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Стендап' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('radio', { name: 'Дайджест проекта' }))
    expect(screen.getByRole('radio', { name: 'Дайджест проекта' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('button', { name: 'Составить дайджест' })).toBeInTheDocument()
    expect(screen.queryByText('Люди')).toBeNull()
  })

  it('период: конец раньше начала и слишком длинный — ошибки до запроса', async () => {
    const api = makeApi()
    open(api, { kind: 'exec_summary', defaults: { from: '2026-11-05', to: '2026-11-01' } })
    await userEvent.click(screen.getByRole('button', { name: 'Составить сводку' }))
    expect(screen.getByText('Конец периода раньше начала.')).toBeInTheDocument()
    expect(api.generate).not.toHaveBeenCalled()
  })

  it('квота и «HTTP NNN» — человеческим текстом; «Повторить» запускает снова', async () => {
    const api = {
      generate: vi.fn(async () => {
        throw new BrainApiError(429, 'HTTP 429')
      }),
      waitForRun: vi.fn(),
    }
    open(api as unknown as ReturnType<typeof makeApi>, { kind: 'week_summary' })
    await userEvent.click(screen.getByRole('button', { name: 'Составить итог недели' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Лимит ИИ исчерпан — попробуйте позже.')
    expect(screen.queryByText(/HTTP/)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    await waitFor(() => expect(api.generate).toHaveBeenCalledTimes(2))
  })

  it('запуск завершился ошибкой — текст из запуска', async () => {
    const api = makeApi(doneRun({ status: 'failed', error: 'ИИ не уложился в отведённое время — попробуйте упростить вопрос', answer_md: '' }))
    open(api, { kind: 'week_summary' })
    await userEvent.click(screen.getByRole('button', { name: 'Составить итог недели' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('ИИ не уложился')
  })

  it('autoRun: «Итог недели» составляется сразу при открытии, один раз', async () => {
    const api = makeApi()
    const { rerender } = open(api, { kind: 'week_summary', autoRun: true })
    await waitFor(() => expect(api.generate).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(liWith('Согласовали КП'))).toBeInTheDocument()
    rerender(<GeneratorDialog api={api as unknown as GeneratorDialogProps['api']} open onClose={() => {}} kind="week_summary" autoRun />)
    expect(api.generate).toHaveBeenCalledTimes(1)
  })

  it('«Остановить» обрывает ожидание и возвращает к параметрам', async () => {
    let abortSignal: AbortSignal | undefined
    const api = {
      generate: vi.fn(async () => ({ run_id: 'r1' })),
      waitForRun: vi.fn(
        (_id: string, o?: { signal?: AbortSignal }) =>
          new Promise<Run>((_res, rej) => {
            abortSignal = o?.signal
            o?.signal?.addEventListener('abort', () => rej(Object.assign(new Error('abort'), { name: 'AbortError' })))
          }),
      ),
    }
    open(api as unknown as ReturnType<typeof makeApi>, { kind: 'week_summary' })
    await userEvent.click(screen.getByRole('button', { name: 'Составить итог недели' }))
    expect(await screen.findByText('Составляю…')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Остановить' }))
    expect(abortSignal?.aborted).toBe(true)
    expect(screen.getByRole('button', { name: 'Составить итог недели' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('переход по источнику вызывает onNavigate и закрывает окно', async () => {
    const api = makeApi()
    const onNavigate = vi.fn()
    const onClose = vi.fn()
    open(api, { kind: 'week_summary', onNavigate, onClose })
    await userEvent.click(screen.getByRole('button', { name: 'Составить итог недели' }))
    await screen.findByText(liWith('Согласовали КП'))
    await userEvent.click(screen.getByRole('button', { name: /Источники/ }))
    await userEvent.click(await screen.findByRole('link', { name: /Лид «Офис»/ }).catch(() => screen.getByText('Лид «Офис»')))
    expect(onNavigate).toHaveBeenCalledWith('/pm/leads/l1')
    expect(onClose).toHaveBeenCalled()
  })
})
