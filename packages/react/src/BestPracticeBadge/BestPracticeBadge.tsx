import styles from './BestPracticeBadge.module.css'

export interface BestPracticeBadgeProps {
  label?: string
}

/**
 * Terra-tinted badge with white diamond — marks Best Practice materials.
 *
 * Default label "Best practice"; override for variants like
 * "Best practice · 5 эталонов".
 */
export function BestPracticeBadge({ label = 'Best practice' }: BestPracticeBadgeProps) {
  return (
    <span className={styles.badge}>
      <span className={styles.diamond} aria-hidden="true" />
      {label}
    </span>
  )
}
