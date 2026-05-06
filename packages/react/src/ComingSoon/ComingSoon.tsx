import styles from './ComingSoon.module.css'

export interface ComingSoonProps {
  surface: string
  note?: string
}

/**
 * Placeholder block for surfaces under construction.
 *
 * Used to mark routes that exist but aren't implemented yet.
 */
export function ComingSoon({ surface, note }: ComingSoonProps) {
  return (
    <div className={styles.root}>
      <div className={styles.title}>Скоро будет</div>
      <div className={styles.surface}>{surface}</div>
      {note ? <p className={styles.note}>{note}</p> : null}
    </div>
  )
}
