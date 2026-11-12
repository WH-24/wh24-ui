import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

import { Icon } from '../list/Icon.js'
import { OptionMarker, hasOptionMarker, type ComboboxOption } from '../list/Combobox.js'
import { placePopover, revealOption } from '../list/popover.js'

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
  maxHeight: number
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
 * `overflow` модалки/дроуэра. Координаты пересчитываются на scroll/resize;
 * у нижнего края окна меню открывается вверх.
 *
 * Клавиатура (как у Combobox): ↓/↑ подсвечивают вариант (и открывают
 * список), Home/End — первый/последний, Enter переключает подсвеченный,
 * Esc закрывает только список. Фокус остаётся в поле, читалка слышит
 * подсвеченный вариант через `aria-activedescendant`.
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
  const [active, setActive] = useState(-1)
  const baseId = useId()
  const menuRef = useRef<HTMLDivElement>(null)

  const selectedSet = useMemo(() => new Set(values), [values])
  const byValue = useMemo(() => new Map(options.map((o) => [o.value, o])), [options])
  // Чипы в порядке values; для неизвестного id (значение есть, а опции уже
  // нет — справочник почистили) показываем сам id, а не выкидываем значение:
  // молча потерянный выбор хуже некрасивого.
  const chips = values.map((v) => {
    const o = byValue.get(v)
    return { value: v, label: o?.label ?? v, icon: o?.icon, color: o?.color }
  })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.hint ?? '').toLowerCase().includes(q),
    )
  }, [options, query])

  // Подсветка: при открытии и смене отбора — на первый вариант запроса,
  // без запроса — нигде (Enter не должен ничего переключать сам).
  useEffect(() => {
    setActive(open && query.trim() !== '' && filtered.length > 0 ? 0 : -1)
  }, [open, query, filtered.length])
  useEffect(() => {
    if (open && active >= 0) revealOption(`${baseId}-opt-${active}`)
  }, [open, active, baseId])

  const placeRef = useRef<() => void>(() => {})
  placeRef.current = () => {
    const el = controlRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const m = menuRef.current
    const maxWidth = Math.max(r.width, Math.min(520, window.innerWidth - 16))
    const width = Math.min(maxWidth, Math.max(r.width, m?.offsetWidth ?? r.width))
    const height = Math.min(240, m?.scrollHeight ?? 240)
    const p = placePopover(r, { width, height })
    setRect({ top: p.top, left: p.left, width: r.width, maxWidth, maxHeight: Math.min(240, p.maxHeight) })
  }
  const menuShown = open && rect !== null
  useLayoutEffect(() => {
    if (menuShown) placeRef.current()
  }, [menuShown, filtered.length, values.length])

  useLayoutEffect(() => {
    if (!open) {
      setRect(null)
      return
    }
    const place = () => placeRef.current()
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
            ref={menuRef}
            id={`${baseId}-list`}
            className={styles.menu}
            role="listbox"
            aria-multiselectable
            style={{
              position: 'fixed',
              top: rect.top,
              left: rect.left,
              minWidth: rect.width,
              maxWidth: rect.maxWidth,
              maxHeight: rect.maxHeight,
            }}
          >
            {filtered.length === 0 ? (
              <div className={styles.empty}>{emptyText}</div>
            ) : (
              filtered.map((o, i) => {
                const on = selectedSet.has(o.value)
                return (
                  <button
                    key={o.value}
                    id={`${baseId}-opt-${i}`}
                    type="button"
                    tabIndex={-1}
                    className={[styles.option, i === active ? styles.optionActive : ''].filter(Boolean).join(' ')}
                    role="option"
                    aria-selected={on}
                    onMouseEnter={() => setActive(i)}
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
                    {hasOptionMarker(o) && <OptionMarker {...o} />}
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
          <span
            key={c.value}
            className={styles.mcChip}
            // Цвет варианта — светлым фоном чипа, иконка — перед подписью.
            style={c.color ? ({ '--chip-color': c.color } as CSSProperties) : undefined}
            data-color={c.color ? '' : undefined}
          >
            {c.icon && <OptionMarker icon={c.icon} color={c.color} />}
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
          aria-controls={open ? `${baseId}-list` : undefined}
          aria-activedescendant={open && active >= 0 ? `${baseId}-opt-${active}` : undefined}
          disabled={disabled}
          value={query}
          placeholder={chips.length === 0 ? placeholder : ''}
          onFocus={() => !disabled && setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && open) {
              // Открытый список съедает Esc: окно вокруг не закрывается.
              e.preventDefault()
              e.stopPropagation()
              setOpen(false)
              setQuery('')
            }
            if (e.key === 'Backspace' && query === '' && values.length) {
              onChange(values.slice(0, -1))
            }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              if (!open) {
                setOpen(true)
                return
              }
              const n = filtered.length
              if (n === 0) return
              setActive((i) =>
                e.key === 'ArrowDown' ? (i + 1 + n) % n : i <= 0 ? n - 1 : i - 1,
              )
            }
            if (open && (e.key === 'Home' || e.key === 'End') && query === '' && filtered.length) {
              e.preventDefault()
              setActive(e.key === 'Home' ? 0 : filtered.length - 1)
            }
            if (e.key === 'Enter') {
              const opt = active >= 0 ? filtered[active] : filtered.length === 1 ? filtered[0] : undefined
              if (open && opt) {
                e.preventDefault()
                toggle(opt)
              }
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
