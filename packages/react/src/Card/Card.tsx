import type { CSSProperties, ReactNode } from 'react'

import { BestPracticeBadge } from '../BestPracticeBadge/BestPracticeBadge.js'

import styles from './Card.module.css'

export type CardVariant = 'cover' | 'noCover'

export interface CardProps {
  variant: CardVariant
  bestPractice?: boolean
  cover?: ReactNode
  markerSlot?: ReactNode
  interactive?: boolean
  /**
   * Высота обложки (`variant="cover"`): число — пиксели, строка — любая CSS-длина.
   * По умолчанию 84px. Задают там, где карточка прежде всего картинка.
   */
  coverHeight?: number | string
  children: ReactNode
  onClick?: () => void
}

/**
 * Material card — used in browser grid, hub feed, search result
 * tiles. Two variants:
 * - `cover` — image-cover above body (project, solution)
 * - `noCover` — text-only (standard, article)
 *
 * `bestPractice` adds terra accent border + BP badge in top-right.
 * `markerSlot` is for absolute-positioned overlays (top-left).
 */
export function Card({
  variant,
  bestPractice = false,
  cover,
  markerSlot,
  interactive = false,
  coverHeight,
  onClick,
  children,
}: CardProps) {
  const coverStyle =
    coverHeight === undefined
      ? undefined
      : ({
          '--card-cover-h': typeof coverHeight === 'number' ? `${coverHeight}px` : coverHeight,
        } as CSSProperties)
  const className = [
    styles.card,
    bestPractice ? styles.bp : '',
    interactive || onClick ? styles.interactive : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <article className={className} onClick={onClick}>
      {variant === 'cover' && cover ? (
        <div className={styles.cover} style={coverStyle}>
          {cover}
        </div>
      ) : null}
      {markerSlot ? <div className={styles.markerSlot}>{markerSlot}</div> : null}
      {bestPractice ? (
        <div className={styles.bpSlot}>
          <BestPracticeBadge />
        </div>
      ) : null}
      <div
        className={`${styles.body}${variant === 'noCover' ? ` ${styles.noCover}` : ''}`}
      >
        {children}
      </div>
    </article>
  )
}
