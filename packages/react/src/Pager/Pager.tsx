import { forwardRef, useEffect, useRef, type HTMLAttributes } from 'react'

import { Icon } from '../list/Icon.js'
import { cx } from '../popup/popup.js'

import styles from './Pager.module.css'

export interface PagerProps extends Omit<HTMLAttributes<HTMLElement>, 'onChange'> {
  /** Текущая страница, с единицы. */
  page: number
  /** Всего страниц. Одна или меньше — пейджер не рисуется. */
  pageCount: number
  onChange: (page: number) => void
  /** Сколько страниц показывать по сторонам от текущей. */
  siblings?: number
  ariaLabel?: string
  prevLabel?: string
  nextLabel?: string
  /** Подпись кнопки страницы для читалки. */
  pageLabel?: (page: number) => string
}

/**
 * Какие номера показать: первая, последняя, текущая и соседи; разрыв в
 * нумерации — многоточие (`null`). Разрыв в одну страницу показываем самой
 * страницей: «1 … 3» длиннее и хуже, чем «1 2 3».
 */
export function pagerRange(page: number, pageCount: number, siblings = 1): Array<number | null> {
  const set = new Set<number>([1, pageCount])
  for (let p = page - siblings; p <= page + siblings; p++) if (p >= 1 && p <= pageCount) set.add(p)
  const pages = Array.from(set).sort((a, b) => a - b)
  const out: Array<number | null> = []
  let prev = 0
  for (const p of pages) {
    if (p - prev === 2) out.push(p - 1)
    else if (p - prev > 2) out.push(null)
    out.push(p)
    prev = p
  }
  return out
}

/** Постраничный переход: номера с многоточием, «назад» и «вперёд». */
export const Pager = forwardRef<HTMLElement, PagerProps>(function Pager(
  {
    page,
    pageCount,
    onChange,
    siblings = 1,
    ariaLabel = 'Страницы',
    prevLabel = 'Предыдущая страница',
    nextLabel = 'Следующая страница',
    pageLabel = (p) => `Страница ${p}`,
    className,
    ...rest
  },
  ref,
) {
  const navRef = useRef<HTMLElement | null>(null)
  // Стрелка, с которой ушли на край, выключается и теряет фокус — он падал
  // бы в начало страницы. Запоминаем, что фокус был на стрелке, и после
  // перехода ставим его на текущую страницу.
  const arrowFocus = useRef(false)
  const count = Math.max(0, Math.floor(pageCount))
  const cur = Math.min(Math.max(count, 1), Math.max(1, Math.floor(page)))
  useEffect(() => {
    if (!arrowFocus.current) return
    arrowFocus.current = false
    const nav = navRef.current
    if (!nav) return
    const active = document.activeElement
    const lost = !active || active === document.body || (nav.contains(active) && (active as HTMLButtonElement).disabled)
    if (lost) nav.querySelector<HTMLElement>('[aria-current="page"]')?.focus()
  }, [cur, count])
  if (count <= 1) return null
  const go = (p: number) => {
    if (p >= 1 && p <= count && p !== cur) onChange(p)
  }
  const step = (p: number) => {
    arrowFocus.current = (p === 1 || p === count) && navRef.current?.contains(document.activeElement) === true
    go(p)
  }
  return (
    <nav
      {...rest}
      ref={(el) => {
        navRef.current = el
        if (typeof ref === 'function') ref(el)
        else if (ref) ref.current = el
      }}
      aria-label={ariaLabel}
      className={cx(styles.pg, className)}
    >
      <button
        type="button"
        className={styles.arrow}
        aria-label={prevLabel}
        disabled={cur === 1}
        onClick={() => step(cur - 1)}
      >
        <span className={styles.flip}>
          <Icon name="chevright" size={16} />
        </span>
      </button>
      {pagerRange(cur, count, siblings).map((p, i) =>
        p === null ? (
          <span key={`gap-${i}`} className={styles.gap} aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            className={styles.pgb}
            aria-label={pageLabel(p)}
            aria-current={p === cur ? 'page' : undefined}
            onClick={() => go(p)}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        className={styles.arrow}
        aria-label={nextLabel}
        disabled={cur === count}
        onClick={() => step(cur + 1)}
      >
        <Icon name="chevright" size={16} />
      </button>
    </nav>
  )
})
