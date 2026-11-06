/**
 * Навыки: сохранённые инструкции, которые вызывают командой `/слэш` в начале
 * вопроса. Форма — по docs/API.md wh24-brain-api, раздел «Навыки».
 */

export type SkillStatus = 'draft' | 'active' | 'archived'
export type SkillVisibility = 'private' | 'public'

export interface Skill {
  id: string
  name: string
  /** Команда без «/», нижний регистр. */
  slash: string
  description: string
  instructions: string
  status: SkillStatus
  /** `public` — виден всем (создаёт управляющий); slash общих уникален. */
  visibility: SkillVisibility
  owner_user_id: string
  /** Сколько раз применён. */
  uses: number
  last_used_at?: string
  created_at?: string
  updated_at?: string
  can: { edit: boolean }
}

export interface SkillDraft {
  name: string
  slash: string
  description?: string
  instructions: string
  status?: SkillStatus
  visibility?: SkillVisibility
}

export type SkillPatch = Partial<SkillDraft>

/** `all` — свои и чужие общие (по умолчанию), `mine` — только свои, `shared` — общие. */
export type SkillScope = 'all' | 'mine' | 'shared'

export interface SkillList {
  skills: Skill[]
  /** Роль `manage`: можно делать навык общим. */
  can_publish: boolean
}

export interface SkillSuggestion {
  name: string
  slash: string
  description: string
  instructions: string
  /** Выдержки из ваших вопросов, по которым предложен навык. */
  evidence: string[]
}

export interface SkillSuggestions {
  suggestions: SkillSuggestion[]
  /** Сколько ваших вопросов прочитано. */
  analyzed: number
  /** Почему предложений нет («мало вопросов»). */
  reason?: string
}

/** Пункт меню «/» в композере. */
export interface SlashSkill {
  slash: string
  name: string
  description?: string
}

/** Пределы полей навыка (те же, что проверяет сервер). */
export const SKILL_LIMITS = {
  name: 80,
  description: 120,
  instructions: 4000,
  slashMin: 2,
  slashMax: 30,
} as const
