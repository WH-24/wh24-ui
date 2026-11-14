import { useRef, type KeyboardEvent, type ReactNode } from 'react'

import { keyboardInitiated } from '../overlay/motion.js'

import styles from './tabs.module.css'
import { useSlideIndicator } from './useSlideIndicator.js'

export interface TabSpec<K extends string = string> {
  id: K
  label: ReactNode
  /** Число справа от подписи; пусто — не показывается (0 показывается). */
  count?: number | string
}

/**
 * Вкладки страницы по образцу WAI-ARIA: role=tablist/tab, стрелки и
 * Home/End переключают, в порядке Tab стоит только активная вкладка.
 * Вид — как `.tabs/.tab` портала: подчёркивание терракотой у активной —
 * одна полоса на все вкладки, по клику она переезжает к выбранной; при
 * переключении стрелками встаёт на место сразу.
 *
 * Содержимое оборачивайте в `TabPanel` с тем же `idPrefix` — тогда
 * вкладка и панель связаны для читалки (aria-controls/labelledby).
 */
export interface TabsProps<K extends string> {
  tabs: ReadonlyArray<TabSpec<K>>
  value: K
  onChange: (id: K) => void
  /** Имя группы вкладок для читалки. */
  ariaLabel: string
  idPrefix: string
  /** Свой класс списка вкладок (отступы, рамка, липкая шапка). */
  className?: string
  /**
   * Вкладки не помещаются — переносятся на новую строку, а не прокручиваются
   * вбок (вкладки колонки карточки записи).
   */
  wrap?: boolean
}

export function Tabs<K extends string>({ tabs, value, onChange, ariaLabel, idPrefix, className, wrap }: TabsProps<K>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const listRef = useRef<HTMLDivElement>(null)
  const indRef = useRef<HTMLSpanElement>(null)
  // Действие с клавиатуры не анимируется: полоса встаёт сразу.
  const instant = useRef(false)
  useSlideIndicator(listRef, indRef, '[role="tab"][aria-selected="true"]', 'scale', instant, tabs.length, wrap)
  const hasValue = tabs.some((t) => t.id === value)
  const move = (i: number) => {
    const n = (i + tabs.length) % tabs.length
    instant.current = true
    onChange(tabs[n]!.id)
    refs.current[n]?.focus()
  }
  const onKey = (e: KeyboardEvent, i: number) => {
    if (e.key === 'ArrowRight') move(i + 1)
    else if (e.key === 'ArrowLeft') move(i - 1)
    else if (e.key === 'Home') move(0)
    else if (e.key === 'End') move(tabs.length - 1)
    else return
    e.preventDefault()
  }
  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      className={className ? `${styles.tabs} ${className}` : styles.tabs}
      data-wrap={wrap || undefined}
    >
      {tabs.map((t, i) => {
        const on = t.id === value
        // value не совпал ни с одной вкладкой — в список всё равно можно
        // попасть с клавиатуры: Tab встаёт на первую.
        const reachable = on || (!hasValue && i === 0)
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${t.id}`}
            aria-selected={on}
            aria-controls={`${idPrefix}-panel-${t.id}`}
            tabIndex={reachable ? 0 : -1}
            className={styles.tab}
            onClick={() => {
              instant.current = keyboardInitiated()
              onChange(t.id)
            }}
            onKeyDown={(e) => onKey(e, i)}
          >
            {t.label}
            {t.count !== undefined && t.count !== '' && <span className={styles.count}>{t.count}</span>}
          </button>
        )
      })}
      <span ref={indRef} className={styles.ind} role="presentation" aria-hidden="true" />
    </div>
  )
}

export interface TabPanelProps {
  idPrefix: string
  id: string
  children: ReactNode
  className?: string
  hidden?: boolean
}

export function TabPanel({ idPrefix, id, children, className, hidden }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${id}`}
      aria-labelledby={`${idPrefix}-tab-${id}`}
      className={className}
      hidden={hidden}
    >
      {children}
    </div>
  )
}
