import type { ReactNode } from 'react'

import styles from './pages.module.css'

export type StatusTone = 'neutral' | 'good' | 'warn' | 'bad' | 'info'

export interface StatusPillProps {
  children: ReactNode
  tone?: StatusTone
  className?: string
}

/** Статус записи/формы — пилл с точкой. Тон задаёт хост (словарь статусов). */
export function StatusPill({ children, tone = 'neutral', className }: StatusPillProps) {
  return (
    <span className={[styles.pill, className].filter(Boolean).join(' ')} data-tone={tone}>
      {children}
    </span>
  )
}

export interface StatusLabel {
  label: string
  tone: StatusTone
}

/** Словарь статусов записи: значение из БД → подпись и тон. Статусы Этапа 1
 *  задаёт бэкенд (по умолчанию `open`); свои — из настроек формы (Этап 3). */
export const DEFAULT_RECORD_STATUSES: Record<string, StatusLabel> = {
  open: { label: 'Открыта', tone: 'info' },
  draft: { label: 'Черновик', tone: 'neutral' },
  review: { label: 'На согласовании', tone: 'warn' },
  approved: { label: 'Утверждена', tone: 'good' },
  rejected: { label: 'Отклонена', tone: 'bad' },
  closed: { label: 'Закрыта', tone: 'neutral' },
}

export function statusLabel(
  status: string,
  dict: Record<string, StatusLabel> = DEFAULT_RECORD_STATUSES,
): StatusLabel {
  return dict[status] ?? { label: status || '—', tone: 'neutral' }
}
