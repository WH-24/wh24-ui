import type { ReactElement, ReactNode } from 'react'

import styles from './UtilChip.module.css'

export type UtilChipVariant = 'default' | 'onboard'

/**
 * Props passed to a custom link renderer. Mirror common attributes
 * of `<a>` so libraries like react-router-dom Link work out of the box.
 */
export interface UtilChipLinkRendererProps {
  href: string
  className?: string
  children: ReactNode
  onClick?: () => void
}

export interface UtilChipProps {
  label: string
  icon?: ReactNode
  badge?: string
  variant?: UtilChipVariant
  /** If provided — chip renders as a link to this URL. */
  href?: string
  /**
   * Optional custom link component. Default — plain `<a>`. Pass a
   * router-aware Link (e.g. `react-router-dom`) when you need
   * SPA navigation:
   * `renderLink={(props) => <Link to={props.href} {...props} />}`
   */
  renderLink?: (props: UtilChipLinkRendererProps) => ReactElement
  disabled?: boolean
  onClick?: () => void
}

const defaultLink = ({ href, className, children, onClick }: UtilChipLinkRendererProps) => (
  <a href={href} className={className} onClick={onClick}>
    {children}
  </a>
)

/**
 * Bordered chip used in footer rows / utility navigation.
 * Three render modes:
 * - `disabled` → static `<span>` with no role (e.g. "скоро" placeholder)
 * - `href` set → link (default `<a>`, override via `renderLink`)
 * - otherwise → `<button>`
 */
export function UtilChip({
  label,
  icon,
  badge,
  variant = 'default',
  href,
  renderLink = defaultLink,
  disabled = false,
  onClick,
}: UtilChipProps) {
  const className = [
    styles.chip,
    variant === 'onboard' ? styles.onboard : '',
    disabled ? styles.disabled : '',
  ]
    .filter(Boolean)
    .join(' ')

  const content = (
    <>
      {icon ? (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span>{label}</span>
      {badge ? <span className={styles.badge}>{badge}</span> : null}
    </>
  )

  if (disabled) {
    return (
      <span className={className} aria-disabled="true">
        {content}
      </span>
    )
  }

  if (href) {
    return renderLink({ href, className, onClick, children: content })
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      {content}
    </button>
  )
}
