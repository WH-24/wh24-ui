import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AppShell } from './AppShell'

describe('AppShell', () => {
  it('renders brand, search pill, and avatar with given user', () => {
    render(
      <AppShell user={{ initials: 'АК', name: 'Антон Краснов' }} onSearchClick={() => {}}>
        <main>content</main>
      </AppShell>,
    )
    // Brand link
    expect(screen.getByRole('link', { name: 'На главную' })).toHaveAttribute('href', '/')
    // Search pill (Pill renders aria-label "Открыть палитру команд")
    expect(screen.getByRole('button', { name: 'Открыть палитру команд' })).toBeInTheDocument()
    // Avatar
    expect(screen.getByRole('button', { name: 'Профиль Антон Краснов' })).toBeInTheDocument()
    expect(screen.getByText('АК')).toBeInTheDocument()
  })

  it('fires onSearchClick when pill is clicked', async () => {
    const onSearchClick = vi.fn()
    render(
      <AppShell user={{ initials: 'АА', name: 'A' }} onSearchClick={onSearchClick}>
        <span>x</span>
      </AppShell>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Открыть палитру команд' }))
    expect(onSearchClick).toHaveBeenCalledTimes(1)
  })

  it('renders theme toggle when onThemeToggle is provided', () => {
    render(
      <AppShell
        user={{ initials: 'АА', name: 'A' }}
        onSearchClick={() => {}}
        onThemeToggle={() => {}}
      >
        <span>x</span>
      </AppShell>,
    )
    expect(screen.getByRole('button', { name: 'Переключить тему' })).toBeInTheDocument()
  })

  it('skips theme toggle when onThemeToggle is absent', () => {
    render(
      <AppShell user={{ initials: 'АА', name: 'A' }} onSearchClick={() => {}}>
        <span>x</span>
      </AppShell>,
    )
    expect(screen.queryByRole('button', { name: 'Переключить тему' })).not.toBeInTheDocument()
  })

  it('uses custom homeHref', () => {
    render(
      <AppShell user={{ initials: 'АА', name: 'A' }} onSearchClick={() => {}} homeHref="/dashboard">
        <span>x</span>
      </AppShell>,
    )
    expect(screen.getByRole('link', { name: 'На главную' })).toHaveAttribute('href', '/dashboard')
  })

  // Apps embedded into the portal drop the topbar: the portal's own —
  // same brand, same pill, same avatar — already sits right above.
  it('renders no topbar when showTopbar is false', () => {
    render(
      <AppShell user={{ initials: 'АА', name: 'A' }} onSearchClick={() => {}} showTopbar={false}>
        <span>content</span>
      </AppShell>,
    )
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'На главную' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Открыть палитру команд' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Профиль A' })).not.toBeInTheDocument()
    // Содержимое приложения на месте — убирается только шапка.
    expect(screen.getByText('content')).toBeInTheDocument()
  })

  it('renders rightExtras before avatar', () => {
    render(
      <AppShell
        user={{ initials: 'АА', name: 'A' }}
        onSearchClick={() => {}}
        rightExtras={<button>Role</button>}
      >
        <span>x</span>
      </AppShell>,
    )
    expect(screen.getByRole('button', { name: 'Role' })).toBeInTheDocument()
  })
})
