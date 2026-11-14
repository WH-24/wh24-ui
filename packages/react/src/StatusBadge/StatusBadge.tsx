import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'

import { cx } from '../popup/popup.js'

import styles from './StatusBadge.module.css'

export type StatusBadgeTone = 'neutral' | 'good' | 'warn' | 'info' | 'bad' | 'brand'

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: StatusBadgeTone
  /** Точка перед текстом — когда статус читают в плотной таблице. */
  dot?: boolean
  children: ReactNode
}

/**
 * Статус записи плашкой: «В работе», «Согласован», «Просрочен». Только
 * показывает — не кнопка и не фильтр (для них `Chip`). Смысл несёт текст,
 * цвет его лишь подкрепляет.
 */
export const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(function StatusBadge(
  { tone = 'neutral', dot = false, children, className, ...rest },
  ref,
) {
  return (
    <span {...rest} ref={ref} className={cx(styles.badge, styles[tone], className)}>
      {dot && <span className={styles.dot} aria-hidden="true" />}
      <span className={styles.text}>{children}</span>
    </span>
  )
})
