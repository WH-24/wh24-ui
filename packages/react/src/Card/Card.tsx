import type { ReactNode } from 'react'

import { BestPracticeBadge } from '../BestPracticeBadge/BestPracticeBadge.js'

import styles from './Card.module.css'

export type CardVariant = 'cover' | 'noCover'

export interface CardProps {
  variant: CardVariant
  bestPractice?: boolean
  cover?: ReactNode
  markerSlot?: ReactNode
  interactive?: boolean
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
  onClick,
  children,
}: CardProps) {
  const className = [
    styles.card,
    bestPractice ? styles.bp : '',
    interactive || onClick ? styles.interactive : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <article className={className} onClick={onClick}>
      {variant === 'cover' && cover ? <div className={styles.cover}>{cover}</div> : null}
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
