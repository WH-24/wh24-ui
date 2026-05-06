import { ARTICLE_TYPE_LABELS, type ArticleType } from '@wowhaus/ui-tokens'

import styles from './TypeMarker.module.css'

export interface TypeMarkerProps {
  type?: ArticleType
  active?: boolean
}

/**
 * Small dot marker for an article type. Used in type-bars, lists, cards.
 *
 * - Without `type` — neutral grey, generic aria-label
 * - With `type` — color-coded (project/standard/solution/article)
 * - With `active` — terracotta override (used in active tab states)
 */
export function TypeMarker({ type, active = false }: TypeMarkerProps) {
  const label = type ? ARTICLE_TYPE_LABELS[type] : 'Без типа'
  const className = [
    styles.dot,
    type ? styles[type] : '',
    active ? styles.active : '',
  ]
    .filter(Boolean)
    .join(' ')
  return <span className={className} role="img" aria-label={label} />
}
