import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Card } from './Card'

describe('Card', () => {
  it('renders cover slot when variant is cover', () => {
    render(
      <Card variant="cover" cover={<div data-testid="cv" />}>
        <h3>Title</h3>
      </Card>,
    )
    expect(screen.getByTestId('cv')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Title' })).toBeInTheDocument()
  })

  it('skips cover slot when variant is noCover', () => {
    render(
      <Card variant="noCover" cover={<div data-testid="cv" />}>
        <h3>Standard</h3>
      </Card>,
    )
    expect(screen.queryByTestId('cv')).not.toBeInTheDocument()
  })

  it('shows BestPracticeBadge when bestPractice is true', () => {
    render(
      <Card variant="cover" bestPractice>
        <h3>Top</h3>
      </Card>,
    )
    expect(screen.getByText('Best practice')).toBeInTheDocument()
  })

  it('fires onClick when card is clicked', async () => {
    const onClick = vi.fn()
    render(
      <Card variant="noCover" onClick={onClick}>
        <h3>Click me</h3>
      </Card>,
    )
    await userEvent.click(screen.getByRole('article'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
