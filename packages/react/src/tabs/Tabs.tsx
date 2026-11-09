import { useRef, type KeyboardEvent, type ReactNode } from 'react'

import styles from './tabs.module.css'

export interface TabSpec<K extends string = string> {
  id: K
  label: ReactNode
  /** Число справа от подписи; пусто — не показывается (0 показывается). */
  count?: number | string
}

/**
 * Вкладки страницы по образцу WAI-ARIA: role=tablist/tab, стрелки и
 * Home/End переключают, в порядке Tab стоит только активная вкладка.
 * Вид — как `.tabs/.tab` портала: подчёркивание терракотой у активной.
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
  className?: string
}

export function Tabs<K extends string>({ tabs, value, onChange, ariaLabel, idPrefix, className }: TabsProps<K>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const move = (i: number) => {
    const n = (i + tabs.length) % tabs.length
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
    <div role="tablist" aria-label={ariaLabel} className={className ? `${styles.tabs} ${className}` : styles.tabs}>
      {tabs.map((t, i) => {
        const on = t.id === value
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
            tabIndex={on ? 0 : -1}
            className={styles.tab}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {t.label}
            {t.count !== undefined && t.count !== '' && <span className={styles.count}>{t.count}</span>}
          </button>
        )
      })}
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
