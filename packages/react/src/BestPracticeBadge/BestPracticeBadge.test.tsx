import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BestPracticeBadge } from './BestPracticeBadge'

describe('BestPracticeBadge', () => {
  it('renders default label', () => {
    render(<BestPracticeBadge />)
    expect(screen.getByText('Best practice')).toBeInTheDocument()
  })

  it('respects a custom label', () => {
    render(<BestPracticeBadge label="Эталон" />)
    expect(screen.getByText('Эталон')).toBeInTheDocument()
  })
})
