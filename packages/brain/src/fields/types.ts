/**
 * Контракт «Полей ИИ» и генераторов (wh24-brain-api, docs/API.md → «Поля ИИ и
 * генераторы»). Менять только вместе с бэкендом.
 *
 * Правило №1 (владелец, 06.11.2026): значение ячейки видит только тот, кто видит
 * саму запись. Фильтр по правам — на сервере (JOIN на документ индекса), клиент
 * показывает ровно то, что пришло, и ничего не кеширует в localStorage.
 */
import type { RunStatus } from '../types.js'

/** Вид поля: что модель пишет в ячейку. */
export type AiFieldKind =
  | 'summary'
  | 'progress'
  | 'translate'
  | 'action_items'
  | 'categorize'
  | 'sentiment'
  | 'custom'

/** `private` — только автору; `public` — всем (создаёт управляющий). */
export type AiFieldVisibility = 'private' | 'public'

export interface AiFieldParams {
  /** `categorize`: 2–12 вариантов; у `sentiment` набор фиксирован сервером. */
  options?: string[]
  /** `translate`: на какой язык («английский»). */
  language?: string
}

export interface AiField {
  id: string
  /** oup | tasks | forms */
  module: string
  /** lead | project | contact | contractor | task | form_record */
  entity_type: string
  /**
   * Чему принадлежит колонка внутри типа записи: у записей ФОРМ — id формы (колонки
   * одной формы не видны в другой), у лидов, проектов, задач и т. п. — пусто.
   */
  scope: string
  label: string
  kind: AiFieldKind
  /** `custom` — что писать в ячейке (обязателен); у остальных — необязательное уточнение. */
  prompt: string
  params: AiFieldParams
  /** Пусто — дешёвая модель сервиса. */
  model: string
  /** Пересчитывать уже посчитанные ячейки, когда запись изменилась. */
  on_change: boolean
  visibility: AiFieldVisibility
  enabled: boolean
  created_by: string
  created_at?: string
  updated_at?: string
  /** Права смотрящего на колонку (сервер уже посчитал). */
  can: { edit: boolean }
}

/** Тело создания колонки: описание без служебных полей. */
export interface AiFieldDraft {
  module: string
  entity_type: string
  /** Для записей форм обязателен — id формы (сервер иначе ответит 400 `field: "scope"`); для остальных не передаётся. */
  scope?: string
  label: string
  kind: AiFieldKind
  prompt: string
  params: AiFieldParams
  on_change: boolean
  visibility: AiFieldVisibility
  model?: string
  enabled?: boolean
}

/** Правка колонки. Вид, модуль и тип записи не меняются. */
export interface AiFieldPatch {
  label?: string
  prompt?: string
  params?: AiFieldParams
  model?: string
  on_change?: boolean
  visibility?: AiFieldVisibility
  enabled?: boolean
}

export interface AiFieldList {
  fields: AiField[]
  /** Расчётов одной колонки в сутки. */
  daily_limit: number
  /** `false` — для этого списка поля ИИ не поддерживаются, кнопку «+ Поле ИИ» не показывать. */
  supported: boolean
}

export interface AiFieldUpdateResult {
  field: AiField
  /** Сменился смысл ячейки (промпт, варианты, язык, модель) — посчитанные значения стёрты. */
  values_reset: boolean
}

/** `stale` — запись изменилась после расчёта: текст прежний, но может устареть. */
export type AiFieldStatus = 'fresh' | 'stale' | 'queued' | 'computing' | 'failed'

export interface AiFieldValue {
  status: AiFieldStatus
  text: string
  error?: string
  /** quota | daily_limit | upstream | timeout | internal | no_record */
  error_code?: string
  computed_at?: string
}

/** `{<field_id>: {<entity_id>: значение}}`. Нет ключа — ячейка пуста. */
export type AiFieldValues = Record<string, Record<string, AiFieldValue>>

export interface AiFieldFillBody {
  /** Идентификаторы записей списка (до 500 за запрос; клиент делит сам). */
  entity_ids: string[]
  /** `true` — пересчитать и свежие значения («Обновить все»). */
  force?: boolean
}

export interface AiFieldFillResult {
  queued: number
  requested: number
  /** Записей, недоступных нажавшему, — пропущены. */
  no_access: number
  /** Не поставлено из-за дневного лимита колонки. */
  skipped_limit: number
  /** Записей, значения которых уже свежие: без `force` их пропустили. */
  up_to_date: number
  /** Сколько расчётов колонки осталось на сегодня. */
  limit_left: number
}

export interface FieldPreviewRow {
  entity_id: string
  title: string
  text: string
  error?: string
  done: boolean
}

export interface FieldPreview {
  id: string
  status: 'running' | 'done'
  rows: FieldPreviewRow[]
  cost_usd: number
}

/** Проба несохранённой колонки: описание + 1–3 записи. */
export interface FieldPreviewRequest extends AiFieldDraft {
  entity_ids: string[]
}

// ─── Генераторы ───

export type GeneratorKind = 'week_summary' | 'standup' | 'project_update' | 'exec_summary'

export interface GeneratorPerson {
  user_id: string
  name: string
}

export interface GeneratorRequest {
  /** `ГГГГ-ММ-ДД` включительно; пусто — неделя (итог недели) или последние 7 дней. */
  from?: string
  to?: string
  /** Стендап: 1–20 человек. */
  people?: GeneratorPerson[]
  /** Итог недели: как зовут нажавшего (для поиска по людям). */
  self_name?: string
  /** Дайджест проекта: id записи ОУП и её название. */
  project_id?: string
  project_title?: string
  /** Сводка руководителя: ограничить поиск модулями. */
  modules?: string[]
}

/** Ответ 202 на `POST /generate/:kind`; результат — `getRun`/`waitForRun`, как у вопроса. */
export interface GeneratorAccepted {
  run_id: string
  status?: RunStatus
}
