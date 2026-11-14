import { forwardRef, type InputHTMLAttributes } from 'react'

import styles from './form.module.css'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Значение не прошло проверку — красная рамка + aria-invalid. */
  invalid?: boolean
  /**
   * `ghost` — поле без рамки, пока на него не навели и не встали (правка на
   * месте в панели свойств): выглядит текстом, работает полем.
   */
  variant?: 'default' | 'ghost'
}

/**
 * Input — однострочное поле ввода в стиле дизайн-системы.
 *
 * `invalid` ставит и визуальную рамку, и `aria-invalid`: подсветка без
 * атрибута оставляет скринридер в неведении, атрибут без подсветки —
 * зрячего пользователя.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, variant, className, ...rest },
  ref,
) {
  return (
    <input
      {...rest}
      ref={ref}
      className={[styles.control, className].filter(Boolean).join(' ')}
      aria-invalid={invalid || undefined}
      data-variant={variant === 'ghost' ? 'ghost' : undefined}
    />
  )
})
