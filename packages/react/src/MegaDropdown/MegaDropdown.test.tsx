import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { MegaDropdown } from './MegaDropdown'

describe('MegaDropdown', () => {
  it('renders nothing when open is false', () => {
    render(
      <MegaDropdown open={false} onClose={() => {}} ariaLabel="Filters">
        <p>panel</p>
      </MegaDropdown>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders dialog with aria-label when open', () => {
    render(
      <MegaDropdown open onClose={() => {}} ariaLabel="Filters">
        <button>opt</button>
      </MegaDropdown>,
    )
    expect(screen.getByRole('dialog', { name: 'Filters' })).toBeInTheDocument()
  })

  it('focuses first focusable element on open', () => {
    render(
      <MegaDropdown open onClose={() => {}} ariaLabel="Filters">
        <button>opt</button>
      </MegaDropdown>,
    )
    expect(screen.getByRole('button', { name: 'opt' })).toHaveFocus()
  })

  it('calls onClose on Escape', async () => {
    const onClose = vi.fn()
    render(
      <MegaDropdown open onClose={onClose} ariaLabel="Filters">
        <button>opt</button>
      </MegaDropdown>,
    )
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders footer slot when provided', () => {
    render(
      <MegaDropdown
        open
        onClose={() => {}}
        ariaLabel="Filters"
        footer={<button>Apply</button>}
      >
        <button>opt</button>
      </MegaDropdown>,
    )
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument()
  })
})
