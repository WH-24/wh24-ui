import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { usePopPresence } from '../overlay/presence.js'
import { getFocusableElements } from '../overlay/useFocusTrap.js'
import { cx, useAnchoredPlace } from './popup.js'

import styles from './AnchorPopover.module.css'

/**
 * Небольшая панель у якоря с полями внутри (значение условия фильтра,
 * название нового вида). Для списка действий есть `Menu`; это — для случая,
 * когда во всплывающем нужно поле ввода. Порталом в `body`, место считает
 * общий `useAnchoredPlace`, движение — `usePopPresence` (с клавиатуры — сразу).
 *
 * Фокус уходит в первое поле, Tab ходит по кругу внутри, Esc и щелчок мимо
 * закрывают (Esc возвращает фокус на якорь). Вложенные всплывающие (календарь,
 * список выбора) «мимо» не считаются.
 */
export interface AnchorPopoverProps {
  open: boolean
  /** `returnFocus` — закрыто с клавиатуры: фокус вернуть на якорь. */
  onClose: (returnFocus: boolean) => void
  anchor: () => HTMLElement | null
  /** Имя панели для читалки. */
  label: string
  children: ReactNode
  align?: 'start' | 'end'
  className?: string
  style?: CSSProperties
}

const NESTED = '[role="dialog"], [role="listbox"], [role="menu"]'

export function AnchorPopover({ open, onClose, anchor, label, children, align = 'start', className, style }: AnchorPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const pop = usePopPresence(open, ref)
  const place = useAnchoredPlace(pop.mounted, anchor, ref, align)
  const close = useRef(onClose)
  close.current = onClose
  const anchorRef = useRef(anchor)
  anchorRef.current = anchor

  useEffect(() => {
    if (!open) return
    const first = ref.current ? getFocusableElements(ref.current)[0] : undefined
    ;(first ?? ref.current)?.focus()
    const onDown = (e: MouseEvent) => {
      const t = e.target as Element
      if (ref.current?.contains(t) || anchorRef.current()?.contains(t)) return
      // Календарь или список, открытые из панели, — её часть.
      const nested = t.closest?.(NESTED)
      if (nested && !nested.contains(anchorRef.current())) return
      close.current(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  if (!pop.mounted) return null

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.defaultPrevented) return
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose(true)
      return
    }
    if (e.key !== 'Tab' || !ref.current) return
    const els = getFocusableElements(ref.current)
    if (els.length === 0) return
    const first = els[0]!
    const last = els[els.length - 1]!
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      className={cx(styles.pop, className)}
      data-align={align}
      data-flipped={place?.flipped || undefined}
      data-instant={pop.instant || undefined}
      style={{
        ...style,
        top: place?.top ?? 0,
        left: place?.left ?? 0,
        visibility: place ? undefined : 'hidden',
      }}
      onKeyDown={onKey}
      // Панель — в портале: щелчок внутри не должен всплыть в строку таблицы.
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  )
}
