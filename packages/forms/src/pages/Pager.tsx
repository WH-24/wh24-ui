import { useEffect, useState } from 'react'
import { Combobox, Icon } from '@wowhaus-24/ui-react'

import { formatNumber } from '../render/format.js'
import styles from './pages.module.css'

export interface PagerProps {
  /** Текущая страница, с 1. */
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
  onPageSize?: (size: number) => void
  pageSizes?: number[]
}

/** Номера страниц с многоточиями: 1 … c-1 c c+1 … N. */
export function pageItems(page: number, pages: number): (number | '…')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const set = new Set<number>([1, pages, page - 1, page, page + 1])
  if (page <= 3) [2, 3, 4].forEach((p) => set.add(p))
  if (page >= pages - 2) [pages - 3, pages - 2, pages - 1].forEach((p) => set.add(p))
  const nums = [...set].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b)
  const out: (number | '…')[] = []
  nums.forEach((p, i) => {
    if (i > 0 && p - nums[i - 1]! > 1) out.push('…')
    out.push(p)
  })
  return out
}

/**
 * Серверный пейджер списка: «51–100 из 1 284», размер страницы, номера,
 * переход к странице. Все три вопроса пользователя за один взгляд — где я,
 * сколько всего, как перейти далеко (в отличие от «Показать ещё», где на
 * страницу нельзя сослаться и экспорт «того, что вижу» неоднозначен).
 */
export function Pager({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
  pageSizes = [25, 50, 100],
}: PagerProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  const [goto, setGoto] = useState(String(page))
  useEffect(() => setGoto(String(page)), [page])

  const go = (p: number) => {
    const clamped = Math.min(pages, Math.max(1, p))
    if (clamped !== page) onPage(clamped)
  }

  return (
    <nav className={styles.pager} aria-label="Страницы">
      <span className={styles.range}>
        {total === 0 ? '0' : `${formatNumber(from)}–${formatNumber(to)}`} из {formatNumber(total)}
      </span>
      <span className={styles.spacer} />
      {onPageSize && (
        <div className={styles.pagerGroup}>
          По
          <Combobox
            className={styles.pageSize}
            ariaLabel="Размер страницы"
            options={pageSizes.map((n) => ({ value: String(n), label: String(n) }))}
            value={String(pageSize)}
            onChange={(v) => v && onPageSize(Number(v))}
            searchable={false}
            clearable={false}
          />
        </div>
      )}
      <div className={styles.pagerGroup} style={{ gap: 2 }}>
        <button
          type="button"
          className={styles.pageBtn}
          aria-label="Предыдущая страница"
          disabled={page <= 1}
          onClick={() => go(page - 1)}
        >
          <Icon name="back" size={13} />
        </button>
        {pageItems(page, pages).map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className={styles.ellipsis}>
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className={styles.pageBtn}
              aria-current={p === page ? 'page' : undefined}
              aria-label={`Страница ${p}`}
              onClick={() => go(p)}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          className={styles.pageBtn}
          aria-label="Следующая страница"
          disabled={page >= pages}
          onClick={() => go(page + 1)}
        >
          <Icon name="chevright" size={13} />
        </button>
      </div>
      <div className={styles.pagerGroup}>
        К странице
        <input
          className={styles.gotoInput}
          aria-label="Перейти к странице"
          inputMode="numeric"
          value={goto}
          onChange={(e) => setGoto(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') go(Number(goto) || 1)
          }}
          onBlur={() => setGoto(String(page))}
        />
      </div>
    </nav>
  )
}
