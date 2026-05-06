import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Avatar } from './Avatar'

describe('Avatar', () => {
  it('renders initials', () => {
    render(<Avatar initials="АА" />)
    expect(screen.getByText('АА')).toBeInTheDocument()
  })

  it('uses ariaLabel when provided', () => {
    render(<Avatar initials="АА" ariaLabel="Профиль Анны" />)
    expect(screen.getByRole('button', { name: 'Профиль Анны' })).toBeInTheDocument()
  })

  it('falls back to initials in default aria-label', () => {
    render(<Avatar initials="ЕП" />)
    expect(screen.getByRole('button', { name: 'Профиль ЕП' })).toBeInTheDocument()
  })

  it('fires onClick', async () => {
    const onClick = vi.fn()
    render(<Avatar initials="АА" onClick={onClick} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
