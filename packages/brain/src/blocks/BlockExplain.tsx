/*
 * «Что посчитано» под графиком: из какого набора, какие показатели и по какой
 * формуле, за какой период, с какими фильтрами и сколько строк. Это объяснение
 * цифры для человека, который не видел запроса (владелец, 06.11.2026: HR должен
 * понимать, откуда взялось число, без программиста). Свёрнуто по умолчанию —
 * график важнее. Чистый HTML без Perspective: подходит любому хосту.
 */
import { Fragment, type ReactNode } from 'react'

import type { RunBlockExplain, RunBlockFilter } from '../types.js'
import styles from './blocks.module.css'

export interface BlockExplainProps {
  explain: RunBlockExplain
  /** Подпись сворачиваемого блока. */
  label?: string
  /** Раскрыть сразу; по умолчанию свёрнут. */
  open?: boolean
  className?: string
}

const GRANULARITY: Record<string, string> = {
  day: 'день',
  week: 'неделя',
  month: 'месяц',
  quarter: 'квартал',
  year: 'год',
}

/** `2026-01-31` или `2026-01-31T00:00:00Z` → `31.01.2026`; остальное — как есть. */
export function formatBlockDate(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : s
}

function scalar(v: unknown): string {
  if (v == null) return 'пусто'
  if (typeof v === 'boolean') return v ? 'да' : 'нет'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'string') return formatBlockDate(v)
  return JSON.stringify(v)
}

function one(f: RunBlockFilter): unknown {
  return f.value !== undefined ? f.value : f.values?.[0]
}

function many(f: RunBlockFilter): string {
  const vals = f.values ?? (f.value === undefined ? [] : [f.value])
  return vals.map(scalar).join(', ')
}

/** Фильтр текстом: «Отдел = АР», «Стаж от 3 до 12», «Отдел — один из: АР, КР». */
export function formatBlockFilter(f: RunBlockFilter): string {
  const c = f.column
  switch (f.op) {
    case 'eq':
      return `${c} = ${scalar(one(f))}`
    case 'ne':
      return `${c} ≠ ${scalar(one(f))}`
    case 'gt':
      return `${c} > ${scalar(one(f))}`
    case 'gte':
      return `${c} ≥ ${scalar(one(f))}`
    case 'lt':
      return `${c} < ${scalar(one(f))}`
    case 'lte':
      return `${c} ≤ ${scalar(one(f))}`
    case 'in':
      return `${c} — один из: ${many(f)}`
    case 'not_in':
      return `${c} — не из: ${many(f)}`
    case 'contains':
      return `${c} содержит «${scalar(one(f))}»`
    case 'between': {
      const [a, b] = f.values ?? []
      return `${c} от ${scalar(a)} до ${scalar(b)}`
    }
    case 'is_null':
      return `${c} пусто`
    case 'not_null':
      return `${c} заполнено`
    default:
      return `${c} ${f.op} ${many(f)}`.trim()
  }
}

export function BlockExplain({ explain, label = 'Что посчитано', open, className }: BlockExplainProps) {
  const rows: { dt: string; dd: ReactNode }[] = []

  const dataset = explain.dataset_title || explain.dataset
  if (dataset) rows.push({ dt: 'Набор', dd: dataset })

  const metrics = explain.metrics ?? []
  if (metrics.length > 0) {
    rows.push({
      dt: metrics.length > 1 ? 'Показатели' : 'Показатель',
      dd: (
        <ul className={styles.metrics}>
          {metrics.map((m, i) => (
            <li key={`${i}-${m.key}`}>
              {m.title || m.key}
              {m.formula && <span className={styles.formula}> = {m.formula}</span>}
            </li>
          ))}
        </ul>
      ),
    })
  }

  const from = explain.period?.from
  const to = explain.period?.to
  if (from || to) {
    const text = [from && `с ${formatBlockDate(from)}`, to && `по ${formatBlockDate(to)}`]
      .filter(Boolean)
      .join(' ')
    rows.push({
      dt: 'Период',
      dd: (
        <>
          {text}
          {explain.period_defaulted && <span className={styles.hint}> · по умолчанию</span>}
        </>
      ),
    })
  }

  if (explain.granularity) {
    rows.push({ dt: 'Разрез времени', dd: GRANULARITY[explain.granularity] ?? explain.granularity })
  }

  const filters = explain.filters ?? []
  if (filters.length > 0) rows.push({ dt: 'Фильтры', dd: filters.map(formatBlockFilter).join('; ') })

  if (typeof explain.row_count === 'number') {
    let text = explain.row_count.toLocaleString('ru-RU')
    if (explain.truncated) {
      text +=
        typeof explain.source_rows === 'number' ? ` из ${explain.source_rows.toLocaleString('ru-RU')}` : ' (не все)'
    }
    rows.push({ dt: 'Строк', dd: text })
  }

  if (explain.computed_at) {
    const d = new Date(explain.computed_at)
    rows.push({ dt: 'Посчитано', dd: Number.isNaN(d.getTime()) ? explain.computed_at : d.toLocaleString('ru-RU') })
  }

  if (rows.length === 0 && !explain.sql) return null

  return (
    <details className={[styles.explain, className].filter(Boolean).join(' ')} open={open}>
      <summary className={styles.summary}>{label}</summary>
      {rows.length > 0 && (
        <dl className={styles.facts}>
          {rows.map((r) => (
            <Fragment key={r.dt}>
              <dt>{r.dt}</dt>
              <dd>{r.dd}</dd>
            </Fragment>
          ))}
        </dl>
      )}
      {explain.sql && (
        <pre className={styles.sql}>
          <code>{explain.sql}</code>
        </pre>
      )}
    </details>
  )
}
