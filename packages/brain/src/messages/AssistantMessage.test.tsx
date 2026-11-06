import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { RunBlock } from '../types'
import { AssistantMessage } from './AssistantMessage'

const block: RunBlock = {
  id: 'blk_1',
  type: 'chart',
  title: 'Текучесть по отделам',
  dataset: 'hr_staff_months',
  query: { dataset: 'hr_staff_months', measures: ['turnover'] },
  columns: [
    { key: 'dept', title: 'Отдел', type: 'string' },
    { key: 'turnover', title: 'Текучесть, %', type: 'float' },
  ],
  rows: [
    ['АР', 75],
    ['Инженерия', 0],
  ],
  view: { plugin: 'Y Bar' },
  explain: { dataset_title: 'Кадры по месяцам', row_count: 2 },
  source: 'bi_query',
}

describe('AssistantMessage', () => {
  it('без колбэков строки действий нет', () => {
    render(<AssistantMessage text="Ответ." />)
    expect(screen.getByText('Ответ.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('каждая кнопка появляется от своего колбэка и зовёт его', async () => {
    vi.useFakeTimers()
    try {
      const onCopy = vi.fn()
      const onCreateTask = vi.fn()
      const onRetry = vi.fn()
      const onFeedback = vi.fn()
      const onFollowUp = vi.fn()
      render(
        <AssistantMessage
          text="Текст ответа"
          onCopy={onCopy}
          onCreateTask={onCreateTask}
          onRetry={onRetry}
          onFeedback={onFeedback}
          feedback="up"
          followUps={[{ label: 'А что дальше?', prompt: 'дальше' }]}
          onFollowUp={onFollowUp}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: 'Копировать' }))
      expect(onCopy).toHaveBeenCalledWith('Текст ответа')
      await act(async () => {})
      expect(screen.getByRole('button', { name: 'Скопировано' })).toBeInTheDocument()
      await act(async () => {
        vi.advanceTimersByTime(1600)
      })
      expect(screen.getByRole('button', { name: 'Копировать' })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Создать задачу' }))
      expect(onCreateTask).toHaveBeenCalledWith('Текст ответа')
      fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
      expect(onRetry).toHaveBeenCalledTimes(1)

      const up = screen.getByRole('button', { name: 'Полезно' })
      expect(up).toHaveAttribute('aria-pressed', 'true')
      fireEvent.click(screen.getByRole('button', { name: 'Не полезно' }))
      expect(onFeedback).toHaveBeenCalledWith('down')

      fireEvent.click(screen.getByRole('button', { name: 'А что дальше?' }))
      expect(onFollowUp).toHaveBeenCalledWith({ label: 'А что дальше?', prompt: 'дальше' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('пока ответ идёт — индикатор, действия и чипы спрятаны', () => {
    render(
      <AssistantMessage
        text="Начало"
        pending
        onCopy={() => {}}
        followUps={[{ label: 'Ещё' }]}
        onFollowUp={() => {}}
      />,
    )
    expect(screen.getByRole('status', { name: 'Ассистент отвечает' })).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('шаги агента, ошибка и слот под текстом', () => {
    render(
      <AssistantMessage
        text=""
        error="Сервис недоступен"
        steps={[
          { tool: 'leads.search', title: 'Поиск лидов', ok: true },
          { tool: 'leads.search', title: 'Поиск лидов', ok: true },
          { tool: 'lead.get', title: 'Карточка лида', ok: false },
        ]}
      >
        <div data-testid="slot">источники</div>
      </AssistantMessage>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Сервис недоступен')
    expect(screen.getByText('Поиск лидов ×2')).toBeInTheDocument()
    expect(screen.getByText('Карточка лида — не удалось')).toBeInTheDocument()
    expect(screen.getByTestId('slot')).toBeInTheDocument()
  })

  it('блоки рисуются через renderBlock между текстом и слотом', () => {
    const renderBlock = vi.fn((b: RunBlock) => <div data-testid="chart">ГРАФИК {b.title}</div>)
    const { container } = render(
      <AssistantMessage text="Текучесть выросла." blocks={[block]} renderBlock={renderBlock}>
        <div data-testid="slot">источники</div>
      </AssistantMessage>,
    )
    expect(renderBlock).toHaveBeenCalledWith(block)
    expect(screen.getByTestId('chart')).toHaveTextContent('ГРАФИК Текучесть по отделам')
    const t = container.textContent ?? ''
    expect(t.indexOf('Текучесть выросла.')).toBeGreaterThanOrEqual(0)
    expect(t.indexOf('Текучесть выросла.')).toBeLessThan(t.indexOf('ГРАФИК'))
    expect(t.indexOf('ГРАФИК')).toBeLessThan(t.indexOf('источники'))
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('без renderBlock — запасная таблица и «Что посчитано»', () => {
    render(<AssistantMessage text="Ответ" blocks={[block]} />)
    expect(screen.getByRole('group', { name: 'Графики и таблицы к ответу' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Текучесть по отделам' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Отдел' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Инженерия' })).toBeInTheDocument()
    expect(screen.getByText('Что посчитано')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Скачать \.xlsx/ })).toBeInTheDocument()
  })

  it('renderBlock вернул null — тоже запасная таблица', () => {
    render(<AssistantMessage text="Ответ" blocks={[block]} renderBlock={() => null} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('пустой blocks ничего не добавляет', () => {
    render(<AssistantMessage text="Ответ" blocks={[]} renderBlock={() => <div>нет</div>} />)
    expect(screen.queryByRole('group')).toBeNull()
    expect(screen.queryByText('нет')).toBeNull()
  })

  it('цитата в ответе отдаёт номер наверх', () => {
    const onCitationClick = vi.fn()
    render(
      <AssistantMessage
        text="Факт [1]"
        citations={[{ n: 1, title: 'Вики: регламент' }]}
        onCitationClick={onCitationClick}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Источник 1: Вики: регламент' }))
    expect(onCitationClick).toHaveBeenCalledWith(1)
  })
})
