import { BrainApiError } from '../api.js'
import type { AiFieldValue } from './types.js'

/** Фраза сервера годится для человека, если это не безликое «HTTP 403». */
function isHumanMessage(m: string | undefined): m is string {
  return Boolean(m && m.trim() !== '' && !/^HTTP \d{3}$/.test(m.trim()))
}

/**
 * Текст ошибки для человека. Сервер на 400/403/409 присылает понятную фразу
 * («Опишите, что ИИ должен писать в ячейке.») — её и показываем; технические
 * детали («HTTP 502», стек) наружу не выводим.
 */
export function brainErrorText(e: unknown, fallback = 'Не получилось. Попробуйте ещё раз.'): string {
  if (e instanceof BrainApiError) {
    if (e.budgetExceeded) return 'Дневной бюджет исчерпан — попробуйте завтра.'
    if (e.quotaExceeded) return isHumanMessage(e.message) ? e.message : 'Лимит ИИ исчерпан — попробуйте позже.'
    if (e.status === 401) return 'Войдите в портал заново.'
    if (e.status === 404) return 'Не найдено: запись удалена или недоступна вам.'
    if ((e.status === 400 || e.status === 403 || e.status === 409) && isHumanMessage(e.message)) return e.message
    if (e.status === 403) return 'Недостаточно прав для этого действия.'
  }
  return fallback
}

const CELL_ERROR: Record<string, string> = {
  quota: 'Лимит ИИ исчерпан — попробуйте позже',
  daily_limit: 'Дневной лимит колонки исчерпан',
  upstream: 'Сервис ИИ недоступен',
  timeout: 'ИИ не успел ответить',
  no_record: 'Запись недоступна',
}

/** Что написать в ячейке со статусом `failed`: текст сервера, иначе по коду. */
export function cellErrorText(v: Pick<AiFieldValue, 'error' | 'error_code'>): string {
  if (isHumanMessage(v.error)) return v.error
  return (v.error_code && CELL_ERROR[v.error_code]) || 'Не удалось заполнить'
}
