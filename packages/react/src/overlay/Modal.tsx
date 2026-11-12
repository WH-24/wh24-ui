import { useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { Icon } from '../list/Icon.js'
import { usePresence, useExitAnimation } from './presence.js'
import { useFocusTrap, useScrollLock } from './useFocusTrap.js'

import styles from './overlay.module.css'

/**
 * Модальное окно стандарта: шапка с названием и «Закрыть», тело,
 * необязательный подвал с кнопками. Вид — `.modal-*` портала; поведение —
 * ловушка фокуса со стеком окон (Esc и Tab обрабатывает только верхнее
 * окно), возврат фокуса на кнопку-инициатор, страница под окном не
 * прокручивается. Появление — 190 мс (подложка гаснет в, карточка из 0.97),
 * выход — 140 мс; при «уменьшить движение» — только затухание.
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
  const { mounted, exiting, finish } = usePresence(props.open)
  if (!mounted) return null
  return createPortal(<ModalCard {...props} exiting={exiting} onExited={finish} />, document.body)
}

interface CardProps extends ModalProps {
  exiting: boolean
  onExited: () => void
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
  exiting,
  onExited,
}: CardProps) {
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  useFocusTrap({ open: !exiting, containerRef: ref, onEscape: onClose })
  useScrollLock(!exiting)
  useExitAnimation(
    exiting,
    [
      { ref: backdropRef, frames: [{ opacity: 1 }, { opacity: 0 }], duration: 140 },
      {
        ref,
        frames: [
          { opacity: 1, transform: 'scale(1)' },
          { opacity: 0, transform: 'scale(0.97)' },
        ],
        duration: 140,
      },
    ],
    onExited,
  )
  return (
    <div
      ref={backdropRef}
      className={styles.backdrop}
      data-state={exiting ? 'closed' : 'open'}
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
