import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TypeMarker } from './TypeMarker'

describe('TypeMarker', () => {
  it('renders project marker with localized aria-label', () => {
    render(<TypeMarker type="project" />)
    expect(screen.getByRole('img', { name: 'Проект' })).toBeInTheDocument()
  })

  it('falls back to a generic label when no type is given', () => {
    render(<TypeMarker />)
    expect(screen.getByRole('img', { name: 'Без типа' })).toBeInTheDocument()
  })

  it('applies active modifier when active', () => {
    const { container } = render(<TypeMarker type="project" active />)
    const dot = container.firstElementChild
    expect(dot?.className).toMatch(/active/)
  })
})
