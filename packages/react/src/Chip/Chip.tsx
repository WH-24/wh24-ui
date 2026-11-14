import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { Icon } from '../list/Icon.js'

import styles from './Chip.module.css'

export type ChipVariant = 'default' | 'tag'

export interface ChipProps {
  children: ReactNode
  variant?: ChipVariant
  onRemove?: () => void
  removeLabel?: string
  /** Свой класс чипа (предел ширины, жирность). */
  className?: string
  /** Атрибуты кнопки «убрать» (например, `onMouseDown`, чтобы щелчок не открыл поле вокруг). */
  removeButtonProps?: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'onClick' | 'aria-label'>
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
  className: own,
  removeButtonProps,
}: ChipProps) {
  const label = removeLabel
  const className = [styles.chip, variant === 'tag' ? styles.tag : '', own ?? ''].filter(Boolean).join(' ')
  return (
    <span className={className}>
      {/* Подпись отдельным элементом: длинный тег обрезается многоточием,
          полный текст — в подсказке. */}
      <span className={styles.label} title={typeof children === 'string' ? children : undefined}>
        {children}
      </span>
      {onRemove ? (
        <button
          {...removeButtonProps}
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
