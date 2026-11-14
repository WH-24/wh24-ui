import { forwardRef, useId, type ButtonHTMLAttributes, type ReactNode } from 'react'

import { cx } from '../popup/popup.js'

import styles from './Switch.module.css'

export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'role' | 'type'> {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Видимая подпись справа; щелчок по ней тоже переключает. */
  children?: ReactNode
  /** Подпись для читалки, когда видимой нет. */
  ariaLabel?: string
  disabled?: boolean
}

/**
 * Переключатель «включено / выключено»: настройка, которая действует сразу,
 * без «Сохранить». Для выбора в форме — `Checkbox`.
 */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { checked, onChange, children, ariaLabel, disabled, className, id, onClick, ...rest },
  ref,
) {
  const auto = useId()
  const btnId = id ?? `sw-${auto}`
  const labelId = `${btnId}-label`
  const button = (
    <button
      {...rest}
      ref={ref}
      id={btnId}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-labelledby={children != null && !ariaLabel ? labelId : rest['aria-labelledby']}
      disabled={disabled}
      className={cx(styles.sw, children == null && className)}
      onClick={(e) => {
        onClick?.(e)
        if (!e.defaultPrevented) onChange(!checked)
      }}
    >
      <span className={styles.thumb} aria-hidden="true" />
    </button>
  )
  if (children == null) return button
  return (
    <span className={cx(styles.row, className)} data-disabled={disabled || undefined}>
      {button}
      <label id={labelId} htmlFor={btnId} className={styles.label}>
        {children}
      </label>
    </span>
  )
})
