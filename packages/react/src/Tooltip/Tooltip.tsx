import {
  cloneElement,
  forwardRef,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

import { chain, cx, hoverUnavailable } from '../popup/popup.js'

import styles from './Tooltip.module.css'

type TriggerProps = HTMLAttributes<HTMLElement> & { 'aria-describedby'?: string }

export interface TooltipProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Текст подсказки. */
  label: ReactNode
  /** Сочетание клавиш — рисуется плашкой после текста («Ctrl K»). */
  shortcut?: string
  /** С какой стороны от элемента; нет места — встаёт с другой. */
  side?: 'top' | 'bottom'
  /** Задержка первого появления, мс. Соседняя подсказка открывается сразу. */
  openDelay?: number
  disabled?: boolean
  /** Один элемент-якорь: кнопка, ссылка, значок с `tabIndex`. */
  children: ReactElement<TriggerProps>
}

const GAP = 6
const MARGIN = 8
/** Сколько после закрытия одной подсказки соседняя ещё открывается сразу. */
const SKIP_WINDOW = 300

// Общее на страницу: пока одна подсказка открыта (или только что закрылась),
// соседние открываются без задержки и без анимации — панель кнопок
// «читается» одним движением мыши.
let openCount = 0
let lastClosedAt = 0
const isWarm = () => openCount > 0 || Date.now() - lastClosedAt < SKIP_WINDOW

/** Только для тестов: сбросить «тёплое» состояние между сценариями. */
export function resetTooltipWarmth(): void {
  openCount = 0
  lastClosedAt = 0
}

/**
 * Подсказка при наведении и при фокусе с клавиатуры.
 *
 * Первая появляется через 350 мс, соседние — сразу. На сенсорных экранах не
 * показывается: наведения там нет, а подпись у элемента должна быть и без
 * подсказки (`aria-label`). Щелчок по элементу и Esc подсказку убирают.
 */
export const Tooltip = forwardRef<HTMLSpanElement, TooltipProps>(function Tooltip(
  { label, shortcut, side = 'top', openDelay = 350, disabled = false, children, className, style, ...rest },
  ref,
) {
  const id = `tip-${useId()}`
  const [mode, setMode] = useState<false | 'animated' | 'instant'>(false)
  const [pos, setPos] = useState<{ top: number; left: number; origin: string } | null>(null)
  const anchorRef = useRef<HTMLElement | null>(null)
  const tipRef = useRef<HTMLSpanElement | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Палец: после касания приходят «мышиные» события — их пропускаем.
  const touched = useRef(false)
  // Фокус от щелчка мышью подсказку не открывает — только с клавиатуры.
  const pointerFocus = useRef(false)
  const open = mode !== false

  const clear = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  const show = (el: HTMLElement, immediate: boolean) => {
    if (disabled) return
    anchorRef.current = el
    clear()
    if (isWarm()) setMode('instant')
    else if (immediate || openDelay <= 0) setMode('animated')
    else timer.current = setTimeout(() => setMode('animated'), openDelay)
  }
  const hide = () => {
    clear()
    setMode(false)
  }

  useEffect(() => clear, [])
  useEffect(() => {
    if (disabled) hide()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled])

  // Счётчик открытых — для «соседняя открывается сразу».
  useEffect(() => {
    if (!open) return
    openCount++
    return () => {
      openCount = Math.max(0, openCount - 1)
      lastClosedAt = Date.now()
    }
  }, [open])

  // Esc, прокрутка и уход из окна подсказку убирают.
  useEffect(() => {
    if (!open) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') hide()
    }
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('blur', hide)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('blur', hide)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Место: над элементом по центру; не помещается — под ним; за края окна
  // не выходит. Точка роста анимации — середина элемента-якоря.
  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    const a = anchorRef.current
    const tip = tipRef.current
    if (!a || !tip) return
    const r = a.getBoundingClientRect()
    const w = tip.offsetWidth
    const h = tip.offsetHeight
    const fitsTop = r.top - GAP - h >= MARGIN
    const fitsBottom = r.bottom + GAP + h <= window.innerHeight - MARGIN
    const top = side === 'top' ? fitsTop || !fitsBottom : !fitsBottom && fitsTop
    const center = r.left + r.width / 2
    const left = Math.max(MARGIN, Math.min(center - w / 2, window.innerWidth - w - MARGIN))
    setPos({
      top: top ? r.top - GAP - h : r.bottom + GAP,
      left,
      origin: `${Math.round(center - left)}px ${top ? '100%' : '0%'}`,
    })
  }, [open, side, label, shortcut])

  const p = children.props
  const describedBy = [p['aria-describedby'], open ? id : null].filter(Boolean).join(' ') || undefined
  const trigger = cloneElement(children, {
    'aria-describedby': describedBy,
    onMouseEnter: chain(p.onMouseEnter, (e: MouseEvent<HTMLElement>) => {
      if (touched.current || hoverUnavailable()) return
      show(e.currentTarget, false)
    }),
    onMouseLeave: chain(p.onMouseLeave, () => {
      touched.current = false
      hide()
    }),
    onTouchStart: chain(p.onTouchStart, () => {
      touched.current = true
      hide()
    }),
    onPointerDown: chain(p.onPointerDown, () => {
      pointerFocus.current = true
      hide()
    }),
    onFocus: chain(p.onFocus, (e: FocusEvent<HTMLElement>) => {
      if (pointerFocus.current || touched.current) return
      // С клавиатуры — сразу: читалке описание нужно в момент фокуса.
      show(e.currentTarget, true)
    }),
    onBlur: chain(p.onBlur, () => {
      pointerFocus.current = false
      hide()
    }),
    onKeyDown: chain(p.onKeyDown, (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === 'Escape') hide()
    }),
  })

  const tipStyle: CSSProperties = pos
    ? { ...style, top: pos.top, left: pos.left, transformOrigin: pos.origin }
    : { ...style, top: 0, left: 0, visibility: 'hidden' }

  return (
    <>
      {trigger}
      {open &&
        createPortal(
          <span
            {...rest}
            ref={(el) => {
              tipRef.current = el
              if (typeof ref === 'function') ref(el)
              else if (ref) ref.current = el
            }}
            id={id}
            role="tooltip"
            className={cx(styles.tip, className)}
            data-instant={mode === 'instant' || undefined}
            style={tipStyle}
          >
            <span className={styles.text}>{label}</span>
            {shortcut && <kbd className={styles.kbd}>{shortcut}</kbd>}
          </span>,
          document.body,
        )}
    </>
  )
})
