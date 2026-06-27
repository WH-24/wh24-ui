import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'

import { Icon } from './Icon.js'
import styles from './Combobox.module.css'

/** Стили модуля Combobox — реэкспорт, чтобы MultiSelect (FieldEditor) мог
 *  переиспользовать те же scoped-классы меню/опций. */
export const comboStyles = styles

export interface ComboboxOption {
  value: string // стабильный id (department_id / position_id / …)
  label: string // основной текст
  hint?: string | null // вторичный текст (код), участвует в поиске
}

interface ComboboxProps {
  options: ComboboxOption[]
  value: string
  onChange: (value: string) => void
  /** Текст-плейсхолдер и подпись «сбросить»-опции. */
  placeholder?: string
  id?: string
  ariaLabel?: string
  /** Доп. класс на корень `.combo` (например для тулбара). */
  className?: string
  /** Инлайн-стиль корня (например ширина в тулбаре-фильтре). */
  style?: CSSProperties
  disabled?: boolean
  /**
   * Можно ли сбросить значение в пустое (опция-плейсхолдер в меню). true для
   * фильтров и необязательных полей; false для обязательных enum (статус и т.п.),
   * где пустого значения быть не должно. По умолчанию true.
   */
  clearable?: boolean
}

interface MenuRect {
  top: number
  left: number
  width: number
  maxWidth: number
}

/**
 * Combobox — выпадающий список с поиском по значению. Совместная замена
 * нативного <select>: значения грузятся из БД, набор текста фильтрует список
 * по label и hint. Выбор кладёт `value` (id) через onChange.
 *
 * Меню рендерится через портал в <body> с position:fixed и высоким z-index —
 * иначе его режет overflow:hidden/auto родителей (модалка/дроуэр) и перекрывает
 * z-index модалки. Координаты считаем от контрола и пересчитываем на scroll/resize.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = '— не выбрано —',
  id,
  ariaLabel = 'Открыть список',
  className,
  style,
  disabled = false,
  clearable = true,
}: ComboboxProps) {
  const selected = options.find((o) => o.value === value) ?? null
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(selected?.label ?? '')
  const controlRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<MenuRect | null>(null)

  // Внешняя смена value (сброс формы, выбор отдела и т.п.) синхронизирует поле.
  useEffect(() => {
    setQuery(selected?.label ?? '')
  }, [selected?.value, selected?.label])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    // Пока в поле — выбранное значение (пользователь ещё не начал печатать
    // новое), показываем весь список: можно просто открыть и выбрать.
    if (!q || q === (selected?.label ?? '').toLowerCase()) return options
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.hint ?? '').toLowerCase().includes(q),
    )
  }, [options, query, selected?.label])

  // Позиционируем портальное меню под контролом и держим в пределах вьюпорта.
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
    // capture=true ловит скролл любого контейнера-предка (modal-body и т.п.).
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  // Клик мимо/уход фокуса — закрыть и вернуть текст к выбранному значению.
  const closeAndReset = () => {
    window.setTimeout(() => {
      setOpen(false)
      setQuery(selected?.label ?? '')
    }, 120)
  }

  const choose = (opt: ComboboxOption | null) => {
    onChange(opt?.value ?? '')
    setQuery(opt?.label ?? '')
    setOpen(false)
  }

  const menu =
    open && rect
      ? createPortal(
          <div
            className={styles.menu}
            role="listbox"
            style={{
              position: 'fixed',
              top: rect.top,
              left: rect.left,
              minWidth: rect.width,
              maxWidth: rect.maxWidth,
              zIndex: 1000,
            }}
          >
            {clearable && (
              <button
                type="button"
                className={styles.option}
                role="option"
                aria-selected={!value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(null)}
              >
                {placeholder}
              </button>
            )}
            {filtered.length === 0 ? (
              <div className={styles.empty}>Ничего не найдено</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={styles.option}
                  role="option"
                  aria-selected={o.value === value}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(o)}
                >
                  <span className={styles.optionTitle}>{o.label}</span>
                  {o.hint && <span className={styles.optionCode}>{o.hint}</span>}
                </button>
              ))
            )}
          </div>,
          document.body,
        )
      : null

  return (
    <div
      className={[styles.combo, className].filter(Boolean).join(' ')}
      style={style}
      onBlur={disabled ? undefined : closeAndReset}
    >
      <div className={styles.control} ref={controlRef}>
        <input
          id={id}
          className={[styles.formInput, styles.input].join(' ')}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          disabled={disabled}
          value={query}
          placeholder={placeholder}
          onFocus={() => !disabled && setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false)
              setQuery(selected?.label ?? '')
            }
            if (e.key === 'Enter' && filtered[0]) {
              e.preventDefault()
              choose(filtered[0])
            }
          }}
        />
        <button
          className={styles.toggle}
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

export default Combobox
