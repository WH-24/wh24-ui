import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
