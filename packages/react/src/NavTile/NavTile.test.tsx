import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { NavTile } from './NavTile'

describe('NavTile', () => {
  it('renders name, sub, and a default <a> with href', () => {
    render(<NavTile href="/browser" name="Браузер" sub="Все 247 материалов" icon={<span>i</span>} />)
    const link = screen.getByRole('link', { name: /Браузер/ })
    expect(link).toHaveAttribute('href', '/browser')
    expect(screen.getByText('Все 247 материалов')).toBeInTheDocument()
  })

  it('uses custom renderLink when provided', () => {
    const renderLink = (props: { href: string; className?: string; children: React.ReactNode }) => (
      <a data-testid="custom" href={props.href} className={props.className}>
        {props.children}
      </a>
    )
    render(
      <NavTile
        href="/x"
        name="X"
        sub="X sub"
        icon={<span>i</span>}
        renderLink={renderLink}
      />,
    )
    expect(screen.getByTestId('custom')).toHaveAttribute('href', '/x')
  })
})
