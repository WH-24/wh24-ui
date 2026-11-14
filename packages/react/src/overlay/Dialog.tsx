import type { HTMLAttributes, ReactNode } from 'react'

import { IconButton } from '../IconButton/IconButton.js'
import { Icon } from '../list/Icon.js'
import { cx } from '../popup/popup.js'

import styles from './overlay.module.css'

/**
 * Части окна — шапка, тело, подвал, «Закрыть». Из них собраны `Modal`,
 * `Drawer` и карточка подтверждения: один вид и одна разметка на все окна.
 * Свои окна модулей собирают из `Modal`/`Drawer`; части нужны, когда каркас
 * (подложка, ловушка фокуса) уже есть свой.
 */
export interface DialogCloseProps {
  onClick: () => void
  /** Идёт запрос — закрыть нельзя. */
  disabled?: boolean
  label?: string
}

export function DialogClose({ onClick, disabled, label = 'Закрыть' }: DialogCloseProps) {
  return (
    <IconButton ariaLabel={label} onClick={onClick} disabled={disabled}>
      <Icon name="close" size={16} />
    </IconButton>
  )
}

export interface DialogHeaderProps {
  title: ReactNode
  /** id заголовка — для `aria-labelledby` окна. */
  titleId?: string
  /** Есть — справа рисуется «Закрыть». */
  onClose?: () => void
  closeDisabled?: boolean
  /** Кнопки в шапке справа, перед «Закрыть». */
  actions?: ReactNode
  className?: string
}

export function DialogHeader({ title, titleId, onClose, closeDisabled, actions, className }: DialogHeaderProps) {
  return (
    <div className={cx(styles.head, className)}>
      <h2 id={titleId} className={styles.title}>
        {title}
      </h2>
      {(actions || onClose) && (
        <div className={styles.headActions}>
          {actions}
          {onClose && <DialogClose onClick={onClose} disabled={closeDisabled} />}
        </div>
      )}
    </div>
  )
}

export function DialogBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cx(styles.body, className)} />
}

export function DialogFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cx(styles.footer, className)} />
}
