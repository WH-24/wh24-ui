import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

import styles from './IconButton.module.css'

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'title' | 'aria-label'> {
  ariaLabel: string
  children: ReactNode
  /** Сторона квадрата, px: 32 (по умолчанию) или 24 — в плотных строках и чипах. */
  size?: 32 | 24
  /** Кнопка раскрывает/сворачивает блок — читалка объявит состояние. */
  ariaExpanded?: boolean
  /** Кнопка-переключатель (закладка, «в избранном»). */
  ariaPressed?: boolean
  /** Подсказка при наведении; по умолчанию — та же, что `ariaLabel`. */
  title?: string
}

/**
 * Квадратная кнопка-значок (32×32 или 24×24): шапка, панели действий,
 * «Закрыть» окна, «⋯» меню. Принимает `ref`, `className` и любые атрибуты
 * кнопки — её можно класть якорем в меню и подсказку.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { ariaLabel, children, size = 32, ariaExpanded, ariaPressed, title, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      aria-expanded={ariaExpanded}
      aria-pressed={ariaPressed}
      {...rest}
      ref={ref}
      type={type}
      className={className ? `${styles.btn} ${className}` : styles.btn}
      data-size={size === 24 ? '24' : undefined}
      aria-label={ariaLabel}
      title={title ?? ariaLabel}
    >
      <span className={styles.icon} aria-hidden="true">
        {children}
      </span>
    </button>
  )
})
