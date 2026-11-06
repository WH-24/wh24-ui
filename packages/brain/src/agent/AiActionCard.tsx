import { useEffect, useRef } from 'react'

import type { ActionStatus, PendingAction } from '../types.js'
import styles from './agent.module.css'

function show(v: unknown): string {
  if (Array.isArray(v)) return v.map(show).join(', ')
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
  pending: 'Ждёт подтверждения',
  running: 'Выполняется…',
  done: 'Выполнено',
  failed: 'Не выполнено',
  cancelled: 'Отменено',
}

export interface AiActionCardProps {
  action: PendingAction
  /** Идёт запрос по этому действию (подтверждение или отмена). */
  busy?: boolean
  error?: string | null
  onConfirm?: () => void
  onCancel?: () => void
  className?: string
}

/**
 * Карточка записи, которую подготовил агент («Создать лид»): что будет
 * записано и кнопки. Записать может только человек — кнопкой «Подтвердить»;
 * модель этого сделать не может, сервер не отдаёт ей токен подтверждения.
 */
export function AiActionCard({
  action,
  busy = false,
  error,
  onConfirm,
  onCancel,
  className,
}: AiActionCardProps) {
  const rows = action.preview.will_set ?? []
  const dups = action.preview.possible_duplicates ?? []
  const pending = action.status === 'pending'
  // После решения кнопки исчезают — фокус переводим на карточку с итогом,
  // иначе он улетает в начало страницы (клавиатура и скринридер теряют место).
  const ref = useRef<HTMLElement>(null)
  const wasPending = useRef(pending)
  useEffect(() => {
    if (wasPending.current && !pending) ref.current?.focus()
    wasPending.current = pending
  }, [pending])
  return (
    <section
      ref={ref}
      tabIndex={-1}
      className={[styles.action, className].filter(Boolean).join(' ')}
      data-status={action.status}
      aria-label={action.title || 'Действие ассистента'}
      aria-busy={busy}
    >
      <header className={styles.head}>
        <span className={styles.title}>{action.title || 'Действие'}</span>
        <span className={styles.status}>{ACTION_STATUS_LABEL[action.status]}</span>
      </header>

      {(rows.length > 0 || action.preview.stage) && (
        <dl className={styles.rows}>
          {rows.map((r, i) => (
            <div key={i} className={styles.row}>
              <dt>{r.field}</dt>
              <dd>{show(r.value)}</dd>
            </div>
          ))}
          {action.preview.stage && (
            <div className={styles.row}>
              <dt>Стадия</dt>
              <dd>{action.preview.stage}</dd>
            </div>
          )}
        </dl>
      )}

      {pending && (action.preview.warning || dups.length > 0) && (
        <div className={styles.warn} role="note">
          {action.preview.warning}
          {dups.length > 0 && (
            <ul>
              {dups.map((d, i) => (
                <li key={i}>
                  {d.full_name}
                  {d.position ? `, ${d.position}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {action.result && !pending && <p className={styles.result}>{action.result}</p>}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {pending && (onConfirm || onCancel) && (
        <div className={styles.buttons}>
          {onConfirm && (
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={onConfirm}>
              {busy ? 'Выполняю…' : 'Подтвердить'}
            </button>
          )}
          {onCancel && (
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={onCancel}>
              Отмена
            </button>
          )}
        </div>
      )}
    </section>
  )
}
