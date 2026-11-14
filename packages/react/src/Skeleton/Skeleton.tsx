import { forwardRef, type CSSProperties, type HTMLAttributes } from 'react'

import { cx } from '../popup/popup.js'

import styles from './Skeleton.module.css'

export interface SkeletonProps extends HTMLAttributes<HTMLSpanElement> {
  /** Ширина: число — пиксели, строка — как есть («60%»). По умолчанию 100%. */
  width?: number | string
  /** Высота полосы. По умолчанию 10px. */
  height?: number | string
  /** Круг (место аватара); диаметр — `width`. */
  circle?: boolean
}

const dim = (v: number | string | undefined) => (typeof v === 'number' ? `${v}px` : v)

/**
 * Заготовка на месте содержимого, пока оно грузится: полоса или круг с
 * переливом. Читалке не видна — о загрузке говорит контейнер (`aria-busy`,
 * `Loader`). При «уменьшить движение» перелив выключен.
 */
export const Skeleton = forwardRef<HTMLSpanElement, SkeletonProps>(function Skeleton(
  { width, height, circle = false, className, style, ...rest },
  ref,
) {
  const size: CSSProperties = circle
    ? { width: dim(width ?? 32), height: dim(height ?? width ?? 32) }
    : { width: dim(width), height: dim(height) }
  return (
    <span
      aria-hidden="true"
      {...rest}
      ref={ref}
      className={cx(styles.sk, circle && styles.circle, className)}
      style={{ ...size, ...style }}
    />
  )
})

export interface SkeletonTextProps extends HTMLAttributes<HTMLSpanElement> {
  /** Сколько строк. Последняя короче — как абзац. */
  lines?: number
}

/** Несколько строк текста. */
export const SkeletonText = forwardRef<HTMLSpanElement, SkeletonTextProps>(function SkeletonText(
  { lines = 3, className, ...rest },
  ref,
) {
  const n = Math.max(1, Math.floor(lines))
  return (
    <span aria-hidden="true" {...rest} ref={ref} className={cx(styles.text, className)}>
      {Array.from({ length: n }, (_, i) => (
        <Skeleton key={i} width={n > 1 && i === n - 1 ? '60%' : '100%'} />
      ))}
    </span>
  )
})

export interface SkeletonRowProps extends HTMLAttributes<HTMLSpanElement> {
  /** Круг слева — строка списка людей. */
  avatar?: boolean
}

/** Строка списка: необязательный круг и две полосы. */
export const SkeletonRow = forwardRef<HTMLSpanElement, SkeletonRowProps>(function SkeletonRow(
  { avatar = true, className, ...rest },
  ref,
) {
  return (
    <span aria-hidden="true" {...rest} ref={ref} className={cx(styles.row, className)}>
      {avatar && <Skeleton circle width={32} />}
      <span className={styles.rowLines}>
        <Skeleton width="45%" />
        <Skeleton width="70%" height={8} />
      </span>
    </span>
  )
})
