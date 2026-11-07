/**
 * Контракт wh24-brain-api глазами интерфейса. Менять только вместе с бэкендом.
 *
 * Главное правило (владелец, 06.11.2026): права проверяет сервер. Всё, что
 * пришло в `SearchHit[]` и `Citation[]`, уже отфильтровано по правам
 * пользователя — интерфейс показывает это как есть, ничего не скрывает сам и
 * ничего не кеширует в localStorage.
 */

/** Откуда задан вопрос: карточка лида, проект, запись формы, раздел вики… */
export interface BrainContext {
  /** lead | project | contractor | fm | task | form_record | wiki | section | … */
  kind: string
  id: string
  /** Ключ модуля-владельца: oup, hr, wiki, tasks, forms, finance… */
  module: string
  title?: string
}

/** Документ индекса, найденный поиском. Сниппет уже подготовлен сервером. */
export interface SearchHit {
  document_id: string
  module: string
  entity_type: string
  entity_id: string
  title: string
  /** Путь в портале (`/gen/…`, `/oup/leads/…`) или полный адрес. */
  url: string
  snippet: string
  score: number
  updated_at: string
  indexed_at: string
}

export interface SearchRequest {
  q: string
  context?: BrainContext
  /** Искать только внутри `context` («Искать только здесь»). */
  only_context?: boolean
  modules?: string[]
  limit?: number
}

export interface SearchResponse {
  hits: SearchHit[]
  total?: number
  took_ms?: number
}

/** Файл к вопросу: имя и содержимое (data-URL или base64). */
export interface BrainAttachment {
  name: string
  data: string
}

export interface AskRequest {
  q: string
  thread_id?: string
  context?: BrainContext
  only_context?: boolean
  model?: string
  attachments?: BrainAttachment[]
}

/** Ответ 202 на `POST /ask`: работа идёт в фоне, дальше — опрос `GET /runs/:id`. */
export interface AskAccepted {
  run_id: string
}

export type RunStatus = 'queued' | 'running' | 'completed' | 'skipped' | 'failed' | 'cancelled'

/** Источник ответа: `[n]` в тексте ссылается на `n` здесь. */
export interface Citation {
  n: number
  document_id: string
  title: string
  url: string
  snippet?: string
  module?: string
  entity_type?: string
}

/** Шаг агента: какой инструмент и чем кончилось. */
export interface RunStep {
  tool: string
  title: string
  ok: boolean
  started_at?: string
  finished_at?: string
  detail?: string
}

export type ActionStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled'

/** Строка предпросмотра: поле карточки и что в него будет записано. */
export interface ActionPreviewRow {
  field: string
  value: unknown
}

export interface ActionPreview {
  will_set?: ActionPreviewRow[]
  stage?: string
  warning?: string
  possible_duplicates?: { full_name?: string; position?: string }[]
}

/**
 * Действие, которое подготовил агент («Создать лид»). Записать может только
 * человек — кнопкой «Подтвердить»; у модели токена подтверждения нет.
 */
export interface PendingAction {
  id: string
  tool: string
  title: string
  status: ActionStatus
  result?: string
  created_at?: string
  preview: ActionPreview
}

/** Подсказка «спросить дальше» под ответом. */
export interface SuggestedAction {
  id?: string
  label: string
  /** Что отправить в чат по клику. Нет — отправляется `label`. */
  prompt?: string
}

export interface RunUsage {
  input_tokens?: number
  output_tokens?: number
  cost?: number
  model?: string
}

/** Тип значения колонки блока; сервер может прислать и другой (строкой). */
export type RunBlockColumnType = 'string' | 'integer' | 'float' | 'date' | 'datetime' | 'boolean' | string

/** Колонка таблицы блока. `title` — как в наборе данных (Perspective адресует колонки по названию). */
export interface RunBlockColumn {
  key: string
  title: string
  type: RunBlockColumnType
}

/** Показатель, который посчитан в блоке: ключ, название и формула текстом. */
export interface RunBlockMetric {
  key: string
  title: string
  formula?: string
}

/** Фильтр, по которому отобраны строки блока (`op` — как в `bi/query`: eq, in, between…). */
export interface RunBlockFilter {
  column: string
  op: string
  value?: unknown
  values?: unknown[]
}

/** «Что посчитано»: набор, показатели, период, фильтры и объём данных блока. */
export interface RunBlockExplain {
  dataset?: string
  dataset_title?: string
  metrics?: RunBlockMetric[]
  period?: { from?: string; to?: string }
  /** Период не задан в вопросе — сервер взял свой (12 полных месяцев). */
  period_defaulted?: boolean
  /** Разрез времени: month | quarter | year. */
  granularity?: string
  filters?: RunBlockFilter[]
  /** Сколько строк в блоке. */
  row_count?: number
  /** Сколько строк было до обрезки лимитом. */
  source_rows?: number
  truncated?: boolean
  /** Когда посчитано (ISO 8601). */
  computed_at?: string
  /** Текст запроса — только у блоков `bi_sql` администратора. */
  sql?: string
}

export type RunBlockSource = 'bi_query' | 'bi_sql'

/** Значение ячейки блока. */
export type RunBlockCell = string | number | boolean | null

/**
 * Структурный блок ответа: данные + декларативная конфигурация графика
 * (`view` — ViewConfig Perspective) + «что посчитано». Хост рисует его своим
 * просмотрщиком (`renderBlock`), без него — запасная таблица пакета.
 */
export interface RunBlock {
  id: string
  type: 'chart'
  title: string
  dataset: string
  /** Запрос к `bi/query`, которым получены данные — чтобы перерисовать позже. */
  query: Record<string, unknown>
  columns: RunBlockColumn[]
  rows: RunBlockCell[][]
  /** Конфигурация графика Perspective (`plugin`, `group_by`, `columns`, …). */
  view: Record<string, unknown>
  explain: RunBlockExplain
  source: RunBlockSource
}

export interface Run {
  id: string
  status: RunStatus
  answer_md: string
  citations: Citation[]
  steps: RunStep[]
  pending_action?: PendingAction | null
  suggested_actions: SuggestedAction[]
  /** Графики и таблицы к ответу; нет поля — ответ только текстом. */
  blocks?: RunBlock[]
  usage?: RunUsage
  /** Текст ошибки при `failed`, по-русски — можно показывать как есть. */
  error?: string
  thread_id?: string
  created_at?: string
  finished_at?: string
}

export type FeedbackVote = 'up' | 'down'

export interface FeedbackRequest {
  run_id: string
  vote: FeedbackVote
  comment?: string
}

/** Что показывается карточкой источника: подходит и `SearchHit`, и `Citation`. */
export interface BrainSource {
  document_id: string
  title: string
  url: string
  snippet?: string
  module?: string
  entity_type?: string
  updated_at?: string
  score?: number
}
