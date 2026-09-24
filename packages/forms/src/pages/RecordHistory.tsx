import type { RecordHistoryEntry, SchemaDocument } from '../types.js'
import { formatDateTime, formatValue, type FormatContext } from '../render/format.js'
import styles from './pages.module.css'

export interface RecordHistoryProps {
  entries: RecordHistoryEntry[]
  /** Схема (любая версия) — чтобы показать подписи полей и отформатировать значения. */
  schema: SchemaDocument
  ctx?: FormatContext
  /** id пользователя → имя. Без него — id. */
  actorName?: (id: string) => string
}

const ACTION: Record<RecordHistoryEntry['action'], string> = {
  created: 'Создана',
  updated: 'Изменена',
  deleted: 'Удалена',
  restored: 'Восстановлена',
}

/** История записи — «поле: было → стало» по каждой правке. */
export function RecordHistory({ entries, schema, ctx = {}, actorName }: RecordHistoryProps) {
  const byId = new Map(schema.fields.map((f) => [f.id, f]))
  if (entries.length === 0) {
    return <div className={styles.muted}>История пуста</div>
  }
  return (
    <div className={styles.history}>
      {entries.map((e) => {
        const changes = Object.entries(e.changes ?? {})
        return (
          <div key={e.id} className={styles.histEntry}>
            <div className={styles.histHead}>
              <span className={styles.histAction}>{ACTION[e.action] ?? e.action}</span>
              <span>{actorName ? actorName(e.actor) : e.actor}</span>
              <span className={styles.histAt}>{formatDateTime(e.at)}</span>
            </div>
            {changes.length > 0 && (
              <div className={styles.diff}>
                {changes.map(([fieldId, ch]) => {
                  const f = byId.get(fieldId)
                  const label = f ? f.label || f.key : fieldId
                  const was = f ? formatValue(f, ch.from, ctx) : String(ch.from ?? '—')
                  const now = f ? formatValue(f, ch.to, ctx) : String(ch.to ?? '—')
                  return (
                    <div key={fieldId} style={{ display: 'contents' }}>
                      <span className={styles.diffLabel}>{label}</span>
                      <span className={styles.diffVal}>
                        {e.action === 'updated' && was !== '—' && <span className={styles.was}>{was}</span>}
                        {now}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
