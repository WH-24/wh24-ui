import styles from './page.module.css'

/**
 * Лоадер стандарта: спиннер по центру, подпись по желанию. Одна точка для
 * fallback ленивых страниц и ожидания данных. `role=status` — читалка
 * объявит «Загрузка».
 */
export interface LoaderProps {
  label?: string
  /** Поверх контейнера (над iframe до его загрузки). */
  overlay?: boolean
  /** Логотип над спиннером (портал показывает бренд). */
  logoSrc?: string
}

export function Loader({ label, overlay = false, logoSrc }: LoaderProps) {
  return (
    <div
      className={overlay ? `${styles.loader} ${styles.loaderOverlay}` : styles.loader}
      role="status"
      aria-live="polite"
      aria-label={label ?? 'Загрузка'}
    >
      {logoSrc && <img className={styles.loaderLogo} src={logoSrc} alt="" aria-hidden="true" />}
      <div className={styles.spinner} aria-hidden="true" />
      {label && <div className={styles.loaderLabel}>{label}</div>}
    </div>
  )
}
