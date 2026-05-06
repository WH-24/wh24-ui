import type { ReactElement, ReactNode } from 'react'

import { Avatar } from '../Avatar/Avatar.js'
import { IconButton } from '../IconButton/IconButton.js'
import { Pill } from '../Pill/Pill.js'

import styles from './AppShell.module.css'

export interface AppShellLinkRendererProps {
  href: string
  className?: string
  children: ReactNode
  ariaLabel?: string
}

export interface AppShellProps {
  children: ReactNode

  /** User identity for avatar + greeting. */
  user: {
    initials: string
    name: string
  }

  /** Triggered when the command-palette pill is clicked. */
  onSearchClick: () => void

  /** Triggered when the theme toggle button is clicked. */
  onThemeToggle?: () => void

  /** URL of the home page (where brand-click navigates). Default '/'. */
  homeHref?: string

  /**
   * Optional custom link renderer for the brand. Default — plain `<a>`.
   * Pass a router-aware Link for SPA navigation:
   * `renderLink={(p) => <Link to={p.href} className={p.className} aria-label={p.ariaLabel}>{p.children}</Link>}`
   */
  renderLink?: (props: AppShellLinkRendererProps) => ReactElement

  /**
   * Optional placement of additional controls in the right-hand block
   * (e.g. role-toggle in admin). Rendered before Avatar.
   */
  rightExtras?: ReactNode

  /** Search pill placeholder text. Default — Russian. */
  searchPlaceholder?: string

  /** Search pill keyboard shortcut hint. Default '⌘ K'. */
  searchKbd?: string
}

const defaultLink = ({ href, className, children, ariaLabel }: AppShellLinkRendererProps) => (
  <a href={href} className={className} aria-label={ariaLabel}>
    {children}
  </a>
)

/**
 * Application shell — sticky topbar with brand, command-palette pill,
 * theme toggle, optional admin/role extras, and avatar.
 *
 * No vertical sidebar (per product principle: «без сайдбаров»).
 * Admin shell is a separate component that includes a sidebar
 * (intentional exception, lives in admin-specific package).
 */
export function AppShell({
  children,
  user,
  onSearchClick,
  onThemeToggle,
  homeHref = '/',
  renderLink = defaultLink,
  rightExtras,
  searchPlaceholder = 'Поиск, навигация, действия',
  searchKbd = '⌘ K',
}: AppShellProps) {
  const brand = renderLink({
    href: homeHref,
    className: styles.brand,
    ariaLabel: 'На главную',
    children: (
      <>
        <span className={styles.blogo} aria-hidden="true" />
        <span className={styles.bname}>Wowhaus</span>
      </>
    ),
  })

  return (
    <div className={styles.root}>
      <header className={styles.topbar}>
        {brand}

        <Pill
          ariaLabel="Открыть палитру команд"
          icon={<SearchGlyph />}
          kbd={searchKbd}
          onClick={onSearchClick}
        >
          {searchPlaceholder}
        </Pill>

        <div className={styles.right}>
          {rightExtras}
          {onThemeToggle ? (
            <IconButton ariaLabel="Переключить тему" onClick={onThemeToggle}>
              <SunGlyph />
            </IconButton>
          ) : null}
          <Avatar initials={user.initials} ariaLabel={`Профиль ${user.name}`} />
        </div>
      </header>

      <main className={styles.page}>{children}</main>
    </div>
  )
}

function SearchGlyph() {
  return (
    <svg viewBox="0 0 14 14" fill="none" width="14" height="14">
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M9.5 9.5 12.5 12.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

function SunGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 1.5v1.6M8 12.9v1.6M14.5 8h-1.6M3.1 8H1.5M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1M12.6 12.6l-1.1-1.1M4.5 4.5 3.4 3.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}
