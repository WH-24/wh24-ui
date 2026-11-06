import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AssistantMessage } from './AssistantMessage'

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
