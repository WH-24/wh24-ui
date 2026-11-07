import type { ReactNode } from 'react'
import { Icon } from '@wowhaus-24/ui-react'

import { BrainIcon } from '../icons.js'
import {
  RUN_STATUS_LABEL,
  TRIGGER_KIND_LABEL,
  formatCost,
  formatDateTime,
  formatDuration,
  skipReasonText,
} from './labels.js'
import styles from './runs.module.css'
import type { AgentRun, TriggerKind } from './types.js'

export const RESTRICTED_NOTE = 'Содержимое видно только участнику'

type Tone = 'ok' | 'warn' | 'bad' | 'busy' | 'dim'

export interface RunStatusView {
  label: string
  tone: Tone
  /** Пояснение под статусом: причина пропуска или текст ошибки. */
  note?: string
}

/** Как показать запуск в статусе: подпись, тон и пояснение. Содержимое чужих запусков не раскрывается. */
export function runStatusView(run: AgentRun): RunStatusView {
  const label = RUN_STATUS_LABEL[run.status] ?? run.status
  switch (run.status) {
    case 'completed':
      return { label, tone: 'ok' }
    case 'skipped':
      return { label, tone: 'warn', note: skipReasonText(run.skip_reason) }
    case 'failed':
      return { label, tone: 'bad', note: run.restricted ? undefined : run.error || undefined }
    case 'queued':
    case 'running':
      return { label, tone: 'busy' }
    default:
      return { label, tone: 'dim' }
  }
}

/** Статус запуска: значок формой + подпись (цвет — только дополнение). */
export function RunStatusBadge({ run }: { run: AgentRun }) {
  const v = runStatusView(run)
  return (
    <span className={styles.status} data-tone={v.tone}>
      <StatusGlyph tone={v.tone} />
      {v.label}
    </span>
  )
}

/** Значок статуса: форма, а не только цвет (галочка, пауза, предупреждение, часы, прочерк). */
function StatusGlyph({ tone }: { tone: Tone }) {
  if (tone === 'ok') return <Icon name="check" size={13} />
  if (tone === 'warn') return <BrainIcon name="pause" size={13} />
  if (tone === 'bad') return <BrainIcon name="alert" size={13} />
  if (tone === 'busy') return <Icon name="timer" size={13} />
  return <Icon name="close" size={13} />
}

const TRIGGER_ICON = { manual: 'bolt', schedule: 'timer', event: 'bell' } as const

export function triggerLabel(kind: TriggerKind | string | undefined): string {
  return kind ? (TRIGGER_KIND_LABEL[kind as TriggerKind] ?? '—') : '—'
}

/** Время запуска: когда встал в очередь (у старых — `created_at`). */
export function runTime(run: AgentRun): string | undefined {
  return run.queued_at ?? run.created_at
}

/** Стоимость: `usage.cost`, иначе `cost_usd`. */
export function runCost(run: AgentRun): number | undefined {
  return run.usage?.cost ?? run.cost_usd
}

/** Длительность от начала (или постановки в очередь) до конца. */
export function runDuration(run: AgentRun): string {
  return formatDuration(run.started_at ?? runTime(run), run.finished_at)
}

export interface RunLogTableProps {
  runs: AgentRun[]
  /** Открыть запуск (`RunDetail`). Строка кликабельна, а у первой ячейки — кнопка для клавиатуры. */
  onOpen?: (run: AgentRun) => void
  selectedId?: string | null
  /** Есть ещё старые запуски: внизу «Показать ещё». */
  hasMore?: boolean
  onLoadMore?: () => void
  loadingMore?: boolean
  loading?: boolean
  error?: string | null
  /** Колонка «Агент» (в журнале одного агента не нужна). */
  showAgent?: boolean
  emptyTitle?: string
  emptyText?: ReactNode
  /** Что можно сделать из пустого журнала: кнопка «Запустить агента» и т. п. (слот хоста). */
  emptyAction?: ReactNode
  caption?: string
  className?: string
}

/**
 * Журнал запусков агентов: Время · Агент · Триггер · Статус · Стоимость ·
 * Длительность. Пропуски объясняются причиной («Исчерпан дневной бюджет…»), а не
 * молчат. Запуски без содержимого (`restricted`) показаны с пометкой, текста
 * ответа и ошибки в них нет. Без страниц: старые догружаются кнопкой.
 */
export function RunLogTable({
  runs,
  onOpen,
  selectedId,
  hasMore,
  onLoadMore,
  loadingMore,
  loading,
  error,
  showAgent = true,
  emptyTitle = 'Запусков пока нет',
  emptyText = 'Они появятся здесь после первого запуска агента — вручную, по расписанию или по событию.',
  emptyAction,
  caption = 'Журнал запусков агентов',
  className,
}: RunLogTableProps) {
  return (
    <div className={[styles.log, className].filter(Boolean).join(' ')} aria-busy={loading || undefined}>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {loading && runs.length === 0 && (
        <p className={styles.muted} role="status">
          Загружаю журнал…
        </p>
      )}
      {!loading && !error && runs.length === 0 && (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>
            <Icon name="list" size={20} />
          </span>
          <div className={styles.emptyTitle}>{emptyTitle}</div>
          <div className={styles.emptyText}>{emptyText}</div>
          {emptyAction && <div className={styles.emptyAction}>{emptyAction}</div>}
        </div>
      )}
      {runs.length > 0 && (
        <div className={styles.scroll} role="region" aria-label={caption} tabIndex={0}>
          <table className={styles.table}>
            <caption className={styles.srOnly}>{caption}</caption>
            <thead>
              <tr>
                <th scope="col">Время</th>
                {showAgent && <th scope="col">Агент</th>}
                <th scope="col">Триггер</th>
                <th scope="col">Статус</th>
                <th scope="col" className={styles.num}>
                  Стоимость
                </th>
                <th scope="col" className={styles.num}>
                  Длительность
                </th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const status = runStatusView(run)
                const time = runTime(run)
                const when = formatDateTime(time)
                const kind = run.trigger_kind
                const deleted = !run.agent_id && !run.agent_name
                return (
                  <tr
                    key={run.id}
                    className={styles.row}
                    data-clickable={onOpen ? '' : undefined}
                    data-selected={run.id === selectedId || undefined}
                    onClick={onOpen ? () => onOpen(run) : undefined}
                  >
                    <td className={styles.time}>
                      {onOpen ? (
                        <button
                          type="button"
                          className={styles.rowBtn}
                          aria-current={run.id === selectedId || undefined}
                          title={time ? new Date(time).toLocaleString('ru-RU') : undefined}
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpen(run)
                          }}
                        >
                          {when || 'Открыть'}
                        </button>
                      ) : (
                        <span>{when || '—'}</span>
                      )}
                    </td>
                    {showAgent && (
                      <td>
                        <div className={deleted ? styles.deleted : styles.agent}>
                          {run.agent_name || (deleted ? 'Агент удалён' : '—')}
                        </div>
                        {run.restricted && (
                          <div className={styles.restricted}>
                            <BrainIcon name="lock" size={12} />
                            {RESTRICTED_NOTE}
                          </div>
                        )}
                      </td>
                    )}
                    <td>
                      <span className={styles.kind}>
                        {kind && <Icon name={TRIGGER_ICON[kind] ?? 'bolt'} size={13} />}
                        {triggerLabel(kind)}
                      </span>
                      {!showAgent && run.restricted && (
                        <div className={styles.restricted}>
                          <BrainIcon name="lock" size={12} />
                          {RESTRICTED_NOTE}
                        </div>
                      )}
                    </td>
                    <td>
                      <RunStatusBadge run={run} />
                      {status.note && <div className={styles.note}>{status.note}</div>}
                    </td>
                    <td className={styles.num}>{formatCost(runCost(run))}</td>
                    <td className={styles.num}>{runDuration(run)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {hasMore && onLoadMore && (
        <div className={styles.more}>
          <button type="button" className="btn btn-secondary btn-sm" disabled={loadingMore} onClick={onLoadMore}>
            {loadingMore ? 'Загружаю…' : 'Показать ещё'}
          </button>
        </div>
      )}
    </div>
  )
}
