import { useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { Icon } from '../list/Icon.js'
import { usePresence, useExitAnimation } from './presence.js'
import { useFocusTrap, useScrollLock } from './useFocusTrap.js'

import styles from './overlay.module.css'

/**
 * Боковая панель справа (карточка записи, журнал, настройки) — как
 * `.drawer` портала: подложка, выезд справа, шапка с названием и
 * действиями, прокручиваемое тело. Модальна: ловушка фокуса, Esc и клик по
 * подложке закрывают (это отмена, см. `Modal`). Выезд 240 мс по кривой
 * `--ease-drawer`, уезжает обратно за 180 мс; подложка проявляется вместе с
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
  useExitAnimation(
    exiting,
    [
      { ref: backdropRef, frames: [{ opacity: 1 }, { opacity: 0 }], duration: 180 },
      { ref, frames: [{ transform: 'translateX(0)' }, { transform: 'translateX(100%)' }], duration: 180 },
    ],
    onExited,
  )
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
        <div className={styles.drawerHead}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <div className={styles.drawerActions}>
            {actions}
            {onClose && (
              <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть">
                <Icon name="close" size={16} />
              </button>
            )}
          </div>
        </div>
        <div className={styles.drawerBody}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </>
  )
}
