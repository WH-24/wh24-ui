import type { ReactNode } from 'react'

import styles from './Pill.module.css'

export interface PillProps {
  children: ReactNode
  icon?: ReactNode
  kbd?: string
  ariaLabel?: string
  onClick?: () => void
}

/**
 * Wide pill — used as command-palette trigger in the topbar.
 * Optional left icon + right keyboard-shortcut hint.
 */
export function Pill({ children, icon, kbd, ariaLabel, onClick }: PillProps) {
  return (
    <button
      type="button"
      className={styles.pill}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {icon ? (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className={styles.label}>{children}</span>
      {kbd ? <kbd className={styles.kbd}>{kbd}</kbd> : null}
    </button>
  )
}
