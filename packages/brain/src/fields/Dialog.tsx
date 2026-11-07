import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '@wowhaus-24/ui-react'

import styles from './dialog.module.css'

export interface BrainDialogProps {
  open: boolean
  onClose: () => void
  title: string
  /** Пояснение под заголовком (читается скринридером как описание окна). */
  description?: ReactNode
  children: ReactNode
  /** Кнопки внизу; остаются на виду при прокрутке содержимого. */
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Идёт сохранение/запрос: Esc, крестик и клик по фону не закрывают окно. */
  busy?: boolean
  /** Куда поставить фокус при открытии; по умолчанию — первое поле или кнопка внутри. */
  initialFocus?: RefObject<HTMLElement | null>
  className?: string
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Модальное окно для полей ИИ и генераторов: `role="dialog"` + `aria-modal`,
 * фокус заперт внутри и возвращается на кнопку, открывшую окно, Esc закрывает
 * (и не доходит до хоста — у портала на Esc закрывается панель «Спросить ИИ»),
 * фон страницы не прокручивается. На телефоне — «шторка» на всю ширину.
 *
 * Меню общих `Combobox`/`MultiCombobox` рисуются порталом в `<body>` с z-index
 * выше окна, поэтому поверх него открываются без обходных путей.
 */
export function BrainDialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  busy,
  initialFocus,
  className,
}: BrainDialogProps) {
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const target =
      initialFocus?.current ??
      panel.current?.querySelector<HTMLElement>('[data-autofocus]') ??
      panel.current?.querySelector<HTMLElement>(`.${styles.body} input:not([disabled]), .${styles.body} textarea:not([disabled])`) ??
      panel.current?.querySelector<HTMLElement>(`.${styles.body} button:not([disabled])`) ??
      panel.current
    target?.focus()
    return () => {
      document.body.style.overflow = prevOverflow
      if (opener && document.contains(opener)) opener.focus()
    }
    // Фокус ставим один раз при открытии, а не при каждом рендере.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open || typeof document === 'undefined') return null

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      // Esc, закрывающий выпадающий список внутри окна (общие Combobox/MultiCombobox
      // держат `aria-expanded` на поле ввода), окно не закрывает — только список.
      if (e.defaultPrevented) return
      if ((e.target as HTMLElement).getAttribute?.('aria-expanded') === 'true') return
      e.preventDefault()
      e.stopPropagation()
      if (!busy) onClose()
      return
    }
    if (e.key !== 'Tab') return
    const items = Array.from(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    )
    if (items.length === 0) {
      e.preventDefault()
      panel.current?.focus()
      return
    }
    const first = items[0]!
    const last = items[items.length - 1]!
    const active = document.activeElement
    if (e.shiftKey && (active === first || active === panel.current)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        ref={panel}
        className={[styles.panel, className].filter(Boolean).join(' ')}
        data-size={size}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <header className={styles.head}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button type="button" className={styles.close} aria-label="Закрыть" disabled={busy} onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </header>
        {description && (
          <p id={descId} className={styles.desc}>
            {description}
          </p>
        )}
        <div className={styles.body}>{children}</div>
        {footer && <footer className={styles.foot}>{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}

export interface BrainConfirmProps {
  open: boolean
  title: string
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Опасное действие: красная кнопка, фокус — на «Отмена». */
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Подтверждение внутри пакета (хост может подставить своё — см. `confirm` у `useAiFieldColumns`). */
export function BrainConfirm({
  open,
  title,
  message,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  danger,
  busy,
  onConfirm,
  onCancel,
}: BrainConfirmProps) {
  const cancel = useRef<HTMLButtonElement>(null)
  return (
    <BrainDialog
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      busy={busy}
      initialFocus={danger ? cancel : undefined}
      footer={
        <>
          <button ref={cancel} type="button" className="btn btn-secondary" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'btn btn-danger' : 'btn btn-primary'}
            disabled={busy}
            data-autofocus={danger ? undefined : ''}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {message && <p className={styles.confirmText}>{message}</p>}
    </BrainDialog>
  )
}
