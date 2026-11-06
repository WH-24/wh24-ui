import styles from './meta.module.css'

export interface UsageMeterProps {
  /** Израсходовано за сегодня, % от дневного лимита. null/undefined — лимита нет. */
  today?: number | null
  /** Израсходовано за месяц, %. */
  month?: number | null
  /** С какого процента предупреждать. По умолчанию 90. */
  warnAt?: number
  className?: string
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)))
}

function fmt(v: number): string {
  return `${clamp(v)} %`
}

/**
 * «Сегодня 12 % · Месяц 40 %» — сколько квоты ИИ уже потрачено. С 90 % —
 * предупреждение, со 100 % — «Лимит исчерпан» (композер хост блокирует сам
 * через `disabledReason`).
 */
export function UsageMeter({ today, month, warnAt = 90, className }: UsageMeterProps) {
  const parts: { label: string; value: number }[] = []
  if (today != null) parts.push({ label: 'Сегодня', value: today })
  if (month != null) parts.push({ label: 'Месяц', value: month })
  if (parts.length === 0) return null
  const peak = Math.max(...parts.map((p) => p.value))
  const tone = peak >= 100 ? 'bad' : peak >= warnAt ? 'warn' : 'ok'
  const note = tone === 'bad' ? 'Лимит исчерпан' : tone === 'warn' ? 'Лимит почти исчерпан' : null
  return (
    <div
      className={[styles.meter, className].filter(Boolean).join(' ')}
      data-tone={tone}
      role="status"
      aria-label="Расход квоты ИИ"
    >
      {parts.map((p, i) => (
        <span key={p.label} className={styles.part}>
          {i > 0 && <span className={styles.sep}>·</span>}
          <span className={styles.bar} aria-hidden="true">
            <span className={styles.fill} style={{ width: `${clamp(p.value)}%` }} />
          </span>
          <span>
            {p.label} {fmt(p.value)}
          </span>
        </span>
      ))}
      {note && <span className={styles.note}>{note}</span>}
    </div>
  )
}
