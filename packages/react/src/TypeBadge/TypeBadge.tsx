import { ARTICLE_TYPE_LABELS, type ArticleType } from '@wowhaus-24/ui-tokens'

import styles from './TypeBadge.module.css'

export interface TypeBadgeProps {
  type: ArticleType
  label?: string
}

/**
 * Color-coded type badge for an article. Background and foreground are
 * paired per type (project / standard / solution / article).
 *
 * Default label is the Russian display name; override with `label` for
 * custom variants like cards or filter chips.
 */
export function TypeBadge({ type, label }: TypeBadgeProps) {
  return (
    <span className={`${styles.tp} ${styles[type]}`}>
      {label ?? ARTICLE_TYPE_LABELS[type]}
    </span>
  )
}
