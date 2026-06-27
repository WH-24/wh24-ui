import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Combobox, type ComboboxOption } from '../Combobox.js'
import { Icon } from '../Icon.js'
import type { DateRange, FieldType, FilterValue } from './types.js'
import styles from './filter.module.css'

interface FieldEditorProps {
  type: FieldType
  value: FilterValue
  onChange: (v: FilterValue) => void
  options?: ComboboxOption[]
  placeholder?: string
}

/** Рендерит редактор по типу поля. */
export function FieldEditor({
  type,
  value,
  onChange,
  options = [],
  placeholder,
}: FieldEditorProps) {
  switch (type) {
    case 'text':
      return (
        <input
          className={styles.formInput}
          placeholder={placeholder ?? 'Введите значение'}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )

    case 'select':
      return (
        <Combobox
          options={options}
          value={typeof value === 'string' ? value : ''}
          onChange={(v) => onChange(v)}
          placeholder={placeholder ?? '— любое —'}
        />
      )

    case 'multiselect':
      return (
        <MultiSelect
          options={options}
          value={Array.isArray(value) ? value : []}
          onChange={(v) => onChange(v.length ? v : null)}
          placeholder={placeholder ?? '— любые —'}
        />
      )

    case 'daterange': {
      const r: DateRange =
        value && typeof value === 'object' && !Array.isArray(value)
          ? (value as DateRange)
          : { from: '', to: '' }
      const patch = (p: Partial<DateRange>) => {
        const next = { ...r, ...p }
        onChange(next.from || next.to ? next : null)
      }
      return (
        <div className={styles.filterDaterange}>
          <input
            type="date"
            className={styles.formInput}
            value={r.from}
            onChange={(e) => patch({ from: e.target.value })}
          />
          <span className={styles.filterDaterangeDash}>—</span>
          <input
            type="date"
            className={styles.formInput}
            value={r.to}
            onChange={(e) => patch({ to: e.target.value })}
          />
        </div>
      )
    }

    case 'boolean': {
      // Поле с выбором из значений — выпадающим списком (общий Combobox).
      // «— любое —» (пустое) = null/не фильтруем; Да = true, Нет = false.
      const v: boolean | null = typeof value === 'boolean' ? value : null
      return (
        <Combobox
          options={[
            { value: 'true', label: 'Да' },
            { value: 'false', label: 'Нет' },
          ]}
          value={v === null ? '' : v ? 'true' : 'false'}
          onChange={(s) => onChange(s === '' ? null : s === 'true')}
          placeholder={placeholder ?? '— любое —'}
        />
      )
    }

    default:
      return null
  }
}

interface MenuRect {
  top: number
  left: number
  width: number
}

/** Мультивыбор: кнопка со сводкой + портальное меню чекбоксов. */
function MultiSelect({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: ComboboxOption[]
  value: string[]
  onChange: (v: string[]) => void
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<MenuRect | null>(null)

  useLayoutEffect(() => {
    if (!open) {
      setRect(null)
      return
    }
    const place = () => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setRect({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  const toggle = (val: string) => {
    onChange(value.includes(val) ? value.filter((x) => x !== val) : [...value, val])
  }

  const summary = value.length
    ? options
        .filter((o) => value.includes(o.value))
        .map((o) => o.label)
        .join(', ')
    : placeholder

  const menu =
    open && rect
      ? createPortal(
          <div
            className={styles.msMenu}
            role="listbox"
            // zIndex 1000 — над модулем поиска (.filterPop = 200), как у Combobox.
            style={{
              position: 'fixed',
              top: rect.top,
              left: rect.left,
              minWidth: rect.width,
              zIndex: 1000,
            }}
          >
            {options.map((o) => {
              const on = value.includes(o.value)
              return (
                <button
                  key={o.value}
                  type="button"
                  className={styles.filterMsOption}
                  role="option"
                  aria-selected={on}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => toggle(o.value)}
                >
                  <span className={styles.filterMsCheck} data-on={String(on)}>
                    {on && <Icon name="check" size={12} />}
                  </span>
                  <span className={styles.filterMsOptionTitle}>{o.label}</span>
                </button>
              )
            })}
          </div>,
          document.body,
        )
      : null

  return (
    <div
      className={styles.filterMs}
      ref={ref}
      onBlur={() => window.setTimeout(() => setOpen(false), 120)}
    >
      <div className={styles.comboControl}>
        <button
          type="button"
          className={[styles.formInput, styles.filterMsTrigger].join(' ')}
          data-empty={String(value.length === 0)}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={styles.filterMsSummary}>{summary}</span>
        </button>
        <button
          className={styles.comboToggle}
          type="button"
          aria-label="Открыть список"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name="chevdown_sm" size={14} />
        </button>
      </div>
      {menu}
    </div>
  )
}

export default FieldEditor
