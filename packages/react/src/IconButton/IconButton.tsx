import type { ReactNode } from 'react'

import styles from './IconButton.module.css'

export interface IconButtonProps {
  ariaLabel: string
  children: ReactNode
  onClick?: () => void
  /** Недоступна (первый шаг нельзя поднять выше, идёт запрос). */
  disabled?: boolean
  /** Кнопка раскрывает/сворачивает блок — читалка объявит состояние. */
  ariaExpanded?: boolean
  /** Кнопка-переключатель (закладка, «в избранном»). */
  ariaPressed?: boolean
  /** Подсказка при наведении; по умолчанию — та же, что `ariaLabel`. */
  title?: string
}

/**
 * Square 32×32 icon-only button. Used in topbar (theme toggle,
 * admin link), action bars, and similar places.
 */
export function IconButton({
  ariaLabel,
  children,
  onClick,
  disabled,
  ariaExpanded,
  ariaPressed,
  title,
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={styles.btn}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      aria-pressed={ariaPressed}
      title={title ?? ariaLabel}
      disabled={disabled}
      onClick={onClick}
    >
      <span className={styles.icon} aria-hidden="true">
        {children}
      </span>
    </button>
  )
}
