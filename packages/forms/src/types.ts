/**
 * Типы платформы «Формы» — зеркало Go-контракта wh24-forms-api:
 *   internal/schema   → SchemaDocument / Field / Section / TableConfig
 *   internal/conditions → Condition / ConditionGroup / Op
 *   internal/model    → Form / FormVersion / FormRecord / … (json-теги snake_case)
 *   internal/validate → RecordFieldError
 *
 * Правило: имена полей и значения enum'ов совпадают с бэкендом буквально.
 * Расхождение здесь — это баг контракта, а не «удобное» переименование.
 */

// ─── Схема формы (internal/schema) ────────────────────────────────────────

export const FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'money',
  'date',
  'datetime',
  'checkbox',
  'email',
  'phone',
  'link',
  'select',
  'multiselect',
  'catalog',
  'user',
  'department',
  'table',
  'file',
  'section',
  'note',
] as const

export type FieldType = (typeof FIELD_TYPES)[number]

/** Презентационные «поля»: не хранят значение в data, служат только вёрстке. */
export const PRESENTATION_TYPES: readonly FieldType[] = ['section', 'note']

export function isPresentation(t: FieldType): boolean {
  return PRESENTATION_TYPES.includes(t)
}

/** Типы, допустимые для КОЛОНОК таблицы (schema.tableColumnAllowedTypes). */
export const TABLE_COLUMN_TYPES: readonly FieldType[] = [
  'text',
  'number',
  'money',
  'date',
  'select',
  'checkbox',
]

/** Типы, из которых можно брать название записи (schema.titleCapableTypes). */
export const TITLE_CAPABLE_TYPES: readonly FieldType[] = ['text', 'select', 'catalog', 'user']

/** Ширина поля в 12-колоночной сетке (schema.validSpans). */
export type FieldSpan = 3 | 4 | 6 | 12

export const FIELD_SPANS: readonly FieldSpan[] = [3, 4, 6, 12]

/** Максимальная глубина цепочки visible_if (schema.maxVisibilityChainDepth). */
export const MAX_VISIBILITY_CHAIN_DEPTH = 3

export type Op =
  | 'eq'
  | 'ne'
  | 'in'
  | 'not_in'
  | 'empty'
  | 'not_empty'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'

export const OPS: readonly Op[] = [
  'eq',
  'ne',
  'in',
  'not_in',
  'empty',
  'not_empty',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
]

export interface Condition {
  /** id поля (не key): записи и условия ссылаются на поле по id. */
  field: string
  op: Op
  value?: unknown
}

/**
 * Группа условий. Отсутствие группы = поле видно всегда. `all` — все (AND),
 * `any` — хотя бы одно (OR); заданы оба — `all(...) && any(...)`.
 */
export interface ConditionGroup {
  all?: Condition[]
  any?: Condition[]
}

export interface SelectOption {
  value: string
  label: string
}

// Config — настройки, специфичные для типа. Бэкенд хранит их как opaque JSON
// и заглядывает только в нужные ключи; здесь то же самое: общий тип — словарь,
// типизированные срезы — для конкретных типов поля.
export type FieldConfig = Record<string, unknown>

export interface SelectConfig {
  options?: SelectOption[]
}
export interface NumberConfig {
  min?: number
  max?: number
}
export interface MoneyConfig extends NumberConfig {
  currency?: string
}
export interface TextConfig {
  max_length?: number
}
export interface CatalogConfig {
  catalog_key?: string
}
export interface FileConfig {
  max_files?: number
}
export interface TableColumn {
  id: string
  key: string
  label: string
  type: FieldType
}
export interface TableConfig {
  columns?: TableColumn[]
  max_rows?: number
}

export interface Field {
  /** UUID; никогда не переиспользуется, даже после архивации. */
  id: string
  key: string
  label: string
  type: FieldType
  section_id: string
  span: FieldSpan
  required: boolean
  hint?: string
  placeholder?: string
  show_in_list: boolean
  filterable: boolean
  archived: boolean
  config?: FieldConfig
  visible_if?: ConditionGroup
}

export interface Section {
  id: string
  title: string
  sort: number
}

export interface SchemaDocument {
  schema_version: number
  /** id поля, дающего название записи. */
  title_field: string
  sections: Section[]
  fields: Field[]
}

/** Блокер публикации (schema.ValidationError). */
export interface SchemaValidationError {
  field_id?: string
  message: string
}

// ─── Модель (internal/model) ─────────────────────────────────────────────

export type FormStatus = 'draft' | 'published' | 'archived'
export type RecordAccess = 'module' | 'author'

export interface Form {
  id: string
  module_key: string
  key: string
  name: string
  nav_label: string
  page_title: string
  description: string
  icon: string
  status: FormStatus
  current_version: number
  draft_schema: SchemaDocument | null
  draft_updated_at: string | null
  draft_updated_by: string | null
  record_access: RecordAccess
  sort_order: number
  created_by: string
  created_at: string
  updated_at: string
  archived_at: string | null
}

export interface FormVersion {
  id: string
  form_id: string
  version: number
  schema: SchemaDocument
  published_at: string
  published_by: string
  change_note: string
}

/** Значения записи: id поля → значение. Табличное поле — массив строк
 *  (id колонки → значение), файлы — массив id вложений. */
export type RecordData = Record<string, unknown>

export interface FormRecord {
  id: string
  form_id: string
  form_version: number
  number: number
  title: string
  data: RecordData
  status: string
  created_by: string
  updated_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type RecordHistoryAction = 'created' | 'updated' | 'deleted' | 'restored'

export interface FieldChange {
  from: unknown
  to: unknown
}

export interface RecordHistoryEntry {
  id: string
  record_id: string
  form_version: number
  actor: string
  at: string
  action: RecordHistoryAction
  /** id поля → было/стало. */
  changes: Record<string, FieldChange> | null
}

export interface FormFile {
  id: string
  record_id: string
  field_id: string
  name: string
  size: number
  mime: string
  uploaded_by: string
  uploaded_at: string
  deleted_at: string | null
}

export interface FileUrl {
  url: string
  expires_at: string
}

export interface Catalog {
  id: string
  key: string
  name: string
  columns: unknown
  display_column: string
  created_at: string
  updated_at: string
  archived: boolean
}

export interface CatalogItem {
  id: string
  catalog_id: string
  values: Record<string, unknown>
  sort_order: number
  archived: boolean
}

export interface AuditLogEntry {
  id: string
  entity_type: 'form' | 'catalog'
  entity_id: string
  actor: string
  at: string
  action: string
  before: unknown
  after: unknown
}

/** Опция полей user/department (internal/org.Option). */
export interface OrgOption {
  id: string
  label: string
  hint?: string
}

// ─── Ошибки заполнения (internal/validate) ───────────────────────────────

export type RecordErrorCode =
  | 'required'
  | 'type'
  | 'max_length'
  | 'min'
  | 'max'
  | 'format'
  | 'not_in_options'
  | 'not_in_catalog'
  | 'max_files'
  | 'unknown_field'
  | 'unknown_column'

export interface RecordFieldError {
  field_id?: string
  code: RecordErrorCode | string
  /** По-русски, доходит до пользователя как есть. */
  message: string
}

// ─── Доступ ─────────────────────────────────────────────────────────────

/** Локальная роль в сервисе «Формы» (админская часть). */
export type FormsRole = 'none' | 'view' | 'edit' | 'manage'

export interface MeAccess {
  role: FormsRole
}
