import type { ReactNode } from 'react'

import { EmptyState } from './EmptyState.js'

/**
 * Не удалось загрузить: что случилось и «Повторить». Сырой текст ошибки
 * сервера людям не показываем — он в `detail` мелко, по желанию экрана.
 */
export interface ErrorStateProps {
  title?: ReactNode
  detail?: ReactNode
  onRetry?: () => void
  retryLabel?: string
  size?: 'section' | 'page'
}

export function ErrorState({
  title = 'Не удалось загрузить',
  detail,
  onRetry,
  retryLabel = 'Повторить',
  size = 'section',
}: ErrorStateProps) {
  return (
    <div role="alert">
      <EmptyState
        icon="alert"
        title={title}
        description={detail}
        size={size}
        actions={
          onRetry && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
              {retryLabel}
            </button>
          )
        }
      />
    </div>
  )
}
