import type { ReactNode } from 'react'

import styles from './page.module.css'

/**
 * Заголовок страницы по стандарту портала: название 22/600, подпись 13px,
 * счётчик-пилюля, действия справа (на узком экране уходят под заголовок).
 * Портал рисует то же глобальными классами `.page-header/.page-title/
 * .page-subtitle/.page-actions` — метрики совпадают.
 */
export interface PageHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  /** Число рядом с названием («Теги 20»). */
  count?: number | string
  /** Кнопки справа: одна `btn btn-primary`, остальные — secondary/ghost. */
  actions?: ReactNode
  /** Уровень заголовка; на странице модуля — h1. */
  as?: 'h1' | 'h2'
  className?: string
}

export function PageHeader({ title, subtitle, count, actions, as: Tag = 'h1', className }: PageHeaderProps) {
  return (
    <header className={className ? `${styles.header} ${className}` : styles.header}>
      <div className={styles.headText}>
        <Tag className={styles.title}>
          {title}
          {count !== undefined && count !== '' && <span className={styles.titleCount}>{count}</span>}
        </Tag>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  )
}
