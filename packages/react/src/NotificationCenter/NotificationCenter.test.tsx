import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { NotificationCenter, type NotificationItem } from './NotificationCenter'

const ITEMS: NotificationItem[] = [
  { id: '1', who: 'Анна Соколова', text: 'упомянула вас в проекте «Школа»', time: '5 минут назад', unread: true },
  { id: '2', who: 'Ольга Демченко', text: 'согласовала отчёт времени', time: 'час назад', unread: true },
  { id: '3', who: 'Павел Ефимов', text: 'загрузил модель', time: 'вчера' },
]

describe('NotificationCenter', () => {
  it('колокольчик: счётчик и подпись с числом непрочитанных', () => {
    const { rerender } = render(<NotificationCenter items={ITEMS} />)
    const bell = screen.getByRole('button', { name: 'Уведомления, непрочитанных: 2' })
    expect(bell).toHaveAttribute('aria-expanded', 'false')
    expect(bell.parentElement).toHaveTextContent('2')

    rerender(<NotificationCenter items={ITEMS.map((x) => ({ ...x, unread: false }))} />)
    expect(screen.getByRole('button', { name: 'Уведомления' })).toBeInTheDocument()

    rerender(<NotificationCenter items={ITEMS} unreadCount={250} />)
    expect(screen.getByRole('button', { name: /непрочитанных: 250/ }).parentElement).toHaveTextContent('99+')
  })

  it('щелчок открывает список; щелчок по уведомлению отдаёт его хозяину', async () => {
    const onItemClick = vi.fn()
    render(<NotificationCenter items={ITEMS} onItemClick={onItemClick} />)
    await userEvent.click(screen.getByRole('button', { name: /Уведомления/ }))
    const dialog = screen.getByRole('dialog', { name: 'Уведомления' })
    expect(screen.getByRole('button', { name: /Уведомления, / })).toHaveAttribute('aria-expanded', 'true')
    const rows = within(dialog).getAllByRole('button')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('Анна Соколова упомянула вас в проекте «Школа»')
    expect(rows[0]).toHaveTextContent('5 минут назад')
    expect(rows[0]).toHaveAttribute('data-unread')
    expect(rows[2]).not.toHaveAttribute('data-unread')
    await userEvent.click(rows[1]!)
    expect(onItemClick).toHaveBeenCalledWith(expect.objectContaining({ id: '2' }))
    // По умолчанию список остаётся открытым — можно прочитать следующее.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('«Прочитать все» зовёт обработчик; без непрочитанных — выключена', async () => {
    const onMarkAllRead = vi.fn()
    const { rerender } = render(<NotificationCenter items={ITEMS} onMarkAllRead={onMarkAllRead} />)
    await userEvent.click(screen.getByRole('button', { name: /Уведомления/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Прочитать все' }))
    expect(onMarkAllRead).toHaveBeenCalledTimes(1)
    rerender(<NotificationCenter items={[ITEMS[2]!]} onMarkAllRead={onMarkAllRead} />)
    expect(screen.getByRole('button', { name: 'Прочитать все' })).toBeDisabled()
  })

  it('Esc закрывает и возвращает фокус на колокольчик; щелчок мимо закрывает', async () => {
    render(
      <>
        <NotificationCenter items={ITEMS} />
        <button>Мимо</button>
      </>,
    )
    const bell = screen.getByRole('button', { name: /Уведомления/ })
    await userEvent.click(bell)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(bell).toHaveFocus()

    await userEvent.click(bell)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Мимо' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('пустой список — текст-заглушка; управляемое открытие', async () => {
    const onOpenChange = vi.fn()
    render(<NotificationCenter items={[]} open onOpenChange={onOpenChange} />)
    expect(screen.getByText('Новых уведомлений нет')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Уведомления' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    // Управляемый: без смены пропа остаётся открытым.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('стрелки, Home и End ходят по уведомлениям', async () => {
    render(<NotificationCenter items={ITEMS} />)
    await userEvent.click(screen.getByRole('button', { name: /Уведомления/ }))
    const rows = within(screen.getByRole('dialog')).getAllByRole('button')
    await userEvent.keyboard('{ArrowDown}')
    expect(rows[0]).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(rows[1]).toHaveFocus()
    await userEvent.keyboard('{End}')
    expect(rows[2]).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(rows[2]).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(rows[0]).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    expect(rows[0]).toHaveFocus()
  })

  it('закрытие щелчком по уведомлению возвращает фокус на колокольчик', async () => {
    render(<NotificationCenter items={ITEMS} closeOnItemClick />)
    const bell = screen.getByRole('button', { name: /Уведомления/ })
    await userEvent.click(bell)
    await userEvent.click(within(screen.getByRole('dialog')).getAllByRole('button')[1]!)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(bell).toHaveFocus()
  })

  it('фокус ушёл с клавиатуры дальше по странице — список закрывается', async () => {
    render(
      <>
        <NotificationCenter items={ITEMS} />
        <button>Дальше</button>
      </>,
    )
    await userEvent.click(screen.getByRole('button', { name: /Уведомления/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    screen.getByRole('button', { name: 'Дальше' }).focus()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Дальше' })).toHaveFocus()
  })
})
