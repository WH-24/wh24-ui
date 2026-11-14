import type { ReactNode } from 'react'
import {
  Banner as UiBanner,
  EmptyState,
  Skeleton as UiSkeleton,
  type IconName,
} from '@wowhaus-24/ui-react'

import styles from './pages.module.css'

export interface StateBoxProps {
  icon: IconName
  /** Оставлен для совместимости: вид состояния теперь один — общий `EmptyState`. */
  tone?: 'neutral' | 'bad' | 'warn'
  title: string
  text?: ReactNode
  action?: ReactNode
}

/** Пустое состояние / ошибка / нет прав — общий `EmptyState` из ui-react в рамке страницы. */
export function StateBox({ icon, title, text, action }: StateBoxProps) {
  return (
    <div className={styles.state} role="status">
      <EmptyState icon={icon} title={title} description={text} actions={action} />
    </div>
  )
}

/** Скелет строк на время загрузки — полосы общего `Skeleton`. */
export function Skeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className={styles.skeleton} aria-busy="true" aria-label="Загрузка">
      {Array.from({ length: rows }, (_, i) => (
        <UiSkeleton key={i} height={14} width={`${70 + ((i * 13) % 30)}%`} />
      ))}
    </div>
  )
}

export interface BannerProps {
  tone?: 'info' | 'warn' | 'bad'
  children: ReactNode
}

/** Сообщение на странице — общий `Banner` из ui-react. */
export function Banner({ tone = 'info', children }: BannerProps) {
  return <UiBanner tone={tone}>{children}</UiBanner>
}
