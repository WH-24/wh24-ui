import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from '@wowhaus-24/ui-react'

import type { BrainSource } from '../types.js'
import type { ModuleMetaMap } from './modules.js'
import { SourceCard } from './SourceCard.js'
import styles from './sources.module.css'

export type NumberedSource = BrainSource & { n?: number }

export interface SourceListProps {
  /** Источники ровно в том составе, что прислал сервер: он уже отфильтровал по правам. */
  sources: NumberedSource[]
  title?: string
  /** Сворачиваемый список (открыт по умолчанию). */
  collapsible?: boolean
  defaultOpen?: boolean
  /** Нумеровать карточки (`n` источника или порядковый номер). */
  numbered?: boolean
  /** Выбранный источник — подсветить и прокрутить к нему (клик по чипу `[n]`). */
  activeN?: number
  onOpen?: (url: string, source: BrainSource) => void
  modules?: ModuleMetaMap
  /** Что показать, когда источников нет. */
  emptyText?: string
  className?: string
}

/**
 * Список источников под ответом. Показывается всегда — и когда он пуст:
 * пользователь должен видеть, на что опирался ответ, и видеть, что ни на что.
 */
export function SourceList({
  sources,
  title = 'Источники',
  collapsible = false,
  defaultOpen = true,
  numbered = true,
  activeN,
  onOpen,
  modules,
  emptyText = 'Ответ без ссылок на документы портала.',
  className,
}: SourceListProps) {
  const [open, setOpen] = useState(defaultOpen)
  const refs = useRef(new Map<number, HTMLElement>())

  useEffect(() => {
    if (activeN == null) return
    setOpen(true)
    const el = refs.current.get(activeN)
    if (!el) return
    const reduce =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView?.({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
    el.focus({ preventScroll: true })
  }, [activeN])

  const headingId = useId()
  const heading = (
    <>
      <span className={styles.listTitle}>{title}</span>
      <span className={styles.count}>{sources.length}</span>
    </>
  )

  return (
    <section className={[styles.list, className].filter(Boolean).join(' ')} aria-labelledby={headingId}>
      {collapsible ? (
        <button
          type="button"
          id={headingId}
          className={styles.toggle}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={styles.chev} data-open={open || undefined}>
            <Icon name="chevright_sm" size={12} />
          </span>
          {heading}
        </button>
      ) : (
        <div id={headingId} className={styles.heading}>
          {heading}
        </div>
      )}
      {open &&
        (sources.length === 0 ? (
          <p className={styles.empty}>{emptyText}</p>
        ) : (
          <ol className={styles.cards}>
            {sources.map((s, i) => {
              const n = numbered ? (s.n ?? i + 1) : undefined
              return (
                <li key={s.document_id || i}>
                  <SourceCard
                    ref={(el) => {
                      if (n == null) return
                      if (el) refs.current.set(n, el)
                      else refs.current.delete(n)
                    }}
                    source={s}
                    n={n}
                    active={n != null && n === activeN}
                    onOpen={onOpen}
                    modules={modules}
                  />
                </li>
              )
            })}
          </ol>
        ))}
    </section>
  )
}
