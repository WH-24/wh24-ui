import {
  cloneElement,
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type HTMLAttributes,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

import { usePresence, useExitAnimation } from '../overlay/presence.js'
import { chain, cx, hoverUnavailable, useAnchoredPlace, useEscape } from '../popup/popup.js'

import styles from './HoverCard.module.css'

export interface HoverCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'content' | 'children'> {
  /** Содержимое карточки: кто это, должность, отдел, кнопка «Открыть». */
  content: ReactNode
  /** Элемент, на который наводят: имя в таблице, аватар, ссылка. */
  children: ReactElement<HTMLAttributes<HTMLElement>>
  /** Сколько держать курсор до появления, мс. */
  openDelay?: number
  /** Сколько ждать после ухода курсора (успеть дойти до карточки), мс. */
  closeDelay?: number
  disabled?: boolean
  /** Сообщить об открытии и закрытии (например, чтобы подгрузить данные). */
  onOpenChange?: (open: boolean) => void
  /**
   * Открывать и касанием (щелчком): касание по элементу открывает карточку
   * сразу и закрывает её повторно, касание мимо закрывает. Для мест, где
   * подробности нужны и на телефоне. По умолчанию выключено — карточка
   * только для мыши и клавиатуры.
   */
  openOnTap?: boolean
}

/** Выход — на четверть быстрее входа (--dur-base-exit). */
const EXIT_MS = 135

/**
 * «Разогрев»: пока одна карточка открыта или только что закрылась, следующая
 * не ждёт полсекунды — человек уже показал, что читает карточки (ведёт
 * курсором по столбцу имён). Короткая пауза остаётся, чтобы курсор, идущий
 * мимо соседнего имени к открытой карточке, её не перехватил.
 */
const WARM_WINDOW_MS = 300
const WARM_DELAY_MS = 80
let openCards = 0
let lastClosedAt = Number.NEGATIVE_INFINITY
const isWarm = () => {
  if (openCards > 0) return true
  const since = Date.now() - lastClosedAt
  return since >= 0 && since < WARM_WINDOW_MS
}

/**
 * Карточка при наведении: короткая справка о человеке или записи, не уходя
 * со страницы. Появляется через полсекунды, остаётся, пока курсор на
 * элементе или на самой карточке; уход курсора и Esc закрывают. Переход с
 * одного имени на соседнее открывает следующую карточку почти сразу.
 *
 * Это удобство для мыши: на сенсорных экранах карточки нет, поэтому всё, что
 * в ней есть, должно быть достижимо и обычным путём (переходом по ссылке).
 * Исключение — `openOnTap`: тогда касание (и щелчок) открывает карточку сразу,
 * повторное касание или касание мимо закрывает. Элемент-якорь в этом случае
 * должен быть кнопкой — так он доступен с клавиатуры (Enter, пробел).
 */
export const HoverCard = forwardRef<HTMLDivElement, HoverCardProps>(function HoverCard(
  {
    content,
    children,
    openDelay = 500,
    closeDelay = 120,
    disabled = false,
    onOpenChange,
    openOnTap = false,
    className,
    style,
    id: idProp,
    ...rest
  },
  ref,
) {
  const autoId = useId()
  const cardId = idProp ?? autoId
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLElement | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touched = useRef(false)
  const pointerFocus = useRef(false)
  const notify = useRef(onOpenChange)
  notify.current = onOpenChange

  const clear = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  const openRef = useRef(false)
  const set = (next: boolean) => {
    if (openRef.current === next) return
    openRef.current = next
    if (next) openCards += 1
    else {
      openCards = Math.max(0, openCards - 1)
      lastClosedAt = Date.now()
    }
    setOpen(next)
    notify.current?.(next)
  }
  const scheduleOpen = (el: HTMLElement) => {
    if (disabled) return
    anchorRef.current = el
    clear()
    timer.current = setTimeout(() => set(true), isWarm() ? Math.min(openDelay, WARM_DELAY_MS) : openDelay)
  }
  const scheduleClose = () => {
    clear()
    timer.current = setTimeout(() => set(false), closeDelay)
  }
  const closeNow = () => {
    clear()
    set(false)
  }

  useEffect(
    () => () => {
      clear()
      // Убрали со страницы открытой — счётчик открытых не должен «залипнуть».
      if (openRef.current) {
        openRef.current = false
        openCards = Math.max(0, openCards - 1)
      }
    },
    [],
  )
  useEffect(() => {
    if (disabled) closeNow()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled])
  useEscape(open, closeNow)

  // Открыта касанием — касание мимо элемента и карточки закрывает.
  useEffect(() => {
    if (!open || !openOnTap) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null
      if (anchorRef.current?.contains(t) || cardRef.current?.contains(t)) return
      closeNow()
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, openOnTap])

  const { mounted, exiting, finish } = usePresence(open)
  const place = useAnchoredPlace(mounted, () => anchorRef.current, cardRef)
  useExitAnimation(
    exiting,
    [
      {
        ref: cardRef,
        frames: [
          { opacity: 1, transform: 'none' },
          { opacity: 0, transform: 'scale(0.96)' },
        ],
        duration: EXIT_MS,
      },
    ],
    finish,
  )

  const p = children.props
  const trigger = cloneElement(children, {
    onMouseEnter: chain(p.onMouseEnter, (e: MouseEvent<HTMLElement>) => {
      if (touched.current || hoverUnavailable()) return
      if (open) clear()
      else scheduleOpen(e.currentTarget)
    }),
    onMouseLeave: chain(p.onMouseLeave, () => {
      touched.current = false
      if (open) scheduleClose()
      else clear()
    }),
    onTouchStart: chain(p.onTouchStart, () => {
      touched.current = true
      // Касанием карточка открывается щелчком ниже — здесь её не трогаем.
      if (!openOnTap) closeNow()
    }),
    ...(openOnTap
      ? {
          'aria-expanded': open,
          'aria-controls': open ? cardId : undefined,
          onClick: chain(p.onClick, (e: MouseEvent<HTMLElement>) => {
            if (disabled) return
            anchorRef.current = e.currentTarget
            if (openRef.current) closeNow()
            else {
              clear()
              set(true)
            }
          }),
        }
      : null),
    onPointerDown: chain(p.onPointerDown, () => {
      pointerFocus.current = true
    }),
    onFocus: chain(p.onFocus, (e: FocusEvent<HTMLElement>) => {
      if (pointerFocus.current || touched.current) return
      scheduleOpen(e.currentTarget)
    }),
    onBlur: chain(p.onBlur, (e: FocusEvent<HTMLElement>) => {
      pointerFocus.current = false
      // Фокус ушёл в саму карточку (кнопка «Открыть») — не закрываем.
      if (cardRef.current?.contains(e.relatedTarget as Node | null)) return
      if (open) scheduleClose()
      else clear()
    }),
  })

  return (
    <>
      {trigger}
      {mounted &&
        createPortal(
          <div
            {...rest}
            id={openOnTap ? cardId : idProp}
            ref={(el) => {
              cardRef.current = el
              if (typeof ref === 'function') ref(el)
              else if (ref) ref.current = el
            }}
            className={cx(styles.hc, className)}
            data-flipped={place?.flipped || undefined}
            style={{
              ...style,
              top: place?.top ?? 0,
              left: place?.left ?? 0,
              visibility: place ? undefined : 'hidden',
            }}
            onMouseEnter={clear}
            onMouseLeave={scheduleClose}
            onBlur={(e) => {
              const to = e.relatedTarget as Node | null
              if (cardRef.current?.contains(to) || anchorRef.current?.contains(to)) return
              scheduleClose()
            }}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  )
})
