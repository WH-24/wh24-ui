import { forwardRef, useEffect, useRef, type InputHTMLAttributes, type ReactNode } from 'react'

import { cx } from '../popup/popup.js'

import styles from './Checkbox.module.css'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> {
  /** Подпись справа от флажка. Без неё нужен `aria-label`. */
  children?: ReactNode
  /** «Выбрана часть»: шапка таблицы, группа с неполным выбором. */
  indeterminate?: boolean
  /** Новое значение без разбора события. */
  onCheckedChange?: (checked: boolean) => void
  /** Класс и стиль — на корневой `label`; остальное уходит в `input`. */
  className?: string
}

/**
 * Флажок: настоящий `input type="checkbox"` (форма, клавиатура, читалка —
 * как у нативного), поверх — свой рисунок с галочкой, которая «дорисовывается».
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { children, indeterminate = false, onCheckedChange, onChange, className, style, disabled, ...rest },
  ref,
) {
  const inner = useRef<HTMLInputElement | null>(null)
  // `indeterminate` — свойство, а не атрибут: в разметке его не задать.
  // Сверяем после каждой отрисовки: щелчок сам сбрасывает свойство в браузере,
  // и если хозяин оставил «выбрана часть», читалка услышала бы другое, чем
  // нарисовано.
  useEffect(() => {
    if (inner.current && inner.current.indeterminate !== indeterminate) inner.current.indeterminate = indeterminate
  })

  return (
    <label className={cx(styles.cb, className)} style={style} data-disabled={disabled || undefined}>
      <input
        {...rest}
        ref={(el) => {
          inner.current = el
          if (typeof ref === 'function') ref(el)
          else if (ref) ref.current = el
        }}
        type="checkbox"
        className={styles.input}
        disabled={disabled}
        data-indeterminate={indeterminate || undefined}
        onChange={(e) => {
          // Браузер уже снял «выбрана часть» — возвращаем, пока проп не сменился.
          if (indeterminate) e.target.indeterminate = true
          onChange?.(e)
          onCheckedChange?.(e.target.checked)
        }}
      />
      <span className={styles.box} aria-hidden="true">
        <svg viewBox="0 0 12 12" className={styles.tick}>
          <path d="M2.5 6.2l2.4 2.4 4.6-5" />
        </svg>
        <svg viewBox="0 0 12 12" className={styles.dash}>
          <path d="M3 6h6" />
        </svg>
      </span>
      {children != null && <span className={styles.text}>{children}</span>}
    </label>
  )
})
