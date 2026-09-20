import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

import { Icon } from '../list/Icon.js'
import type { ComboboxOption } from '../list/Combobox.js'

import styles from './form.module.css'

export interface MultiComboboxProps {
  options: ComboboxOption[]
  /** Выбранные значения (id опций). */
  values: string[]
  onChange: (values: string[]) => void
  /** Плейсхолдер, когда ничего не выбрано. */
  placeholder?: string
  id?: string
  ariaLabel?: string
  className?: string
  style?: CSSProperties
  disabled?: boolean
  /** Значение не прошло проверку — красная рамка у контрола. */
  invalid?: boolean
  /** Текст пустого меню. */
  emptyText?: string
}

interface MenuRect {
  top: number
  left: number
  width: number
  maxWidth: number
}

/**
 * MultiCombobox — мультивыбор из справочника с поиском. Выбранные значения
 * показываются чипами прямо в контроле; в выпадашке пункты с галочкой, клик
 * переключает выбор и меню НЕ закрывается (иначе выбрать пять значений — пять
 * открытий списка). Backspace на пустом вводе убирает последний чип.
 *
 * Отдельный компонент от Combobox (одиночный выбор): тот кладёт один `value`,
 * этот — массив, и контрол у него растёт по высоте под чипы.
 *
 * Меню рендерится порталом в <body> с `position: fixed` — иначе его режет
 * `overflow` модалки/дроуэра. Координаты пересчитываются на scroll/resize.
 */
export function MultiCombobox({
  options,
  values,
  onChange,
  placeholder = '— выбрать —',
  id,
  ariaLabel = 'Открыть список',
  className,
  style,
  disabled = false,
  invalid = false,
  emptyText = 'Ничего не найдено',
}: MultiComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const controlRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [rect, setRect] = useState<MenuRect | null>(null)

  const selectedSet = useMemo(() => new Set(values), [values])
  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options])
  // Чипы в порядке values; для неизвестного id (значение есть, а опции уже
  // нет — справочник почистили) показываем сам id, а не выкидываем значение:
  // молча потерянный выбор хуже некрасивого.
  const chips = values.map((v) => ({ value: v, label: byValue.get(v)?.label ?? v }))

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.hint ?? '').toLowerCase().includes(q),
    )
  }, [options, query])

  useLayoutEffect(() => {
    if (!open) {
      setRect(null)
      return
    }
    const place = () => {
      const el = controlRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const margin = 8
      setRect({
        top: r.bottom + 4,
        left: r.left,
        width: r.width,
        maxWidth: Math.max(r.width, Math.min(520, window.innerWidth - r.left - margin)),
      })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  // Закрытие «через кадр»: blur приходит раньше click по пункту меню, и
  // мгновенное закрытие съело бы сам выбор.
  const closeSoon = () => {
    window.setTimeout(() => {
      setOpen(false)
      setQuery('')
    }, 120)
  }

  const toggle = (opt: ComboboxOption) => {
    if (selectedSet.has(opt.value)) {
      onChange(values.filter((v) => v !== opt.value))
    } else {
      onChange([...values, opt.value])
    }
    setQuery('')
    inputRef.current?.focus()
  }

  const removeAt = (value: string) => {
    onChange(values.filter((v) => v !== value))
    inputRef.current?.focus()
  }

  const menu =
    open && rect
      ? createPortal(
          <div
            className={styles.menu}
            role="listbox"
            aria-multiselectable
            style={{
              position: 'fixed',
              top: rect.top,
              left: rect.left,
              minWidth: rect.width,
              maxWidth: rect.maxWidth,
            }}
          >
            {filtered.length === 0 ? (
              <div className={styles.empty}>{emptyText}</div>
            ) : (
              filtered.map((o) => {
                const on = selectedSet.has(o.value)
                return (
                  <button
                    key={o.value}
                    type="button"
                    className={styles.option}
                    role="option"
                    aria-selected={on}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => toggle(o)}
                  >
                    <span
                      className={[styles.mcCheck, on ? styles.mcCheckOn : '']
                        .filter(Boolean)
                        .join(' ')}
                      aria-hidden
                    >
                      {on && <Icon name="check" size={12} />}
                    </span>
                    <span className={styles.optionTitle}>{o.label}</span>
                    {o.hint && <span className={styles.optionCode}>{o.hint}</span>}
                  </button>
                )
              })
            )}
          </div>,
          document.body,
        )
      : null

  return (
    <div
      className={[styles.mc, className].filter(Boolean).join(' ')}
      style={style}
      onBlur={disabled ? undefined : closeSoon}
    >
      <div
        className={[styles.control, styles.mcControl].join(' ')}
        data-disabled={disabled || undefined}
        aria-invalid={invalid || undefined}
        ref={controlRef}
        onMouseDown={(e) => {
          // Клик по пустому месту контрола фокусирует ввод и открывает меню,
          // но не перехватывает клики по чипам и их крестикам.
          if (e.target === e.currentTarget && !disabled) {
            e.preventDefault()
            inputRef.current?.focus()
            setOpen(true)
          }
        }}
      >
        {chips.map((c) => (
          <span key={c.value} className={styles.mcChip}>
            {c.label}
            {!disabled && (
              <button
                type="button"
                className={styles.mcChipRm}
                aria-label={`Убрать «${c.label}»`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => removeAt(c.value)}
              >
                <Icon name="close" size={10} />
              </button>
            )}
          </span>
        ))}
        <input
          id={id}
          ref={inputRef}
          className={styles.mcInput}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          disabled={disabled}
          value={query}
          placeholder={chips.length === 0 ? placeholder : ''}
          onFocus={() => !disabled && setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false)
              setQuery('')
            }
            if (e.key === 'Backspace' && query === '' && values.length) {
              onChange(values.slice(0, -1))
            }
            if (e.key === 'Enter' && filtered.length === 1) {
              e.preventDefault()
              toggle(filtered[0]!)
            }
          }}
        />
        <button
          className={styles.mcToggle}
          type="button"
          aria-label={ariaLabel}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => !disabled && setOpen((v) => !v)}
        >
          <Icon name="chevdown_sm" size={14} />
        </button>
      </div>
      {!disabled && menu}
    </div>
  )
}
