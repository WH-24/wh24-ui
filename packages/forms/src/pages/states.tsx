import type { ReactNode } from 'react'
import { Icon, type IconName } from '@wowhaus-24/ui-react'

import styles from './pages.module.css'

export interface StateBoxProps {
  icon: IconName
  tone?: 'neutral' | 'bad' | 'warn'
  title: string
  text?: ReactNode
  action?: ReactNode
}

/** Пустое состояние / ошибка / нет прав — один вид, разные тексты. */
export function StateBox({ icon, tone = 'neutral', title, text, action }: StateBoxProps) {
  return (
    <div className={styles.state} role="status">
      <div className={styles.stateIcon} data-tone={tone}>
        <Icon name={icon} size={20} />
      </div>
      <div className={styles.stateTitle}>{title}</div>
      {text && <div className={styles.stateText}>{text}</div>}
      {action && <div className={styles.stateAction}>{action}</div>}
    </div>
  )
}

/** Скелет строк на время загрузки. */
export function Skeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className={styles.skeleton} aria-busy="true" aria-label="Загрузка">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={styles.bone} style={{ width: `${70 + ((i * 13) % 30)}%` }} />
      ))}
    </div>
  )
}

export interface BannerProps {
  tone?: 'info' | 'warn' | 'bad'
  children: ReactNode
}

export function Banner({ tone = 'info', children }: BannerProps) {
  return (
    <div className={styles.banner} data-tone={tone} role={tone === 'bad' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}
