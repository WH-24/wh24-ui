import styles from './Avatar.module.css'

export interface AvatarProps {
  initials: string
  ariaLabel?: string
  onClick?: () => void
}

/**
 * Round 32×32 avatar showing two-letter initials. Acts as a button
 * — typically opens profile menu.
 */
export function Avatar({ initials, ariaLabel, onClick }: AvatarProps) {
  return (
    <button
      type="button"
      className={styles.av}
      aria-label={ariaLabel ?? `Профиль ${initials}`}
      onClick={onClick}
    >
      {initials}
    </button>
  )
}
