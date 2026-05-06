import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Chip } from './Chip'

describe('Chip', () => {
  it('renders children', () => {
    render(<Chip>concrete</Chip>)
    expect(screen.getByText('concrete')).toBeInTheDocument()
  })

  it('does not render remove button when onRemove is absent', () => {
    render(<Chip>plain</Chip>)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('calls onRemove when × is clicked', async () => {
    const onRemove = vi.fn()
    render(
      <Chip variant="tag" onRemove={onRemove}>
        concrete
      </Chip>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Удалить' }))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })
})
