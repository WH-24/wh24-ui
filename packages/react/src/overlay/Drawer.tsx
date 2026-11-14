import { useId, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

import { DialogBody, DialogFooter, DialogHeader } from './Dialog.js'
import { motionEase, motionMs } from './motion.js'
import { usePresence, useExitAnimation, type ExitLayer } from './presence.js'
import { useFocusTrap, useScrollLock } from './useFocusTrap.js'

import styles from './overlay.module.css'

/**
 * Боковая панель справа (карточка записи, журнал, настройки) — как
 * `.drawer` портала: подложка, выезд справа, шапка с названием и
 * действиями, прокручиваемое тело. Модальна: ловушка фокуса, Esc и клик по
 * подложке закрывают (это отмена, см. `Modal`). Выезд — `--dur-panel` по кривой
 * `--ease-drawer`, обратно — `--dur-panel-exit` по ней же; подложка проявляется вместе с
 * панелью, а не вспыхивает. Страница под панелью не прокручивается.
 */
export interface DrawerProps {
  open: boolean
  onClose?: () => void
  title: ReactNode
  children: ReactNode
  /** Кнопки в шапке справа, перед «Закрыть». */
  actions?: ReactNode
  /** Подвал с кнопками (сохранить/отмена). */
  footer?: ReactNode
  /** Ширина, px (по умолчанию 560; не шире 96vw). */
  width?: number
}

export function Drawer(props: DrawerProps) {
  const { mounted, exiting, finish } = usePresence(props.open)
  if (!mounted) return null
  return createPortal(<DrawerPanel {...props} exiting={exiting} onExited={finish} />, document.body)
}

/** Выход панели: уезжает вправо по той же кривой, что въезжала; подложка — с ней. */
function drawerExitLayers(
  backdropRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
): ExitLayer[] {
  const duration = motionMs('--dur-panel-exit')
  const easing = motionEase('--ease-drawer')
  return [
    { ref: backdropRef, frames: [{ opacity: 1 }, { opacity: 0 }], duration, easing },
    {
      ref: panelRef,
      frames: [{ transform: 'translateX(0)' }, { transform: 'translateX(100%)' }],
      duration,
      easing,
    },
  ]
}

interface PanelProps extends DrawerProps {
  exiting: boolean
  onExited: () => void
}

function DrawerPanel({ onClose, title, children, actions, footer, width = 560, exiting, onExited }: PanelProps) {
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  useFocusTrap({ open: !exiting, containerRef: ref, onEscape: onClose })
  useScrollLock(!exiting)
  useExitAnimation(exiting, exiting ? drawerExitLayers(backdropRef, ref) : [], onExited)
  return (
    <>
      <div
        ref={backdropRef}
        className={styles.drawerBackdrop}
        data-state={exiting ? 'closed' : 'open'}
        onMouseDown={() => onClose?.()}
        aria-hidden="true"
        data-aria-hidden-own="true"
      />
      <div
        ref={ref}
        data-state={exiting ? 'closed' : 'open'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={styles.drawer}
        style={{ width }}
      >
        <DialogHeader
          className={styles.drawerHead}
          title={title}
          titleId={titleId}
          onClose={onClose}
          actions={actions}
        />
        <DialogBody className={styles.drawerBody}>{children}</DialogBody>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </div>
    </>
  )
}
