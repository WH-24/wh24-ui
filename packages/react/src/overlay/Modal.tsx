import { useId, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

import { cx } from '../popup/popup.js'
import { DialogBody, DialogFooter, DialogHeader } from './Dialog.js'
import { motionMs, motionScale } from './motion.js'
import { usePresence, useExitAnimation, type ExitLayer } from './presence.js'
import { useFocusTrap, useScrollLock } from './useFocusTrap.js'

import styles from './overlay.module.css'

/**
 * Модальное окно стандарта: шапка с названием и «Закрыть», тело,
 * необязательный подвал с кнопками. Вид — `.modal-*` портала; поведение —
 * ловушка фокуса со стеком окон (Esc и Tab обрабатывает только верхнее
 * окно), возврат фокуса на кнопку-инициатор, страница под окном не
 * прокручивается. Появление — `--dur-slow` (подложка проявляется, карточка из
 * `--modal-scale`), выход — `--dur-slow-exit`; при «уменьшить движение» — только затухание.
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
  /** Свой класс карточки окна. */
  className?: string
  /** Пояснение под заголовком; читалка объявит его как описание окна. */
  description?: ReactNode
  /**
   * Идёт запрос: Esc, «Закрыть» и клик мимо окно не закрывают, крестик
   * недоступен (но остаётся на месте — окно не «прыгает»).
   */
  busy?: boolean
  /** Клавиши внутри окна — раньше общих обработчиков страницы. */
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void
}

export function Modal(props: ModalProps) {
  const { mounted, exiting, finish } = usePresence(props.open)
  if (!mounted) return null
  return createPortal(<ModalCard {...props} exiting={exiting} onExited={finish} />, document.body)
}

/** Выход окна по центру (Modal, Confirm): подложка гаснет, карточка сжимается. */
export function modalExitLayers(
  backdropRef: RefObject<HTMLElement | null>,
  cardRef: RefObject<HTMLElement | null>,
): ExitLayer[] {
  const duration = motionMs('--dur-slow-exit')
  return [
    { ref: backdropRef, frames: [{ opacity: 1 }, { opacity: 0 }], duration },
    {
      ref: cardRef,
      frames: [
        { opacity: 1, transform: 'scale(1)' },
        { opacity: 0, transform: `scale(${motionScale('--modal-scale')})` },
      ],
      duration,
    },
  ]
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
  className,
  description,
  busy,
  onKeyDown,
  exiting,
  onExited,
}: CardProps) {
  const titleId = useId()
  const descId = useId()
  const ref = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const cancel = busy ? undefined : onClose
  useFocusTrap({ open: !exiting, containerRef: ref, onEscape: cancel })
  useScrollLock(!exiting)
  useExitAnimation(exiting, exiting ? modalExitLayers(backdropRef, ref) : [], onExited)
  return (
    <div
      ref={backdropRef}
      className={styles.backdrop}
      data-state={exiting ? 'closed' : 'open'}
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) cancel?.()
      }}
    >
      <div
        ref={ref}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={cx(styles.card, className)}
        style={{ maxWidth }}
        onKeyDown={onKeyDown}
      >
        <DialogHeader title={title} titleId={titleId} onClose={onClose} closeDisabled={busy} />
        {description && (
          <p id={descId} className={styles.desc}>
            {description}
          </p>
        )}
        <DialogBody className={bodyClassName}>{children}</DialogBody>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </div>
    </div>
  )
}
