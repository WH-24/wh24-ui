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

  it('после закрытия одной карточки соседняя открывается почти сразу', () => {
    render(
      <>
        <HoverCard content={<div>Карточка А</div>}>
          <a href="#a">Анна</a>
        </HoverCard>
        <HoverCard content={<div>Карточка Б</div>}>
          <a href="#b">Борис</a>
        </HoverCard>
      </>,
    )
    const a = screen.getByRole('link', { name: 'Анна' })
    const b = screen.getByRole('link', { name: 'Борис' })
    fireEvent.mouseEnter(a)
    tick(500)
    expect(screen.getByText('Карточка А')).toBeInTheDocument()
    fireEvent.mouseLeave(a)
    fireEvent.mouseEnter(b)
    tick(50)
    expect(screen.queryByText('Карточка Б')).not.toBeInTheDocument()
    tick(50)
    expect(screen.getByText('Карточка Б')).toBeInTheDocument()

    // Пауза дольше окна — снова обычная задержка.
    fireEvent.mouseLeave(b)
    tick(1000)
    fireEvent.mouseEnter(a)
    tick(200)
    expect(screen.queryByText('Карточка А')).not.toBeInTheDocument()
    tick(350)
    expect(screen.getByText('Карточка А')).toBeInTheDocument()
  })

  describe('openOnTap', () => {
    function setupTap(onClick?: () => void) {
      const onOpenChange = vi.fn()
      render(
        <>
          <HoverCard content={<div>Главный архитектор</div>} onOpenChange={onOpenChange} openOnTap>
            <button type="button" onClick={onClick}>
              Анна Соколова
            </button>
          </HoverCard>
          <p>Снаружи</p>
        </>,
      )
      return {
        btn: screen.getByRole('button', { name: 'Анна Соколова' }),
        onOpenChange,
      }
    }

    it('касание открывает сразу, повторное — закрывает', () => {
      const onClick = vi.fn()
      const { btn, onOpenChange } = setupTap(onClick)
      expect(btn).toHaveAttribute('aria-expanded', 'false')
      fireEvent.touchStart(btn)
      fireEvent.click(btn)
      expect(card()).toBeInTheDocument()
      expect(btn).toHaveAttribute('aria-expanded', 'true')
      expect(btn.getAttribute('aria-controls')).toBe(card()!.parentElement!.id)
      expect(onOpenChange).toHaveBeenLastCalledWith(true)
      // Свой обработчик щелчка у якоря сохраняется.
      expect(onClick).toHaveBeenCalledTimes(1)
      fireEvent.touchStart(btn)
      fireEvent.click(btn)
      expect(card()).not.toBeInTheDocument()
      expect(onOpenChange).toHaveBeenLastCalledWith(false)
    })

    it('касание мимо закрывает, касание по карточке — нет', () => {
      const { btn } = setupTap()
      fireEvent.click(btn)
      fireEvent.pointerDown(card()!)
      expect(card()).toBeInTheDocument()
      fireEvent.pointerDown(screen.getByText('Снаружи'))
      expect(card()).not.toBeInTheDocument()
    })

    it('наведение мышью работает как прежде', () => {
      const { btn } = setupTap()
      fireEvent.mouseEnter(btn)
      tick(500)
      expect(card()).toBeInTheDocument()
    })

    it('без openOnTap щелчок карточку не открывает', () => {
      const link = setup()
      fireEvent.click(link)
      expect(card()).not.toBeInTheDocument()
      expect(link).not.toHaveAttribute('aria-expanded')
    })
  })
})
