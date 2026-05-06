import type { ReactNode } from 'react'

import styles from './IconButton.module.css'

export interface IconButtonProps {
  ariaLabel: string
  children: ReactNode
  onClick?: () => void
}

/**
 * Square 32×32 icon-only button. Used in topbar (theme toggle,
 * admin link), action bars, and similar places.
 */
export function IconButton({ ariaLabel, children, onClick }: IconButtonProps) {
  return (
    <button
      type="button"
      className={styles.btn}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <span className={styles.icon} aria-hidden="true">
        {children}
      </span>
    </button>
  )
}
