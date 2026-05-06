import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Pill } from './Pill'

describe('Pill', () => {
  it('renders the label children', () => {
    render(<Pill>Поиск, навигация, действия</Pill>)
    expect(screen.getByText('Поиск, навигация, действия')).toBeInTheDocument()
  })

  it('renders kbd hint when provided', () => {
    render(<Pill kbd="⌘K">Открыть</Pill>)
    expect(screen.getByText('⌘K')).toBeInTheDocument()
  })

  it('fires onClick when clicked', async () => {
    const onClick = vi.fn()
    render(
      <Pill ariaLabel="Open palette" onClick={onClick}>
        Открыть
      </Pill>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Open palette' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
