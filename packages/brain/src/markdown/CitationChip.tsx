import styles from './markdown.module.css'

export interface CitationChipProps {
  n: number
  /** Заголовок источника — подсказка при наведении и для скринридера. */
  title?: string
  active?: boolean
  onClick?: (n: number) => void
}

/** Номер источника в тексте ответа: `[2]` → маленький чип «2». */
export function CitationChip({ n, title, active, onClick }: CitationChipProps) {
  const label = title ? `Источник ${n}: ${title}` : `Источник ${n}`
  if (!onClick) {
    return (
      <span className={styles.cite} data-active={active || undefined} title={title} aria-label={label}>
        {n}
      </span>
    )
  }
  return (
    <button
      type="button"
      className={styles.cite}
      data-active={active || undefined}
      title={title}
      aria-label={label}
      onClick={() => onClick(n)}
    >
      {n}
    </button>
  )
}
