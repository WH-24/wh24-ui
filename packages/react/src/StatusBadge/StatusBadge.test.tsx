import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'

import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it('рисует текст; тон меняет класс', () => {
    const { rerender } = render(<StatusBadge data-testid="b">В работе</StatusBadge>)
    const neutral = screen.getByTestId('b').className
    expect(screen.getByText('В работе')).toBeInTheDocument()
    rerender(
      <StatusBadge data-testid="b" tone="good">
        Согласован
      </StatusBadge>,
    )
    expect(screen.getByTestId('b').className).not.toBe(neutral)
  })

  it('точка — оформление, читалке не видна', () => {
    const { container } = render(
      <StatusBadge tone="bad" dot>
        Просрочен
      </StatusBadge>,
    )
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
    expect(container).toHaveTextContent('Просрочен')
  })

  it('ref, className и атрибуты доходят до корня', () => {
    const ref = createRef<HTMLSpanElement>()
    render(
      <StatusBadge ref={ref} className="mine" title="Статус">
        Черновик
      </StatusBadge>,
    )
    expect(ref.current).toHaveClass('mine')
    expect(ref.current).toHaveAttribute('title', 'Статус')
  })
})
