import { useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { Icon } from '../list/Icon.js'
import { useFocusTrap } from './useFocusTrap.js'

import styles from './overlay.module.css'

/**
 * Боковая панель справа (карточка записи, журнал, настройки) — как
 * `.drawer` портала: подложка, выезд справа, шапка с названием и
 * действиями, прокручиваемое тело. Модальна: ловушка фокуса, Esc и клик по
 * подложке закрывают (это отмена, см. `Modal`).
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
  if (!props.open) return null
  return createPortal(<DrawerPanel {...props} />, document.body)
}

function DrawerPanel({ onClose, title, children, actions, footer, width = 560 }: DrawerProps) {
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap({ open: true, containerRef: ref, onEscape: onClose })
  return (
    <>
      <div className={styles.drawerBackdrop} onMouseDown={() => onClose?.()} aria-hidden="true" />
      <div
        ref={ref}
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
