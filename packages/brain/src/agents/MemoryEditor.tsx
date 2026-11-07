import { useRef } from 'react'

import { useFocusAfterChange } from './focus.js'
import { MEMORY_KIND_LABEL, formatDateTime } from './labels.js'
import styles from './pickers.module.css'
import type { AgentMemoryItem } from './types.js'

export interface MemoryEditorProps {
  items: AgentMemoryItem[]
  /** «Забыть» запись: удаляет хост (`agents.deleteMemory`). */
  onForget?: (item: AgentMemoryItem) => void
  /** id записи, которая сейчас удаляется. */
  busyId?: string | null
  loading?: boolean
  error?: string | null
  emptyText?: string
  className?: string
}

/**
 * Память агента: что он запомнил о ВАС — предпочтения, факты, недавние итоги.
 * Сервер отдаёт только вашу память: другие сотрудники её не видят.
 */
export function MemoryEditor({
  items,
  onForget,
  busyId,
  loading,
  error,
  emptyText = 'Агент пока ничего не запомнил.',
  className,
}: MemoryEditorProps) {
  const list = useRef<HTMLUListElement>(null)
  const empty = useRef<HTMLParagraphElement>(null)
  const after = useFocusAfterChange(items.length)
  // Запись забыта — фокус на соседнюю «Забыть» (или на подпись, если записей не осталось).
  const forget = (item: AgentMemoryItem, i: number) => {
    after(() => {
      const rows = list.current?.children
      const next = rows?.[Math.min(i, (rows?.length ?? 1) - 1)]
      return next?.querySelector<HTMLElement>('button') ?? empty.current
    })
    onForget?.(item)
  }
  return (
    <div className={[styles.memory, className].filter(Boolean).join(' ')} aria-busy={loading || undefined}>
      <p className={styles.note}>Это ваша память этого агента: другие её не видят.</p>
      {loading && <p className={styles.note}>Загружаю…</p>}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        <p ref={empty} tabIndex={-1} className={styles.note}>
          {emptyText}
        </p>
      )}
      {items.length > 0 && (
        <ul ref={list} className={styles.memoryList}>
          {items.map((m, i) => {
            const date = formatDateTime(m.created_at)
            return (
              <li key={m.id} className={styles.memoryItem}>
                <div className={styles.memoryHead}>
                  <span className={styles.kindTag} data-kind={m.kind}>
                    {MEMORY_KIND_LABEL[m.kind] ?? m.kind}
                  </span>
                  {m.pinned && <span className={styles.kindTag}>Закреплено</span>}
                  {date && (
                    <time className={styles.memoryDate} dateTime={m.created_at}>
                      {date}
                    </time>
                  )}
                </div>
                <p className={styles.memoryText}>{m.text}</p>
                {onForget && (
                  <button
                    type="button"
                    className={styles.textBtn}
                    disabled={busyId === m.id}
                    aria-label={`Забыть: ${m.text.length > 60 ? `${m.text.slice(0, 59)}…` : m.text}`}
                    onClick={() => forget(m, i)}
                  >
                    {busyId === m.id ? 'Забываю…' : 'Забыть'}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
