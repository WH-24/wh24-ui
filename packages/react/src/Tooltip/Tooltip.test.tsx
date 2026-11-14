import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Tooltip, resetTooltipWarmth } from './Tooltip'

describe('Tooltip', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetTooltipWarmth()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms))

  it('появляется через 350 мс наведения и связана с элементом через aria-describedby', () => {
    render(
      <Tooltip label="Добавить" shortcut="Ctrl N">
        <button>+</button>
      </Tooltip>,
    )
    const btn = screen.getByRole('button')
    fireEvent.mouseEnter(btn)
    tick(300)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    expect(btn).not.toHaveAttribute('aria-describedby')
    tick(60)
    const tip = screen.getByRole('tooltip')
    expect(tip).toHaveTextContent('Добавить')
    expect(tip.querySelector('kbd')).toHaveTextContent('Ctrl N')
    expect(btn).toHaveAttribute('aria-describedby', tip.id)
    expect(tip).not.toHaveAttribute('data-instant')

    fireEvent.mouseLeave(btn)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('уход курсора до срока отменяет показ', () => {
    render(
      <Tooltip label="Добавить">
        <button>+</button>
      </Tooltip>,
    )
    const btn = screen.getByRole('button')
    fireEvent.mouseEnter(btn)
    tick(200)
    fireEvent.mouseLeave(btn)
    tick(500)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('соседняя подсказка открывается сразу и без анимации', () => {
    render(
      <>
        <Tooltip label="Первая">
          <button>a</button>
        </Tooltip>
        <Tooltip label="Вторая">
          <button>b</button>
        </Tooltip>
      </>,
    )
    const [a, b] = screen.getAllByRole('button')
    fireEvent.mouseEnter(a!)
    tick(350)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Первая')
    fireEvent.mouseLeave(a!)
    fireEvent.mouseEnter(b!)
    const tip = screen.getByRole('tooltip')
    expect(tip).toHaveTextContent('Вторая')
    expect(tip).toHaveAttribute('data-instant')
  })

  it('фокус с клавиатуры открывает сразу, Esc закрывает; свои обработчики элемента живы', () => {
    const onFocus = vi.fn()
    render(
      <Tooltip label="Настройки">
        <button onFocus={onFocus}>⚙</button>
      </Tooltip>,
    )
    const btn = screen.getByRole('button')
    fireEvent.focus(btn)
    expect(onFocus).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Настройки')
    fireEvent.keyDown(btn, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('фокус от щелчка мышью подсказку не открывает, нажатие её убирает', () => {
    render(
      <Tooltip label="Удалить">
        <button>x</button>
      </Tooltip>,
    )
    const btn = screen.getByRole('button')
    fireEvent.pointerDown(btn)
    fireEvent.focus(btn)
    tick(500)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('на сенсорном экране не показывается', () => {
    render(
      <Tooltip label="Удалить">
        <button>x</button>
      </Tooltip>,
    )
    const btn = screen.getByRole('button')
    fireEvent.touchStart(btn)
    fireEvent.mouseEnter(btn)
    fireEvent.focus(btn)
    tick(500)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('disabled — подсказки нет', () => {
    render(
      <Tooltip label="Удалить" disabled>
        <button>x</button>
      </Tooltip>,
    )
    fireEvent.mouseEnter(screen.getByRole('button'))
    tick(500)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
})
