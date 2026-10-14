import { forwardRef, type TextareaHTMLAttributes } from 'react'

import styles from './form.module.css'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Значение не прошло проверку — красная рамка + aria-invalid. */
  invalid?: boolean
}

/**
 * Textarea — многострочное поле. Отдельный компонент, а не `Input`
 * с флагом: базовый контрол задан фиксированной высотой и нулевым
 * вертикальным отступом, для многострочного текста нужно и то и другое.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, rows = 3, ...rest },
  ref,
) {
  return (
    <textarea
      {...rest}
      ref={ref}
      rows={rows}
      className={[styles.control, styles.textarea, className].filter(Boolean).join(' ')}
      aria-invalid={invalid || undefined}
    />
  )
})
