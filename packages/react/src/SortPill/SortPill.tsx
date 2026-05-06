import type { ReactNode } from 'react'

import styles from './SortPill.module.css'

export interface SortPillProps {
  label: string
  iconLeft?: ReactNode
  ariaLabel?: string
  onClick?: () => void
}

/**
 * Compact pill — used to trigger sort/filter dropdowns in card
 * headers (e.g. "↓ Недавние ▾", "▴ Просмотры").
 */
export function SortPill({ label, iconLeft, ariaLabel, onClick }: SortPillProps) {
  return (
    <button
      type="button"
      className={styles.pill}
      aria-label={ariaLabel ?? label}
      onClick={onClick}
    >
      {iconLeft ? <span className={styles.iconLeft}>{iconLeft}</span> : null}
      <span>{label}</span>
      <span className={styles.chev} aria-hidden="true">
        ▾
      </span>
    </button>
  )
}
