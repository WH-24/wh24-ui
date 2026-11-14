import type { ReactNode } from 'react'

import { StatusBadge } from '@wowhaus-24/ui-react'

export type StatusTone = 'neutral' | 'good' | 'warn' | 'bad' | 'info'

export interface StatusPillProps {
  children: ReactNode
  tone?: StatusTone
  className?: string
}

/** Статус записи/формы — общий `StatusBadge` из ui-react с точкой. Тон задаёт хост (словарь статусов). */
export function StatusPill({ children, tone = 'neutral', className }: StatusPillProps) {
  return (
    <StatusBadge tone={tone} dot className={className}>
      {children}
    </StatusBadge>
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
