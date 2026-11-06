import { forwardRef, type MouseEvent } from 'react'
import { Icon } from '@wowhaus-24/ui-react'

import { BrainIcon } from '../icons.js'
import type { BrainSource } from '../types.js'
import { moduleMeta, shortDate, type ModuleMetaMap } from './modules.js'
import styles from './sources.module.css'

export interface SourceCardProps {
  source: BrainSource
  /** Номер цитаты `[n]`, которой соответствует источник. */
  n?: number
  active?: boolean
  /**
   * Открыть источник в портале. Без обработчика ссылка работает как обычная
   * (в той же вкладке). С ним — переход отдаётся хосту, страница не
   * перезагружается; клик с Ctrl/⌘ открывает новую вкладку как обычно.
   */
  onOpen?: (url: string, source: BrainSource) => void
  modules?: ModuleMetaMap
}

/**
 * Карточка источника: модуль, заголовок, сниппет как прислал сервер, «Открыть».
 * Подсветку совпадений на клиенте не делаем — что выделять, решает поиск.
 */
export const SourceCard = forwardRef<HTMLElement, SourceCardProps>(function SourceCard(
  { source, n, active, onOpen, modules },
  ref,
) {
  const meta = moduleMeta(source.module, modules)
  const date = shortDate(source.updated_at)
  const open = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!onOpen) return
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    onOpen(source.url, source)
  }
  return (
    <article
      ref={ref}
      className={styles.card}
      data-active={active || undefined}
      tabIndex={-1}
      aria-label={n != null ? `Источник ${n}: ${source.title}` : source.title}
    >
      <header className={styles.head}>
        {n != null && <span className={styles.n}>{n}</span>}
        <span className={styles.mod}>
          <Icon name={meta.icon} size={13} />
          {meta.label && <span>{meta.label}</span>}
          {source.entity_type && <span className={styles.dim}>· {source.entity_type}</span>}
        </span>
        {date && (
          <time className={styles.date} dateTime={source.updated_at}>
            {date}
          </time>
        )}
      </header>
      <a className={styles.title} href={source.url} onClick={open}>
        {source.title}
      </a>
      {source.snippet && <p className={styles.snippet}>{source.snippet}</p>}
      <a className={styles.open} href={source.url} onClick={open}>
        Открыть
        <BrainIcon name="external" size={12} />
      </a>
    </article>
  )
})
