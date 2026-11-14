import { useRef, type KeyboardEvent, type ReactNode } from 'react'

import type { TabSpec } from '../tabs/Tabs.js'
import s from './record.module.css'

/**
 * Вкладки колонки карточки записи (вид — как в карточке лида) по образцу
 * WAI-ARIA: role=tablist/tab, стрелки и Home/End переключают, в порядке Tab
 * стоит только активная вкладка. Вкладки страницы — `Tabs` из `tabs/`.
 */
export function RecordTabs({
  tabs,
  value,
  onChange,
  ariaLabel,
  idPrefix,
  className,
}: {
  tabs: ReadonlyArray<TabSpec>
  value: string
  onChange: (id: string) => void
  ariaLabel: string
  idPrefix: string
  className?: string
}) {
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
    <div role="tablist" aria-label={ariaLabel} className={className ?? s.tablist}>
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
            className={s.tab}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {t.label}
            {t.count !== undefined && t.count !== '' && <span className={s.tabCount}>{t.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

export function RecordTabPanel({
  idPrefix,
  id,
  children,
  className,
  hidden,
}: {
  idPrefix: string
  id: string
  children: ReactNode
  className?: string
  hidden?: boolean
}) {
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
