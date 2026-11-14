import { useEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { Modal } from '@wowhaus-24/ui-react'

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

const WIDTH = { sm: 420, md: 560, lg: 760 } as const

/**
 * Модальное окно для полей ИИ и генераторов — общий `Modal` из ui-react: тот
 * же вид, ловушка фокуса со стеком окон, возврат фокуса на кнопку, открывшую
 * окно, вход и выход по правилам движения. Своё здесь: размеры `sm/md/lg`,
 * `busy` (идёт запрос — окно не закрыть), куда встаёт фокус при открытии, и
 * Esc, который не доходит до хоста (у портала на Esc закрывается панель
 * «Спросить ИИ»).
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
  const content = useRef<HTMLDivElement>(null)

  // Фокус при открытии: заданный элемент → [data-autofocus] → первое поле →
  // первая кнопка тела. Ловушка `Modal` к этому моменту уже поставила фокус
  // на само окно; переносим его один раз, а не при каждом рендере.
  useEffect(() => {
    if (!open) return
    const panel = content.current?.closest<HTMLElement>('[role="dialog"]')
    const target =
      initialFocus?.current ??
      panel?.querySelector<HTMLElement>('[data-autofocus]') ??
      content.current?.querySelector<HTMLElement>('input:not([disabled]), textarea:not([disabled])') ??
      content.current?.querySelector<HTMLElement>('button:not([disabled])')
    target?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Escape') return
    // Esc, закрывающий выпадающий список внутри окна (общие Combobox/MultiCombobox
    // держат `aria-expanded` на поле ввода), окно не закрывает — только список.
    if (e.defaultPrevented) return
    if ((e.target as HTMLElement).getAttribute?.('aria-expanded') === 'true') return
    e.preventDefault()
    e.stopPropagation()
    if (!busy) onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={footer}
      maxWidth={WIDTH[size]}
      busy={busy}
      className={className}
      onKeyDown={onKeyDown}
    >
      <div ref={content} className={styles.body}>
        {children}
      </div>
    </Modal>
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
