import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { IconButton } from './IconButton'

describe('IconButton', () => {
  it('renders aria-label', () => {
    render(<IconButton ariaLabel="Переключить тему">☀</IconButton>)
    expect(screen.getByRole('button', { name: 'Переключить тему' })).toBeInTheDocument()
  })

  it('fires onClick', async () => {
    const onClick = vi.fn()
    render(
      <IconButton ariaLabel="X" onClick={onClick}>
        ✕
      </IconButton>,
    )
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('IconButton — ref, размер, атрибуты', () => {
  it('отдаёт ref на кнопку, type=button и свой класс', () => {
    const ref = createRef<HTMLButtonElement>()
    render(
      <IconButton ref={ref} ariaLabel="Закрыть" className="mine">
        ×
      </IconButton>,
    )
    const btn = screen.getByRole('button', { name: 'Закрыть' })
    expect(ref.current).toBe(btn)
    expect(btn).toHaveAttribute('type', 'button')
    expect(btn.className).toContain('mine')
    expect(btn).not.toHaveAttribute('data-size')
  })

  it('size=24 помечает кнопку, остальные атрибуты и обработчики проходят', async () => {
    const onKeyDown = vi.fn()
    render(
      <IconButton ariaLabel="Убрать" size={24} data-testid="x" aria-haspopup="menu" onKeyDown={onKeyDown}>
        ×
      </IconButton>,
    )
    const btn = screen.getByTestId('x')
    expect(btn).toHaveAttribute('data-size', '24')
    expect(btn).toHaveAttribute('aria-haspopup', 'menu')
    btn.focus()
    await userEvent.keyboard('a')
    expect(onKeyDown).toHaveBeenCalled()
  })
})

describe('IconButton — состояния', () => {
  it('disabled, aria-expanded и aria-pressed доходят до кнопки', () => {
    render(
      <>
        <IconButton ariaLabel="Выше" disabled>
          ↑
        </IconButton>
        <IconButton ariaLabel="Свернуть" ariaExpanded>
          ▾
        </IconButton>
        <IconButton ariaLabel="В закладки" ariaPressed={false}>
          ☆
        </IconButton>
      </>,
    )
    expect(screen.getByRole('button', { name: 'Выше' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Свернуть' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'В закладки' })).toHaveAttribute('aria-pressed', 'false')
  })
})
