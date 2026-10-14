import type { CSSProperties, ReactNode } from 'react'

import styles from './form.module.css'

/** Ширина поля в 12-колоночной сетке. Набор сознательно закрытый: тот же,
 *  что принимает бэкенд (`schema.validSpans` — 3/4/6/12). Произвольная
 *  ширина не раскладывается в ряд без остатка и ломает сетку. */
export type FieldSpan = 3 | 4 | 6 | 12

export interface FieldRowProps {
  /** Подпись поля. Без неё ряд рисует только контрол (напр. чекбокс). */
  label?: ReactNode
  /** id контрола — связывает <label> с полем. */
  htmlFor?: string
  /** Звёздочка у подписи. Сам факт обязательности проверяет валидатор. */
  required?: boolean
  /** Подсказка под контролом. Скрывается, когда показана ошибка. */
  hint?: ReactNode
  /** Текст ошибки заполнения. Показывается ВМЕСТО подсказки. */
  error?: ReactNode
  /** Ширина в сетке FieldGrid. По умолчанию 6 (половина ряда). */
  span?: FieldSpan
  className?: string
  style?: CSSProperties
  children: ReactNode
}

/**
 * FieldRow — «подпись · контрол · подсказка/ошибка» одним блоком.
 *
 * Ошибка вытесняет подсказку, а не добавляется к ней: два текста подряд под
 * полем читаются как один и пользователь не понимает, что из этого претензия
 * к введённому значению.
 */
export function FieldRow({
  label,
  htmlFor,
  required,
  hint,
  error,
  span = 6,
  className,
  style,
  children,
}: FieldRowProps) {
  return (
    <div
      className={[styles.row, className].filter(Boolean).join(' ')}
      data-span={span}
      style={style}
    >
      {label != null && (
        <label className={styles.label} htmlFor={htmlFor}>
          {label}
          {required && (
            <span className={styles.req} aria-hidden>
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <div className={styles.error}>{error}</div>
      ) : hint ? (
        <div className={styles.hint}>{hint}</div>
      ) : null}
    </div>
  )
}

export interface FieldGridProps {
  className?: string
  style?: CSSProperties
  children: ReactNode
}

/**
 * FieldGrid — 12-колоночная сетка полей карточки. Прямые дети-`FieldRow`
 * раскладываются по своему `span`; на среднем экране 3 и 4 схлопываются до 6,
 * на узком — всё в одну колонку (настройка администратора формы при этом не
 * меняется, меняется только раскладка).
 */
export function FieldGrid({ className, style, children }: FieldGridProps) {
  return (
    <div className={[styles.grid, className].filter(Boolean).join(' ')} style={style}>
      {children}
    </div>
  )
}

export interface StaticValueProps {
  className?: string
  children: ReactNode
}

/**
 * StaticValue — значение только для чтения в том же ритме, что контрол.
 * Приглушено фоном, а не `opacity` у `:disabled`: экран из десяти read-only
 * полей иначе выглядит сломанным, а не «просто не редактируемым».
 */
export function StaticValue({ className, children }: StaticValueProps) {
  return (
    <div className={[styles.static, className].filter(Boolean).join(' ')}>{children}</div>
  )
}
