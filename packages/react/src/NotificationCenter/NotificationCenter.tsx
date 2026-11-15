import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

import { Avatar } from '../Avatar/Avatar.js'
import { IconButton } from '../IconButton/IconButton.js'
import { Icon } from '../list/Icon.js'
import { usePresence, useExitAnimation } from '../overlay/presence.js'
import { cx, useAnchoredPlace } from '../popup/popup.js'

import styles from './NotificationCenter.module.css'

export interface NotificationItem {
  id: string
  /** Кто: имя для аватара и жирного начала строки. */
  who?: string
  /** Фото автора. */
  src?: string | null
  /** Что произошло. */
  text: ReactNode
  /** Когда — готовой строкой («5 минут назад»). */
  time?: string
  unread?: boolean
}

export interface NotificationCenterProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  items: NotificationItem[]
  /** Щелчок по уведомлению: перейти к записи и отметить прочитанным. */
  onItemClick?: (item: NotificationItem) => void
  /** «Прочитать все». Не задан — кнопки нет. */
  onMarkAllRead?: () => void
  /**
   * «Удалить все»: очистить ленту. Не задан — кнопки нет. Подтверждение
   * спрашивает хозяин (окно подтверждения поверх списка его не закрывает).
   */
  onClearAll?: () => void
  /** «Убрать из ленты» у одного уведомления. Не задан — крестика у строк нет. */
  onDismiss?: (item: NotificationItem) => void
  /** Низ окна под списком: например, ссылка «Все уведомления». */
  footer?: ReactNode
  /** Число на колокольчике; по умолчанию — непрочитанные среди `items`. */
  unreadCount?: number
  /** Управляемое открытие. Не задано — компонент ведёт его сам. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Закрывать список после щелчка по уведомлению. */
  closeOnItemClick?: boolean
  title?: string
  markAllLabel?: string
  clearAllLabel?: string
  dismissLabel?: string
  emptyText?: string
  /** Подпись колокольчика для читалки. */
  bellLabel?: (unread: number) => string
}

const EXIT_MS = 135

/**
 * Окно поверх страницы (подтверждение «Удалить все», модальное окно) или его
 * подложка: щелчок и фокус туда — продолжение работы со списком, не уход.
 */
function inModalLayer(node: Node | null): boolean {
  const el = node instanceof Element ? node : null
  if (!el) return false
  if (el.closest('[aria-modal="true"]')) return true
  return Array.from(el.children).some((c) => c.getAttribute('aria-modal') === 'true')
}
const defaultBellLabel = (n: number) => (n ? `Уведомления, непрочитанных: ${n}` : 'Уведомления')

/**
 * Центр уведомлений: колокольчик со счётчиком и список во всплывающем окне.
 * Данные и отметка «прочитано» — у хозяина: компонент ничего не загружает и
 * состояние уведомлений не хранит.
 */
export const NotificationCenter = forwardRef<HTMLDivElement, NotificationCenterProps>(function NotificationCenter(
  {
    items,
    onItemClick,
    onMarkAllRead,
    onClearAll,
    onDismiss,
    footer,
    unreadCount,
    open: openProp,
    onOpenChange,
    onBlur,
    onKeyDown,
    closeOnItemClick = false,
    title = 'Уведомления',
    markAllLabel = 'Прочитать все',
    clearAllLabel = 'Удалить все',
    dismissLabel = 'Убрать из ленты',
    emptyText = 'Новых уведомлений нет',
    bellLabel = defaultBellLabel,
    className,
    style,
    ...rest
  },
  ref,
) {
  const uid = useId()
  const [inner, setInner] = useState(false)
  const open = openProp ?? inner
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setInner(next)
    onOpenChange?.(next)
  }

  const anchorRef = useRef<HTMLSpanElement | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)
  const unread = unreadCount ?? items.filter((x) => x.unread).length

  const { mounted, exiting, finish } = usePresence(open)
  const place = useAnchoredPlace(mounted, () => anchorRef.current, popRef, 'end')
  useExitAnimation(
    exiting,
    [
      {
        ref: popRef,
        frames: [
          { opacity: 1, transform: 'none' },
          { opacity: 0, transform: 'scale(0.96)' },
        ],
        duration: EXIT_MS,
      },
    ],
    finish,
  )

  const focusBell = () => anchorRef.current?.querySelector('button')?.focus()

  // Щелчок мимо и Esc закрывают; Esc возвращает фокус на колокольчик.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent | MouseEvent) => {
      const t = e.target as Node | null
      if (popRef.current?.contains(t) || anchorRef.current?.contains(t) || inModalLayer(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      // Esc в окне подтверждения закрывает его, а не список.
      if (inModalLayer(e.target as Node | null)) return
      e.preventDefault()
      setOpen(false)
      focusBell()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, openProp])

  // Открылся — фокус в список: с клавиатуры до него иначе не дойти (портал).
  // Закрылся, а фокус был внутри (щелчок по уведомлению, колокольчик) —
  // возвращаем его на колокольчик, иначе он падает в начало страницы.
  useEffect(() => {
    if (open) {
      popRef.current?.focus()
      return
    }
    const pop = popRef.current
    if (pop && pop.contains(document.activeElement)) focusBell()
  }, [open])

  // Стрелки, Home и End ходят по уведомлениям — список длинный, Tab по нему
  // долгий. Tab остаётся обычным.
  const onListKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return
    const rows = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-note-row]'))
    if (!rows.length) return
    const at = rows.indexOf(document.activeElement as HTMLElement)
    let to = -1
    if (e.key === 'ArrowDown') to = Math.min(rows.length - 1, at + 1)
    else if (e.key === 'ArrowUp') to = at <= 0 ? 0 : at - 1
    else if (e.key === 'Home') to = 0
    else if (e.key === 'End') to = rows.length - 1
    if (to < 0) return
    e.preventDefault()
    rows[to]?.focus()
  }

  return (
    <>
      <span ref={anchorRef} className={styles.bell}>
        <IconButton ariaLabel={bellLabel(unread)} ariaExpanded={open} onClick={() => setOpen(!open)}>
          <Icon name="bell" size={16} />
        </IconButton>
        {unread > 0 && (
          <span className={styles.badge} aria-hidden="true">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </span>
      {mounted &&
        createPortal(
          <div
            {...rest}
            ref={(el) => {
              popRef.current = el
              if (typeof ref === 'function') ref(el)
              else if (ref) ref.current = el
            }}
            role="dialog"
            aria-labelledby={`${uid}-title`}
            tabIndex={-1}
            className={cx(styles.notes, className)}
            onKeyDown={(e) => {
              onKeyDown?.(e)
              if (!e.defaultPrevented) onListKey(e)
            }}
            // Фокус ушёл с клавиатуры дальше по странице — окно больше не
            // нужно. Уход «в никуда» (щелчок по пустому месту) закрывает
            // обработчик щелчка мимо.
            onBlur={(e) => {
              onBlur?.(e)
              const to = e.relatedTarget as Node | null
              if (!to || popRef.current?.contains(to) || anchorRef.current?.contains(to) || inModalLayer(to)) return
              setOpen(false)
            }}
            data-flipped={place?.flipped || undefined}
            style={{
              ...style,
              top: place?.top ?? 0,
              left: place?.left ?? 0,
              visibility: place ? undefined : 'hidden',
            }}
          >
            <div className={styles.head}>
              <b id={`${uid}-title`} className={styles.title}>
                {title}
              </b>
              <span className={styles.actions}>
                {onMarkAllRead && (
                  <button type="button" className={styles.markAll} disabled={unread === 0} onClick={onMarkAllRead}>
                    {markAllLabel}
                  </button>
                )}
                {onClearAll && (
                  <button type="button" className={styles.markAll} disabled={items.length === 0} onClick={onClearAll}>
                    {clearAllLabel}
                  </button>
                )}
              </span>
            </div>
            <div className={styles.list} style={place ? { maxHeight: Math.max(120, place.maxHeight - 48) } : undefined}>
              {items.length === 0 && <div className={styles.empty}>{emptyText}</div>}
              {items.map((x) => {
                const row = (
                  <button
                    key={x.id}
                    type="button"
                    className={styles.item}
                    data-note-row=""
                    data-unread={x.unread || undefined}
                    onClick={() => {
                      onItemClick?.(x)
                      if (closeOnItemClick) setOpen(false)
                    }}
                  >
                    {x.who != null && <Avatar name={x.who} src={x.src} aria-hidden="true" />}
                    <span className={styles.body}>
                      <span className={styles.text}>
                        {x.who != null && <b>{x.who} </b>}
                        {x.text}
                      </span>
                      {x.time && <small className={styles.time}>{x.time}</small>}
                    </span>
                    <span className={styles.dot} aria-hidden="true" />
                    {x.unread && <span className={styles.srOnly}>, не прочитано</span>}
                  </button>
                )
                if (!onDismiss) return row
                return (
                  <div key={x.id} className={styles.row}>
                    {row}
                    <IconButton
                      size={24}
                      className={styles.dismiss}
                      ariaLabel={dismissLabel}
                      onClick={() => {
                        // Строка уйдёт из списка — фокус переносим на соседнюю,
                        // иначе он падает в начало страницы.
                        const rows = Array.from(popRef.current?.querySelectorAll<HTMLElement>('[data-note-row]') ?? [])
                        const at = rows.findIndex((r) => r.closest(`.${styles.row}`)?.contains(document.activeElement))
                        const next = at >= 0 ? (rows[at + 1] ?? rows[at - 1]) : undefined
                        onDismiss(x)
                        if (at >= 0) (next ?? popRef.current)?.focus()
                      }}
                    >
                      <Icon name="close" size={12} />
                    </IconButton>
                  </div>
                )
              })}
            </div>
            {footer != null && <div className={styles.foot}>{footer}</div>}
          </div>,
          document.body,
        )}
    </>
  )
})
