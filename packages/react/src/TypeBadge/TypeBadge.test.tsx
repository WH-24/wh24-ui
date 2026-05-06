import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TypeBadge } from './TypeBadge'

describe('TypeBadge', () => {
  it('renders the localized label by default', () => {
    render(<TypeBadge type="solution" />)
    expect(screen.getByText('Решение')).toBeInTheDocument()
  })

  it('respects a custom label', () => {
    render(<TypeBadge type="project" label="Custom" />)
    expect(screen.getByText('Custom')).toBeInTheDocument()
  })

  it('applies the type modifier class', () => {
    const { container } = render(<TypeBadge type="article" />)
    expect(container.firstElementChild?.className).toMatch(/article/)
  })
})
