import type { RunStep } from '../types.js'
import styles from './agent.module.css'

export interface AgentStepsProps {
  steps: RunStep[]
  label?: string
}

/**
 * Шаги агента под ответом: какие данные портала он смотрел («Поиск лидов ·
 * Карточка лида»). Повторы одного инструмента схлопываются в «×2».
 */
export function AgentSteps({ steps, label = 'Что смотрел ассистент' }: AgentStepsProps) {
  if (steps.length === 0) return null
  const grouped: { title: string; count: number; ok: boolean }[] = []
  for (const s of steps) {
    const last = grouped[grouped.length - 1]
    if (last && last.title === s.title) {
      last.count++
      last.ok = last.ok && s.ok
    } else {
      grouped.push({ title: s.title, count: 1, ok: s.ok })
    }
  }
  return (
    <div className={styles.steps} aria-label={label}>
      {grouped.map((g, i) => (
        <span key={i} className={styles.step} data-bad={!g.ok || undefined}>
          {g.title}
          {g.count > 1 ? ` ×${g.count}` : ''}
          {g.ok ? '' : ' — не удалось'}
        </span>
      ))}
    </div>
  )
}
