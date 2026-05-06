import styles from './StatBar.module.css'

export type TrendTone = 'good' | 'flat' | 'bp'

export interface StatItem {
  label: string
  value: number | string
  accent?: boolean
  trend?: { text: string; tone?: TrendTone }
}

export interface StatBarProps {
  items: StatItem[]
}

/**
 * Horizontal statistics bar — used on the hub for overall numbers
 * (employees / articles / projects / best practices). Each cell
 * supports an optional trend label below the value.
 */
export function StatBar({ items }: StatBarProps) {
  return (
    <dl className={styles.bar}>
      {items.map((item) => (
        <div key={item.label} className={styles.cell}>
          <dt className={styles.label}>{item.label}</dt>
          <dd className={`${styles.value}${item.accent ? ` ${styles.accent}` : ''}`}>
            {item.value}
          </dd>
          {item.trend ? (
            <span className={`${styles.trend} ${styles[item.trend.tone ?? 'good']}`}>
              {item.trend.text}
            </span>
          ) : null}
        </div>
      ))}
    </dl>
  )
}
