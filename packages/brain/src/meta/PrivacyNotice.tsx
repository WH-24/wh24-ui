import type { ReactNode } from 'react'

import { BrainIcon } from '../icons.js'
import styles from './meta.module.css'

export interface PrivacyNoticeProps {
  /** Текст даёт хост: что увидит ИИ, с чьими правами, что останется в истории. */
  children: ReactNode
  tone?: 'info' | 'warn'
  className?: string
}

/** Напоминание о приватности: при наборе «@ИИ», перед запуском общего агента. */
export function PrivacyNotice({ children, tone = 'info', className }: PrivacyNoticeProps) {
  return (
    <div className={[styles.notice, className].filter(Boolean).join(' ')} data-tone={tone} role="note">
      <span className={styles.noticeIcon}>
        <BrainIcon name="shield" size={15} />
      </span>
      <div className={styles.noticeText}>{children}</div>
    </div>
  )
}
