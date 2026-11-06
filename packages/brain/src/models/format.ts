import type { EmbeddingCoverage, EmbeddingProvider, EmbeddingsState } from './types.js'

export const PROVIDER_LABEL: Record<EmbeddingProvider, { title: string; hint: string }> = {
  local: { title: 'Локальная модель', hint: 'считается в контуре компании, бесплатно' },
  relay: { title: 'OpenAI через релей', hint: 'точнее на сложных запросах, платно' },
}

/** Сколько процентов фрагментов уже имеют вектор этой модели (целое, 0–100). */
export function coveragePercent(c: Pick<EmbeddingCoverage, 'embedded' | 'total'> | undefined): number {
  if (!c || c.total <= 0) return 0
  return Math.min(100, Math.floor((c.embedded * 100) / c.total))
}

/** Покрытие модели из ответа сервера. */
export function coverageOf(state: Pick<EmbeddingsState, 'coverage'>, model: string): EmbeddingCoverage | undefined {
  return state.coverage.find((c) => c.model === model)
}

/** «только что», «5 мин назад», «3 ч назад», «5 ноя» — когда обновлялось. Пусто/невалидно — `null`. */
export function relativeTime(iso: string | null | undefined, now: number = Date.now()): string | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  const min = Math.floor((now - t) / 60000)
  if (min < 1) return 'только что'
  if (min < 60) return `${min} мин назад`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} ч назад`
  const d = new Date(t)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date(now).getFullYear() ? { year: 'numeric' } : {}) })
}

/** 12345 → «12 345». */
export function formatCount(n: number | undefined): string {
  return (n ?? 0).toLocaleString('ru-RU').replace(/ /g, ' ')
}
