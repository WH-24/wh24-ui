import { SKILL_LIMITS, type SkillStatus } from './types.js'

export const SKILL_STATUS_LABEL: Record<SkillStatus, string> = {
  draft: 'Черновик',
  active: 'Включён',
  archived: 'В архиве',
}

/** Формат команды — тот же, что проверяет сервер. */
export const SLASH_RE = /^[a-zа-яё0-9_-]{2,30}$/

export const SLASH_HINT = 'От 2 до 30 знаков: буквы, цифры, «-» и «_», без пробелов.'

/** «/Дайджест » → «дайджест»: убираем «/» и пробелы, регистр — нижний. */
export function normalizeSlash(raw: string): string {
  return raw.trim().replace(/^\/+/, '').toLowerCase()
}

/** Команда из названия: «Дайджест проекта» → «дайджест-проекта». Пусто, если ничего подходящего не осталось. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-zа-яё0-9_-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, SKILL_LIMITS.slashMax)
    .replace(/[-_]+$/g, '')
}

/** Что не так с командой, или `undefined`, если всё хорошо. */
export function slashProblem(slash: string): string | undefined {
  if (!slash) return 'Придумайте команду для вызова навыка.'
  if (!SLASH_RE.test(slash)) return SLASH_HINT
  return undefined
}

/** «Применён 3 раза» / «Не применялся». */
export function usesLabel(uses: number): string {
  if (!uses) return 'Не применялся'
  const m10 = uses % 10
  const m100 = uses % 100
  const word = m10 === 1 && m100 !== 11 ? 'раз' : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'раза' : 'раз'
  return `Применён ${uses} ${word}`
}
