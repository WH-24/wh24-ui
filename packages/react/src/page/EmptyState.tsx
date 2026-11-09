import type { ReactNode } from 'react'

import { Icon, type IconName } from '../list/Icon.js'

import styles from './page.module.css'

/**
 * Пустое состояние: иконка в плашке, заголовок, пояснение и действие.
 * Пустой экран без действия — тупик: где можно, давайте кнопку
 * («Маршрутов пока нет» → «Создать маршрут»).
 */
export interface EmptyStateProps {
  title: ReactNode
  description?: ReactNode
  icon?: IconName | ReactNode
  /** Кнопки под текстом. */
  actions?: ReactNode
  /** `page` — крупный вариант на весь экран; `section` — внутри блока. */
  size?: 'section' | 'page'
  className?: string
}

export function EmptyState({
  title,
  description,
  icon = 'inbox',
  actions,
  size = 'section',
  className,
}: EmptyStateProps) {
  const big = size === 'page'
  const cls = [styles.empty, big ? styles.emptyPage : '', className ?? ''].filter(Boolean).join(' ')
  return (
    <div className={cls}>
      <div className={big ? `${styles.emptyIcon} ${styles.emptyIconLg}` : styles.emptyIcon} aria-hidden="true">
        {typeof icon === 'string' ? <Icon name={icon as IconName} size={big ? 28 : 20} /> : icon}
      </div>
      <div className={big ? `${styles.emptyTitle} ${styles.emptyTitleLg}` : styles.emptyTitle}>{title}</div>
      {description && (
        <div className={big ? `${styles.emptyDesc} ${styles.emptyDescLg}` : styles.emptyDesc}>{description}</div>
      )}
      {actions && <div className={styles.emptyActions}>{actions}</div>}
    </div>
  )
}
