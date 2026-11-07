/**
 * Личная память ИИ о человеке: как обращаться, роль, предпочтения, люди и факты.
 * Форма — по docs/API.md wh24-brain-api, раздел «Память пользователя».
 */

/** Вид записи списка. Обращение и роль — отдельные поля, не записи. */
export type UserMemoryKind = 'preference' | 'person' | 'fact'
/** Откуда запись: написана вручную, запомнена ИИ по просьбе, импортирована. */
export type MemorySource = 'manual' | 'ai' | 'import'

export interface MemoryItem {
  id: string
  kind: UserMemoryKind
  text: string
  source: MemorySource
  created_at?: string
}

export interface UserMemory {
  /** Выключена — запись хранится, но в вопросы не подмешивается. */
  enabled: boolean
  nickname: string
  role: string
  items: MemoryItem[]
  limits: { max_items: number; max_text: number }
}

export interface MemoryUpdate {
  enabled?: boolean
  nickname?: string
  role?: string
}

export interface MemoryItemDraft {
  kind: UserMemoryKind
  text: string
}

export interface MemoryImportResult {
  added: number
  skipped: number
  items: MemoryItem[]
}

/** Пока сервер не прислал `limits`. */
export const DEFAULT_MEMORY_LIMITS = { max_items: 100, max_text: 300 } as const
