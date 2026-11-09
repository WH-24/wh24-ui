import { useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { Icon } from '../list/Icon.js'
import { useFocusTrap } from './useFocusTrap.js'

import styles from './overlay.module.css'

/**
 * Модальное окно стандарта: шапка с названием и «Закрыть», тело,
 * необязательный подвал с кнопками. Вид — `.modal-*` портала; поведение —
 * ловушка фокуса со стеком окон (Esc и Tab обрабатывает только верхнее
 * окно), возврат фокуса на кнопку-инициатор.
 *
 * ⚠️ `onClose` — это отмена: Esc, «Закрыть» и клик мимо карточки. Не
 * подключайте сюда разрушительные действия. Без `onClose` окно этими
 * путями не закрывается (идёт запрос — отменять нечего).
 */
export interface ModalProps {
  open: boolean
  onClose?: () => void
  title: ReactNode
  children: ReactNode
  /** Кнопки внизу справа: основная последней. */
  footer?: ReactNode
  /** Ширина карточки, px (по умолчанию 480). */
  maxWidth?: number
  /** `alertdialog` — окно, требующее решения прямо сейчас. */
  role?: 'dialog' | 'alertdialog'
  /** Клик мимо карточки закрывает окно (по умолчанию да). */
  closeOnBackdrop?: boolean
  /** Свой класс тела (отступы, сетка). */
  bodyClassName?: string
}

export function Modal(props: ModalProps) {
  if (!props.open) return null
  return createPortal(<ModalCard {...props} />, document.body)
}

function ModalCard({
  onClose,
  title,
  children,
  footer,
  maxWidth = 480,
  role = 'dialog',
  closeOnBackdrop = true,
  bodyClassName,
}: ModalProps) {
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap({ open: true, containerRef: ref, onEscape: onClose })
  return (
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose?.()
      }}
    >
      <div
        ref={ref}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        className={styles.card}
        style={{ maxWidth }}
      >
        <div className={styles.head}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {onClose && (
            <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть">
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
        <div className={bodyClassName ? `${styles.body} ${bodyClassName}` : styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  )
}
