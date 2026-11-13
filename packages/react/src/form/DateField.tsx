import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'

import { placePopover } from '../list/popover.js'

import styles from './form.module.css'

export interface DateFieldProps {
  /** Значение в ISO-формате yyyy-mm-dd ('' — не заполнено). */
  value: string
  /** Новое значение (yyyy-mm-dd или '' если очищено). */
  onChange: (value: string) => void
  min?: string
  max?: string
  id?: string
  disabled?: boolean
  className?: string
  ariaLabel?: string
  style?: CSSProperties
  /** Значение не прошло проверку — красная рамка у контрола. */
  invalid?: boolean
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTHS_GEN = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
]
const MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]

const pad = (n: number) => String(n).padStart(2, '0')
const toISO = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

/** Разбор ISO без часового пояса (yyyy-mm-dd → {y, m (0-based), d}) или null. */
function parseISO(s: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '')
  if (!match) return null
  const y = +match[1]!
  const m = +match[2]! - 1
  const d = +match[3]!
  if (m < 0 || m > 11 || d < 1 || d > 31) return null
  return { y, m, d }
}

/** Формат для поля: дд.мм.гггг. */
function formatRu(iso: string): string {
  const p = parseISO(iso)
  return p ? `${pad(p.d)}.${pad(p.m + 1)}.${p.y}` : ''
}

/** Маска ручного ввода: только цифры (максимум 8) с точками дд.мм.гггг. */
function maskRu(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  let out = digits.slice(0, 2)
  if (digits.length > 2) out += '.' + digits.slice(2, 4)
  if (digits.length > 4) out += '.' + digits.slice(4, 8)
  return out
}

/** Разбор введённого дд.мм.гггг → ISO; null, если дата неполная или
 *  несуществующая (31.02.2020 — не дата, а опечатка). */
function parseRu(s: string): string | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s)
  if (!m) return null
  const d = +m[1]!
  const mo = +m[2]!
  const y = +m[3]!
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const dt = new Date(y, mo - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null
  return toISO(y, mo - 1, d)
}

function todayISO(): string {
  const t = new Date()
  return toISO(t.getFullYear(), t.getMonth(), t.getDate())
}

/** Сдвиг даты на n дней (через Date — переходы месяцев и годов сами). */
function addDays(iso: string, n: number): string {
  const p = parseISO(iso)!
  const d = new Date(p.y, p.m, p.d + n)
  return toISO(d.getFullYear(), d.getMonth(), d.getDate())
}
/** Сдвиг на n месяцев с прижатием дня (31 января + 1 мес. = 28/29 февраля). */
function addMonths(iso: string, n: number): string {
  const p = parseISO(iso)!
  const last = new Date(p.y, p.m + n + 1, 0)
  return toISO(last.getFullYear(), last.getMonth(), Math.min(p.d, last.getDate()))
}

/** Понедельник-первый: JS getDay() 0=Вс..6=Сб → 0=Пн..6=Вс. */
const mondayFirst = (jsDay: number) => (jsDay + 6) % 7

interface PopRect {
  top: number
  left: number
}

/**
 * DateField — выбор даты календарём дизайн-системы, а не нативным виджетом
 * браузера: нативный `<input type="date">` рисуется по-своему в каждом
 * браузере и ломает единый вид формы (та же причина, по которой в портале
 * нет нативного `<select>`).
 *
 * Значение in/out — ISO yyyy-mm-dd, ввод с клавиатуры — маска дд.мм.гггг.
 * Поповер рендерится порталом в <body> (`position: fixed`), чтобы его не
 * резал `overflow` модалки или дроуэра; у нижнего края окна он открывается
 * вверх.
 *
 * Календарь с клавиатуры: при открытии фокус встаёт на выбранный день (или
 * сегодня); ←/→ — день, ↑/↓ — неделя, PageUp/PageDown — месяц (с Shift —
 * год), Home/End — начало/конец недели, Enter — выбрать, Tab ходит внутри
 * календаря, Esc закрывает и возвращает фокус на кнопку календаря. Дни
 * читаются полностью: «12 ноября 2026, сегодня».
 */
export function DateField({
  value,
  onChange,
  min,
  max,
  id,
  disabled,
  className,
  ariaLabel,
  style,
  invalid = false,
}: DateFieldProps) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<PopRect | null>(null)
  // Текст поля для ручного ввода (маскированный дд.мм.гггг).
  const [text, setText] = useState(() => formatRu(value))
  const controlRef = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const iconRef = useRef<HTMLButtonElement>(null)
  // День под «клавиатурным» фокусом в сетке (роуминг tabindex).
  const [focusDay, setFocusDay] = useState('')

  // Показанный месяц: от выбранной даты, иначе текущий.
  const [view, setView] = useState(() => {
    const p = parseISO(value) ?? parseISO(todayISO())!
    return { y: p.y, m: p.m }
  })

  // Внешняя смена value (сброс формы, выбор в календаре) синхронизирует и
  // текст поля, и показанный месяц.
  useEffect(() => {
    setText(formatRu(value))
    const p = parseISO(value)
    if (p) setView({ y: p.y, m: p.m })
  }, [value])

  const placeRef = useRef<() => void>(() => {})
  placeRef.current = () => {
    const el = controlRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const pop = popRef.current
    const p = placePopover(r, { width: pop?.offsetWidth ?? 268, height: pop?.offsetHeight ?? 320 })
    setRect({ top: p.top, left: p.left })
  }
  // Календарь отрисовался — уточняем место по настоящему размеру.
  const popShown = open && rect !== null
  useLayoutEffect(() => {
    if (popShown) placeRef.current()
  }, [popShown])

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

  // Закрытие по клику мимо и по Esc.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (controlRef.current?.contains(t) || popRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Esc закрывает только календарь: окно вокруг (модалка, панель)
      // видит defaultPrevented и остаётся открытым — форма не теряется.
      e.preventDefault()
      const inside = popRef.current?.contains(document.activeElement)
      setOpen(false)
      if (inside) iconRef.current?.focus()
    }
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const outOfRange = (iso: string) => Boolean((min && iso < min) || (max && iso > max))

  const pick = (iso: string) => {
    if (outOfRange(iso)) return
    const inside = popRef.current?.contains(document.activeElement)
    onChange(iso)
    setOpen(false)
    if (inside) iconRef.current?.focus()
  }

  // День в пределах min/max: на выключенный день фокус не встанет.
  const clamp = (iso: string) => (min && iso < min ? min : max && iso > max ? max : iso)

  // Открыли — клавиатурный фокус на выбранный день (или сегодня), месяц —
  // его. Фокус переносим в сетку, когда календарь уже стоит на месте, и
  // только при открытии и по стрелкам: «‹ ›» мышью фокус не уводят.
  const wantGridFocus = useRef(false)
  useEffect(() => {
    if (!open) return
    const start = clamp(parseISO(value) ? value : todayISO())
    setFocusDay(start)
    const p = parseISO(start)!
    setView({ y: p.y, m: p.m })
    wantGridFocus.current = true
  }, [open, value])
  useEffect(() => {
    if (!popShown || !focusDay || !wantGridFocus.current) return
    const btn = popRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${focusDay}"]`)
    if (!btn) return
    wantGridFocus.current = false
    if (document.activeElement !== btn) btn.focus({ preventScroll: true })
  }, [popShown, focusDay, view])

  const moveFocus = (raw: string) => {
    const iso = clamp(raw)
    wantGridFocus.current = true
    setFocusDay(iso)
    const p = parseISO(iso)!
    setView((v) => (v.y === p.y && v.m === p.m ? v : { y: p.y, m: p.m }))
  }

  const onGridKey = (e: ReactKeyboardEvent) => {
    if (!focusDay) return
    const p = parseISO(focusDay)!
    const dow = mondayFirst(new Date(p.y, p.m, p.d).getDay())
    const step: Record<string, () => string> = {
      ArrowLeft: () => addDays(focusDay, -1),
      ArrowRight: () => addDays(focusDay, 1),
      ArrowUp: () => addDays(focusDay, -7),
      ArrowDown: () => addDays(focusDay, 7),
      Home: () => addDays(focusDay, -dow),
      End: () => addDays(focusDay, 6 - dow),
      PageUp: () => addMonths(focusDay, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focusDay, e.shiftKey ? 12 : 1),
    }
    const fn = step[e.key]
    if (!fn) return
    e.preventDefault()
    moveFocus(fn())
  }

  // Tab ходит по кругу внутри календаря: он в портале у конца <body>, и без
  // этого Tab уводил фокус на страницу (или ловушка окна — в начало формы).
  const onPopKey = (e: ReactKeyboardEvent) => {
    if (e.key !== 'Tab') return
    const items = Array.from(
      popRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled]):not([tabindex="-1"])') ?? [],
    )
    if (items.length === 0) return
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i + 1) % items.length
    e.preventDefault()
    items[next]!.focus()
  }

  // Ручной ввод: маскируем и коммитим, как только собрана валидная дата в
  // допустимом диапазоне. Частичный/неверный ввод value не трогает — он
  // сверяется на blur.
  const handleInput = (e: ChangeEvent<HTMLInputElement>) => {
    const masked = maskRu(e.target.value)
    setText(masked)
    if (masked === '') {
      onChange('')
      return
    }
    const iso = parseRu(masked)
    if (iso && !outOfRange(iso)) onChange(iso)
  }

  // На blur возвращаем отображение к последнему принятому значению — чтобы в
  // поле не остался частичный или несуществующий ввод.
  const handleBlur = () => setText(formatRu(value))

  const shiftMonth = (delta: number) =>
    setView((v) => {
      const m = v.m + delta
      if (m < 0) return { y: v.y - 1, m: 11 }
      if (m > 11) return { y: v.y + 1, m: 0 }
      return { y: v.y, m }
    })

  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const leading = mondayFirst(new Date(view.y, view.m, 1).getDay())
  const cells: (number | null)[] = [
    ...Array<null>(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  const today = todayISO()

  const popover =
    open && rect
      ? createPortal(
          <div
            ref={popRef}
            className={styles.dpPop}
            role="dialog"
            aria-label="Календарь"
            style={{ position: 'fixed', top: rect.top, left: rect.left }}
            onKeyDown={onPopKey}
          >
            <div className={styles.dpHead}>
              <button
                type="button"
                className={styles.dpNav}
                aria-label="Предыдущий месяц"
                onClick={() => {
                  shiftMonth(-1)
                  if (focusDay) setFocusDay(addMonths(focusDay, -1))
                }}
              >
                ‹
              </button>
              <span className={styles.dpTitle} aria-live="polite">
                {MONTHS[view.m]} {view.y}
              </span>
              <button
                type="button"
                className={styles.dpNav}
                aria-label="Следующий месяц"
                onClick={() => {
                  shiftMonth(1)
                  if (focusDay) setFocusDay(addMonths(focusDay, 1))
                }}
              >
                ›
              </button>
            </div>
            <div className={[styles.dpGrid, styles.dpGridWd].join(' ')}>
              {WEEKDAYS.map((w) => (
                <span key={w} className={styles.dpWd}>
                  {w}
                </span>
              ))}
            </div>
            <div className={styles.dpGrid} onKeyDown={onGridKey}>
              {cells.map((d, i) => {
                if (d === null) return <span key={`e${i}`} className={styles.dpEmpty} />
                const iso = toISO(view.y, view.m, d)
                const off = outOfRange(iso)
                const cls = [
                  styles.dpDay,
                  iso === value ? styles.dpSel : '',
                  iso === today ? styles.dpToday : '',
                  off ? styles.dpOff : '',
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <button
                    key={iso}
                    type="button"
                    className={cls}
                    disabled={off}
                    data-iso={iso}
                    tabIndex={iso === focusDay ? 0 : -1}
                    aria-pressed={iso === value}
                    aria-current={iso === today ? 'date' : undefined}
                    aria-label={`${d} ${MONTHS_GEN[view.m]} ${view.y}${iso === today ? ', сегодня' : ''}`}
                    onClick={() => pick(iso)}
                  >
                    {d}
                  </button>
                )
              })}
            </div>
            <div className={styles.dpFoot}>
              <button
                type="button"
                className={styles.dpLink}
                onClick={() => pick(today)}
                disabled={outOfRange(today)}
              >
                Сегодня
              </button>
              {value && (
                <button
                  type="button"
                  className={[styles.dpLink, styles.dpLinkMuted].join(' ')}
                  onClick={() => {
                    onChange('')
                    setOpen(false)
                  }}
                >
                  Очистить
                </button>
              )}
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <div
        ref={controlRef}
        className={[styles.control, styles.dpControl, className].filter(Boolean).join(' ')}
        data-disabled={disabled || undefined}
        aria-invalid={invalid || undefined}
        style={style}
      >
        <input
          id={id}
          type="text"
          inputMode="numeric"
          className={styles.dpInput}
          placeholder="дд.мм.гггг"
          value={text}
          disabled={disabled}
          aria-label={ariaLabel}
          maxLength={10}
          onChange={handleInput}
          onBlur={handleBlur}
        />
        <button
          ref={iconRef}
          type="button"
          className={styles.dpIcon}
          disabled={disabled}
          aria-label="Открыть календарь"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => !disabled && setOpen((o) => !o)}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        </button>
      </div>
      {popover}
    </>
  )
}
