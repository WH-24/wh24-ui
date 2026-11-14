import { forwardRef, type HTMLAttributes } from 'react'

import { cx } from '../popup/popup.js'

import styles from './Spinner.module.css'

export type SpinnerSize = 12 | 16 | 24 | 32

export interface SpinnerProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Диаметр, px: 12 — в ячейке, 16 — в строке (по умолчанию), 24 и 32 — в блоке. */
  size?: SpinnerSize
  /**
   * Подпись для читалки («Загрузка»). Без неё кольцо скрыто от читалки —
   * о загрузке говорит текст рядом или контейнер (`aria-busy`, `Loader`).
   */
  label?: string
}

/**
 * Кольцо ожидания — одно на библиотеку: один кадр вращения, скорость
 * `--dur-spin`; при «уменьшить движение» не замирает (застывшее выглядит
 * поломкой), а крутится медленнее (`--dur-spin-reduced`). Цвет головки —
 * `currentColor` контейнера нельзя: всегда терракот бренда.
 */
export const Spinner = forwardRef<HTMLSpanElement, SpinnerProps>(function Spinner(
  { size = 16, label, className, ...rest },
  ref,
) {
  return (
    <span
      {...(label ? { role: 'status', 'aria-label': label } : { 'aria-hidden': true })}
      {...rest}
      ref={ref}
      className={cx(styles.spinner, className)}
      data-size={size === 16 ? undefined : size}
    />
  )
})
