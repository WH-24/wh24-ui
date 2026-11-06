/**
 * Контракт «Агентов ИИ» wh24-brain-api (docs/API.md, раздел «Агенты ИИ»). Менять
 * только вместе с бэкендом.
 *
 * Права проверяет сервер: `Agent.can` и `canManage` у компонентов нужны только
 * для видимости кнопок — запрещённое действие сервер всё равно отклонит (403).
 */
import type { PendingAction, Run, RunStep } from '../types.js'

export type AgentStatus = 'draft' | 'active' | 'paused'
/** `ask` — запись только предпросмотром, ждёт «Подтвердить»; `deny` — инструменты записи не выдаются. */
export type WritePolicy = 'ask' | 'deny'
export type AgentVisibility = 'private' | 'public'
export type CanTriggerMode = 'owner' | 'all' | 'users'
export type TriggerKind = 'manual' | 'schedule' | 'event'
export type FilterOp = 'eq' | 'in' | 'contains' | 'exists'
export type MemoryKind = 'recent' | 'preference' | 'fact'

/** Почему запуск пропущен. Неизвестное значение показывается общей фразой, не кодом. */
export type SkipReason = 'budget' | 'delegation_unavailable' | 'no_manage_role' | 'condition_false' | 'condition_error'

/** Кто может запускать публичного агента вручную. */
export interface CanTrigger {
  mode: CanTriggerMode
  user_ids?: string[]
}

export interface AgentKnowledge {
  /** Сужает поиск; пусто — все модули, доступные запускающему. */
  modules?: string[]
  /** ≤5 документов, которые агент видит всегда (в границах прав запускающего). */
  pinned_document_ids?: string[]
}

/** Условие на поля события: `eq|contains` — строка, `in` — список, `exists` — без значения. */
export interface FilterRule {
  /** subject_type | subject_id | department_id | actor_user_id | subject_user_id | link | payload.<ключ> */
  path: string
  op: FilterOp
  value?: string | string[] | null
}

export interface TriggerConfig {
  // schedule
  /** 5 полей, как в cron; не чаще раза в 5 минут. */
  cron?: string
  /** IANA; по умолчанию Europe/Moscow. */
  tz?: string
  /** RFC 3339: после этого момента расписание не срабатывает. */
  ends_at?: string | null
  // event
  /** Точные ключи событий notify-api и `префикс.*`. */
  event_keys?: string[]
  filter?: FilterRule[]
  /** Условие своими словами: проверяет дешёвая модель, ошибка — запуск пропускается. */
  condition_nl?: string
  /** Отдавать агенту payload события (данные могут быть шире прав владельца). */
  include_payload?: boolean
}

export interface Trigger {
  /** У нового триггера нет id: сервер выдаёт его при сохранении. */
  id?: string
  kind: TriggerKind
  enabled: boolean
  config: TriggerConfig
  next_run_at?: string | null
  last_fired_at?: string | null
}

export interface AgentCan {
  edit: boolean
  run: boolean
  delete: boolean
  journal: boolean
}

/** Поля профиля, которые правит человек (и конструктор диалогом). */
export interface AgentDraft {
  id?: string
  name: string
  description: string
  /** Имя иконки: calendar, briefcase, chart, book, bolt, list… */
  avatar?: string
  instructions: string
  /** Пусто — модель по умолчанию. */
  model: string
  max_steps?: number
  /** Имена инструментов; пусто — все доступные запускающему. */
  tools: string[]
  knowledge: AgentKnowledge
  memory_enabled: boolean
  write_policy: WritePolicy
  /** Чьими правами идёт расписание/событие; пусто — владелец. */
  run_as_user_id?: string
  visibility: AgentVisibility
  can_trigger: CanTrigger
  status?: AgentStatus
  daily_budget_usd: number
  triggers: Trigger[]
  /** Агент с событием или публичный с расписанием/событием: нужен ввод «понимаю» перед включением. */
  privacy_warning?: boolean
}

/** Агент как его отдаёт сервер. */
export interface Agent extends AgentDraft {
  id: string
  slug: string
  owner_user_id: string
  run_as_user_id: string
  preset_key?: string
  created_at?: string
  updated_at?: string
  // Сводка в списке.
  runs_total?: number
  last_run_at?: string | null
  last_status?: string
  can: AgentCan
}

/** Создание: поля агента или каталожный пресет (`{preset_key, name?}`). */
export type AgentCreateBody = Partial<AgentDraft> | { preset_key: string; name?: string }

/** Частичная правка: что не прислано — не меняется; `triggers` заменяет набор целиком. */
export type AgentUpdateBody = Partial<AgentDraft>

export interface AgentRunStep extends RunStep {
  n?: number
  /** `model` — шаг самой модели (в интерфейсе не показывается), `tool` — инструмент. */
  kind?: 'model' | 'tool'
  ms?: number
}

/** Запуск агента: обычный Run плюс агент, триггер и причина пропуска. */
export interface AgentRun extends Run {
  steps: AgentRunStep[]
  kind?: string
  agent_id?: string
  agent_name?: string
  trigger_kind?: TriggerKind
  skip_reason?: SkipReason | (string & {})
  /** Запуск показан без содержимого: смотрящий управляет журналом, но не участвовал в запуске. */
  restricted?: boolean
  question?: string
  model?: string
  tokens_in?: number
  tokens_out?: number
  cost_usd?: number
  /** Курсор для `before` в журнале (старее этого времени). */
  queued_at?: string
  started_at?: string
  pending_actions?: PendingAction[]
}

export interface AgentMemoryItem {
  id: string
  kind: MemoryKind
  text: string
  pinned?: boolean
  created_at?: string
  expires_at?: string | null
}

/** Инструмент, доступный вам: `write` — запись (только предпросмотром и «Подтвердить»). */
export interface AgentToolInfo {
  name: string
  title: string
  description: string
  write: boolean
  /** Откуда: модуль или `builtin`. */
  source: string
}

export interface AgentPreset {
  key: string
  name: string
  description: string
  avatar: string
  needs_manager: boolean
  available: boolean
  agent: Agent
}

/** Поля, которые конструктор может предложить изменить. */
export type AgentPatch = Pick<
  Partial<AgentDraft>,
  'name' | 'description' | 'instructions' | 'tools' | 'write_policy' | 'memory_enabled' | 'knowledge' | 'triggers'
>

export interface AgentDraftMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AgentDraftRequest {
  message: string
  history?: AgentDraftMessage[]
  /** Профиль, как он сейчас в форме: конструктор уточняет, а не пишет с нуля. */
  agent?: Partial<AgentDraft>
}

export interface AgentDraftResult {
  reply: string
  /** Только допустимые поля. Ничего не сохранено: применяет интерфейс, сохраняет человек. */
  patch: AgentPatch
  /** Что из предложенного отклонено проверкой (по-русски, для показа). */
  notes?: string[]
}

export interface AgentRunAccepted {
  run_id: string
  status?: string
}

export interface AgentListParams {
  scope?: 'mine' | 'shared'
}

export interface AgentRunsParams {
  agent_id?: string
  status?: string
  limit?: number
  /** `queued_at` последнего запуска в списке — отдаёт более старые. */
  before?: string
}

/** Ключ события для выбора в триггере. Список даёт хост (notify-api): `{key, label}`. */
export interface EventKeyOption {
  key: string
  label?: string
}
