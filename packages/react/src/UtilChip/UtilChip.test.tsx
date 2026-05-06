import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { UtilChip } from './UtilChip'

describe('UtilChip', () => {
  it('renders as a default <a> when href is given', () => {
    render(<UtilChip label="Онбординг" href="/onboarding" />)
    const link = screen.getByRole('link', { name: /Онбординг/ })
    expect(link).toHaveAttribute('href', '/onboarding')
  })

  it('renders as a button when href is absent', () => {
    render(<UtilChip label="Что нового" />)
    expect(screen.getByRole('button', { name: /Что нового/ })).toBeInTheDocument()
  })

  it('renders badge', () => {
    render(<UtilChip label="Граф связей" badge="скоро" />)
    expect(screen.getByText('скоро')).toBeInTheDocument()
  })

  it('renders disabled as a static span (no role=button/link)', () => {
    render(<UtilChip label="Граф связей" badge="скоро" disabled />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('applies onboard variant', () => {
    const { container } = render(<UtilChip label="Онбординг" variant="onboard" />)
    expect(container.firstElementChild?.className).toMatch(/onboard/)
  })

  it('uses custom renderLink when provided', () => {
    const renderLink = (props: { href: string; className?: string; children: React.ReactNode }) => (
      <a data-testid="custom" href={props.href} className={props.className}>
        {props.children}
      </a>
    )
    render(<UtilChip label="X" href="/x" renderLink={renderLink} />)
    expect(screen.getByTestId('custom')).toHaveAttribute('href', '/x')
  })
})
