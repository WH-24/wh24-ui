import type { DateRange, FilterBarConfig, FilterState, FilterValue } from './types.js'
import { SEARCH_KEY } from './types.js'

/** Значение поля «не задано» (поле не участвует в фильтрации). */
export function isEmptyValue(v: FilterValue): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.trim() === ''
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === 'boolean') return false // false — валидное tri-state значение
  // DateRange
  const r = v as DateRange
  return !r.from && !r.to
}

/** Сколько активных условий в состоянии (для счётчика на чипе). */
export function activeCount(state: FilterState): number {
  return Object.values(state).filter((v) => !isEmptyValue(v)).length
}

function norm(s: unknown): string {
  return String(s ?? '').toLowerCase()
}

/** Дата строки попадает в диапазон [from, to] (любая граница опциональна). */
function inDateRange(raw: string | null | undefined, range: DateRange): boolean {
  if (!raw) return false
  const d = raw.slice(0, 10) // ISO yyyy-mm-dd
  if (range.from && d < range.from) return false
  if (range.to && d > range.to) return false
  return true
}

/**
 * Универсальный предикат: строка проходит фильтр, если удовлетворяет ВСЕМ
 * непустым условиям (AND между полями; OR внутри multiselect).
 */
export function matchItem<T>(item: T, state: FilterState, config: FilterBarConfig<T>): boolean {
  // Свободный поиск.
  const q = state[SEARCH_KEY]
  if (typeof q === 'string' && q.trim() && config.search) {
    if (!norm(config.search.get(item)).includes(q.trim().toLowerCase())) return false
  }

  for (const field of config.fields) {
    const value = state[field.key]
    if (value === undefined || isEmptyValue(value)) continue
    const got = field.get(item)

    switch (field.type) {
      case 'text': {
        if (!norm(got).includes(norm(value))) return false
        break
      }
      case 'select': {
        if (norm(got) !== norm(value)) return false
        break
      }
      case 'multiselect': {
        // Значение бывает скаляром: поле раньше объявляли `select`, а сохранённый
        // выбор пользователя и глобальные пресеты живут дольше типа поля. Строку
        // трактуем как список из одного элемента — иначе `.map` роняет рендер,
        // и страница не открывается, пока не вычистишь localStorage вручную.
        const wanted = (Array.isArray(value) ? value : [value as string]).map(norm)
        const have = Array.isArray(got) ? got.map(norm) : [norm(got)]
        if (!have.some((h) => wanted.includes(h))) return false
        break
      }
      case 'daterange': {
        if (!inDateRange(typeof got === 'string' ? got : null, value as DateRange)) return false
        break
      }
      case 'boolean': {
        if (Boolean(got) !== (value as boolean)) return false
        break
      }
    }
  }
  return true
}
