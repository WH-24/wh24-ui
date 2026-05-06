import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SortPill } from './SortPill'

describe('SortPill', () => {
  it('renders the label', () => {
    render(<SortPill label="Недавние" />)
    expect(screen.getByText('Недавние')).toBeInTheDocument()
  })

  it('uses label as aria-label by default', () => {
    render(<SortPill label="Просмотры" />)
    expect(screen.getByRole('button', { name: 'Просмотры' })).toBeInTheDocument()
  })

  it('fires onClick', async () => {
    const onClick = vi.fn()
    render(<SortPill label="Недавние" onClick={onClick} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
