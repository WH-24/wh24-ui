import { forwardRef, type HTMLAttributes } from 'react'

import { cx } from '../popup/popup.js'

import styles from './ProgressBar.module.css'

export type ProgressBarTone = 'brand' | 'good' | 'bad'

export interface ProgressBarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Доля выполнения, 0–100. Не задана — «идёт, сколько осталось неизвестно». */
  value?: number
  tone?: ProgressBarTone
  /** `sm` — 2px (под строкой файла), `md` — 4px. */
  size?: 'sm' | 'md'
  /** Что именно выполняется — для читалки. */
  ariaLabel?: string
}

/**
 * Полоса выполнения. С `value` — заполняется (через `transform: scaleX`, без
 * перерасчёта раскладки); без него — бегущий отрезок.
 */
export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(function ProgressBar(
  { value, tone = 'brand', size = 'md', ariaLabel = 'Выполнение', className, ...rest },
  ref,
) {
  const known = typeof value === 'number' && Number.isFinite(value)
  const v = known ? Math.min(100, Math.max(0, value)) : undefined
  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v === undefined ? undefined : Math.round(v)}
      {...rest}
      ref={ref}
      className={cx(styles.track, styles[size], styles[tone], className)}
      data-indeterminate={v === undefined || undefined}
    >
      <span className={styles.fill} style={v === undefined ? undefined : { transform: `scaleX(${v / 100})` }} />
    </div>
  )
})
