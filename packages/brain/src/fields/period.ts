import type { GeneratorKind } from './types.js'

const pad = (n: number) => String(n).padStart(2, '0')

/** `ГГГГ-ММ-ДД` по местной дате (как отдаёт `DateField`). */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() + n)
  return x
}

/**
 * Период по умолчанию — тот же, что подставит сервер: итог недели — текущая
 * неделя с понедельника по воскресенье, остальное — последние 7 дней по сегодня.
 */
export function defaultPeriod(kind: GeneratorKind, now: Date = new Date()): { from: string; to: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (kind === 'week_summary') {
    const offset = (today.getDay() + 6) % 7
    const monday = addDays(today, -offset)
    return { from: isoDate(monday), to: isoDate(addDays(monday, 6)) }
  }
  return { from: isoDate(addDays(today, -6)), to: isoDate(today) }
}

/** Дней в периоде включительно; нечитаемая дата — `NaN`. */
export function periodDays(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00`)
  const b = Date.parse(`${to}T00:00:00`)
  return Math.round((b - a) / 86_400_000) + 1
}

/** Максимальный период генератора (сервер: 92 дня). */
export const MAX_PERIOD_DAYS = 92

/** Подпись периода: «02.11.2026 — 08.11.2026». */
export function periodLabel(from: string, to: string): string {
  const f = (v: string) => v.split('-').reverse().join('.')
  return from === to ? f(from) : `${f(from)} — ${f(to)}`
}
