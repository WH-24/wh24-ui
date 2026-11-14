import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HoverCard } from './HoverCard'

describe('HoverCard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
  const card = () => screen.queryByText('Главный архитектор')

  function setup(onOpenChange?: (o: boolean) => void) {
    render(
      <HoverCard content={<div>Главный архитектор</div>} onOpenChange={onOpenChange}>
        <a href="#p">Анна Соколова</a>
      </HoverCard>,
    )
    return screen.getByRole('link', { name: 'Анна Соколова' })
  }

  it('открывается через полсекунды наведения, не раньше', () => {
    const onOpenChange = vi.fn()
    const link = setup(onOpenChange)
    fireEvent.mouseEnter(link)
    tick(400)
    expect(card()).not.toBeInTheDocument()
    tick(150)
    expect(card()).toBeInTheDocument()
    expect(onOpenChange).toHaveBeenLastCalledWith(true)
  })

  it('остаётся открытой, пока курсор на карточке; уход закрывает', () => {
    const link = setup()
    fireEvent.mouseEnter(link)
    tick(500)
    fireEvent.mouseLeave(link)
    fireEvent.mouseEnter(card()!.parentElement!)
    tick(1000)
    expect(card()).toBeInTheDocument()
    fireEvent.mouseLeave(card()!.parentElement!)
    tick(200)
    expect(card()).not.toBeInTheDocument()
  })

  it('короткое наведение карточку не открывает', () => {
    const link = setup()
    fireEvent.mouseEnter(link)
    tick(200)
    fireEvent.mouseLeave(link)
    tick(1000)
    expect(card()).not.toBeInTheDocument()
  })

  it('фокус с клавиатуры открывает, Esc закрывает', () => {
    const onOpenChange = vi.fn()
    const link = setup(onOpenChange)
    fireEvent.focus(link)
    tick(500)
    expect(card()).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(card()).not.toBeInTheDocument()
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })

  it('на сенсорном экране не открывается', () => {
    const link = setup()
    fireEvent.touchStart(link)
    fireEvent.mouseEnter(link)
    tick(1000)
    expect(card()).not.toBeInTheDocument()
  })
})
