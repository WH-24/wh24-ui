import type { FilterPreset, FilterState } from './types.js'

/**
 * Персист фильтра в localStorage по scope + кодирование для шеринга через URL.
 * Конвенция ключей — `wh_*` (как wh_bot_tickets_view и пр.).
 */

export interface StoredFilter {
  state: FilterState
  /** Видимые необязательные поля (порядок учитывается для drag-реордера). */
  fields: string[]
}

const curKey = (scope: string) => `wh_filter_${scope}`
const presetsKey = (scope: string) => `wh_filter_${scope}_saved`

export function loadState(scope: string): StoredFilter | null {
  try {
    const raw = localStorage.getItem(curKey(scope))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredFilter
    if (!parsed || typeof parsed !== 'object') return null
    return { state: parsed.state ?? {}, fields: parsed.fields ?? [] }
  } catch {
    return null
  }
}

export function saveState(scope: string, value: StoredFilter): void {
  try {
    localStorage.setItem(curKey(scope), JSON.stringify(value))
  } catch {
    /* приватный режим / переполнение — молча игнорируем */
  }
}

export function loadPresets(scope: string): FilterPreset[] {
  try {
    const raw = localStorage.getItem(presetsKey(scope))
    if (!raw) return []
    const parsed = JSON.parse(raw) as FilterPreset[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function savePresets(scope: string, presets: FilterPreset[]): void {
  try {
    localStorage.setItem(presetsKey(scope), JSON.stringify(presets))
  } catch {
    /* noop */
  }
}

/** URL-параметр шеринга для данного scope. */
export const shareParam = (scope: string) => `f_${scope}`

/** Кодировать фильтр в компактную строку для ссылки (?f_<scope>=…). */
export function encodeShare(value: StoredFilter): string {
  try {
    // encodeURIComponent → btoa безопасно для кириллицы (UTF-8).
    return btoa(unescape(encodeURIComponent(JSON.stringify(value))))
  } catch {
    return ''
  }
}

export function decodeShare(raw: string): StoredFilter | null {
  try {
    const json = decodeURIComponent(escape(atob(raw)))
    const parsed = JSON.parse(json) as StoredFilter
    if (!parsed || typeof parsed !== 'object') return null
    return { state: parsed.state ?? {}, fields: parsed.fields ?? [] }
  } catch {
    return null
  }
}

/** Прочитать фильтр из текущего URL (имеет приоритет над localStorage). */
export function readShareFromUrl(scope: string): StoredFilter | null {
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get(shareParam(scope))
  return raw ? decodeShare(raw) : null
}
