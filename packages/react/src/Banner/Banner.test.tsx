import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Banner } from './Banner'

describe('Banner', () => {
  it('по умолчанию — status, для ошибки — alert', () => {
    const { rerender } = render(<Banner>Отчёты закрываются автоматически.</Banner>)
    expect(screen.getByRole('status')).toHaveTextContent('Отчёты закрываются автоматически.')
    rerender(<Banner tone="bad">Не удалось сохранить.</Banner>)
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось сохранить.')
  })

  it('действие и крестик: крестик зовёт onDismiss, без него крестика нет', async () => {
    const onDismiss = vi.fn()
    const onAction = vi.fn()
    const { rerender } = render(
      <Banner tone="warn" onDismiss={onDismiss} action={<button onClick={onAction}>Напомнить</button>}>
        Не заполнен отчёт.
      </Banner>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Напомнить' }))
    expect(onAction).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Скрыть сообщение' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)

    rerender(<Banner tone="warn">Не заполнен отчёт.</Banner>)
    expect(screen.queryByRole('button', { name: 'Скрыть сообщение' })).not.toBeInTheDocument()
  })

  it('крестик доступен с клавиатуры; className и атрибуты доходят до корня', async () => {
    const onDismiss = vi.fn()
    render(
      <Banner tone="good" onDismiss={onDismiss} dismissLabel="Закрыть" className="mine" data-testid="b">
        Сохранено.
      </Banner>,
    )
    expect(screen.getByTestId('b')).toHaveClass('mine')
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Закрыть' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
