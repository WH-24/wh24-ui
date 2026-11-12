import type { ReactNode } from 'react'

import { Icon } from '../list/Icon.js'

import styles from './Chip.module.css'

export type ChipVariant = 'default' | 'tag'

export interface ChipProps {
  children: ReactNode
  variant?: ChipVariant
  onRemove?: () => void
  removeLabel?: string
}

/**
 * Pill-shaped chip — neutral or tag variant. Optional remove button
 * (× icon) appears when `onRemove` is provided.
 */
export function Chip({
  children,
  variant = 'default',
  onRemove,
  removeLabel = 'Удалить',
}: ChipProps) {
  const label = removeLabel
  const className = variant === 'tag' ? `${styles.chip} ${styles.tag}` : styles.chip
  return (
    <span className={className}>
      {children}
      {onRemove ? (
        <button
          type="button"
          className={styles.remove}
          aria-label={label}
          onClick={onRemove}
        >
          <Icon name="close" size={12} />
        </button>
      ) : null}
    </span>
  )
}
