/**
 * FormRecordView — экран C в режиме просмотра: шапка (№ · название · статус ·
 * автор и даты · действия), тело через FormRenderer(view), «История» —
 * раскрывающаяся панель с диффом.
 *
 * Один и тот же компонент для полной страницы и для drawer быстрого
 * просмотра из списка: контейнер решает хост.
 */
import { useState, type ReactNode } from 'react'
import { Icon } from '@wowhaus-24/ui-react'

import type { Form, FormRecord, RecordHistoryEntry, SchemaDocument } from '../types.js'
import { FormRenderer } from '../render/FormRenderer.js'
import { formatDateTime, type FormatContext } from '../render/format.js'
import type { RenderContext } from '../render/registry.js'
import { RecordHistory } from './RecordHistory.js'
import { DEFAULT_RECORD_STATUSES, StatusPill, statusLabel, type StatusLabel } from './StatusPill.js'
import { Banner } from './states.js'
import styles from './pages.module.css'

export interface FormRecordViewProps {
  form: Form
  /** Схема ВЕРСИИ записи (record.form_version), не черновик формы. */
  schema: SchemaDocument
  record: FormRecord
  ctx?: RenderContext
  statusLabels?: Record<string, StatusLabel>
  actorName?: (id: string) => string
  onBack?: () => void
  backLabel?: string
  onEdit?: () => void
  onDelete?: () => void
  /** Дополнительные действия справа в шапке. */
  actions?: ReactNode
  /** Загрузка истории по требованию (кнопка «История»). */
  loadHistory?: () => Promise<RecordHistoryEntry[]>
  /** Запись старше текущей версии формы — подсказать, что при правке попросят новые поля. */
  currentVersion?: number
}

export function FormRecordView({
  form,
  schema,
  record,
  ctx = {},
  statusLabels = DEFAULT_RECORD_STATUSES,
  actorName,
  onBack,
  backLabel,
  onEdit,
  onDelete,
  actions,
  loadHistory,
  currentVersion,
}: FormRecordViewProps) {
  const [history, setHistory] = useState<
    { kind: 'closed' } | { kind: 'loading' } | { kind: 'open'; entries: RecordHistoryEntry[] } | { kind: 'error' }
  >({ kind: 'closed' })
  const s = statusLabel(record.status, statusLabels)
  const who = (id: string | null) => (id ? (actorName ? actorName(id) : id) : '—')

  const toggleHistory = async () => {
    if (history.kind === 'open' || history.kind === 'loading') {
      setHistory({ kind: 'closed' })
      return
    }
    if (!loadHistory) return
    setHistory({ kind: 'loading' })
    try {
      setHistory({ kind: 'open', entries: await loadHistory() })
    } catch {
      setHistory({ kind: 'error' })
    }
  }

  const outdated = currentVersion != null && record.form_version < currentVersion

  return (
    <div className={styles.page}>
      {onBack && (
        <div>
          <button type="button" className={['btn', 'btn-ghost', 'btn-sm', styles.back].join(' ')} onClick={onBack}>
            <Icon name="back" size={14} />
            {backLabel ?? form.nav_label ?? form.name}
          </button>
        </div>
      )}
      <div className={styles.recHead}>
        <div className={styles.recNum} aria-label={`Запись № ${record.number}`}>
          №{record.number}
        </div>
        <div className={styles.recTitleWrap}>
          <div className={styles.recTitleRow}>
            <h1 className={styles.recTitle} title={record.title}>
              {record.title || <span className={styles.muted}>Без названия</span>}
            </h1>
            <StatusPill tone={s.tone}>{s.label}</StatusPill>
          </div>
          <div className={styles.recMeta}>
            <span>Создал {who(record.created_by)}</span>
            <span>·</span>
            <span>{formatDateTime(record.created_at)}</span>
            {record.updated_at !== record.created_at && (
              <>
                <span>·</span>
                <span>
                  изменено {formatDateTime(record.updated_at)}
                  {record.updated_by ? `, ${who(record.updated_by)}` : ''}
                </span>
              </>
            )}
            <span>·</span>
            <span>v{record.form_version}</span>
          </div>
        </div>
        <div className={styles.actions}>
          {actions}
          {loadHistory && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-expanded={history.kind === 'open'}
              onClick={toggleHistory}
            >
              <Icon name="list" size={14} /> История
            </button>
          )}
          {onDelete && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onDelete}>
              <Icon name="trash" size={14} /> Удалить
            </button>
          )}
          {onEdit && form.status === 'published' && (
            <button type="button" className="btn btn-primary btn-sm" onClick={onEdit}>
              <Icon name="edit" size={14} /> Редактировать
            </button>
          )}
        </div>
      </div>

      {outdated && (
        <Banner>
          Запись сохранена под версией формы v{record.form_version}, текущая — v{currentVersion}. При
          редактировании попросят заполнить новые обязательные поля.
        </Banner>
      )}

      {history.kind === 'loading' && <div className={styles.muted}>Загружаем историю…</div>}
      {history.kind === 'error' && <Banner tone="bad">Не удалось загрузить историю.</Banner>}
      {history.kind === 'open' && (
        <RecordHistory entries={history.entries} schema={schema} ctx={ctx} actorName={actorName} />
      )}

      <FormRenderer doc={schema} values={record.data ?? {}} mode="view" ctx={ctx} />
    </div>
  )
}
