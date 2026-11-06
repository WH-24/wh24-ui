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
  'record_ref',
  'contact',
  // Типы «до уровня Monday», шаг 1 (06.11.2026, спека в wh24-forms-api
  // docs/superpowers/specs/2026-11-06-field-types-monday-design.md).
  'rating',
  'time',
  'date_range',
  'duration',
  'percent',
  'tags',
  'location',
  'color',
  'section',
  'note',
] as const

export type FieldType = (typeof FIELD_TYPES)[number]

/** Презентационные «поля»: не хранят значение в data, служат только вёрстке. */
export const PRESENTATION_TYPES: readonly FieldType[] = ['section', 'note']

export function isPresentation(t: FieldType): boolean {
  return PRESENTATION_TYPES.includes(t)
}

/**
 * Системные поля записи (schema/system.go, владелец 17.10.2026 — как блок
 * «Системные» в Pyrus). Каждое — не больше одного на форму.
 */
export const SYSTEM_KEYS = [
  'author',
  'responsible',
  'created_at',
  'due',
  'form',
  // 06.11.2026: номер записи и «кто и когда менял последним» — вычисляемые.
  'number',
  'updated_at',
  'updated_by',
] as const

export type SystemKey = (typeof SYSTEM_KEYS)[number]

/** Тип, которым показывается системное поле (schema.systemTypes). */
export const SYSTEM_FIELD_TYPES: Record<SystemKey, FieldType> = {
  author: 'user',
  responsible: 'user',
  created_at: 'datetime',
  due: 'date',
  form: 'text',
  number: 'number',
  updated_at: 'datetime',
  updated_by: 'user',
}

/** Вычисляемые: значение из записи (автор, дата создания) и формы (название), в data не хранится. */
export const COMPUTED_SYSTEM_KEYS: readonly SystemKey[] = [
  'author',
  'created_at',
  'form',
  'number',
  'updated_at',
  'updated_by',
]

/** Поле заполняется само и в data его нет (schema.Field.IsComputed). */
export function isComputedField(f: { system?: SystemKey }): boolean {
  return f.system != null && COMPUTED_SYSTEM_KEYS.includes(f.system)
}

/** Типы, допустимые для КОЛОНОК таблицы (schema.tableColumnAllowedTypes). */
export const TABLE_COLUMN_TYPES: readonly FieldType[] = [
  'text',
  'number',
  'money',
  'date',
  'select',
  'checkbox',
  // 06.11.2026: ячейка рендерится тем же реестром, что и поле.
  'user',
  'catalog',
  'link',
  'rating',
  'percent',
  'duration',
  'date_range',
  'time',
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
  /** Нет подстроки / нет варианта. */
  | 'not_contains'
  /** В отрезке [от, до] включительно (числа и даты); value — пара. */
  | 'between'

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
  'not_contains',
  'between',
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
/** Вложенная группа — «скобки» в списке условий: «A и (B или C)». Внутри —
 *  только сравнения (вложенность — один уровень, как проверяет сервер). */
export interface NestedConditionGroup {
  all?: Condition[]
  any?: Condition[]
}

/** Элемент списка условий: сравнение или вложенная группа. */
export type ConditionItem = Condition | NestedConditionGroup

/** Элемент — вложенная группа (нет field). */
export function isNestedGroup(c: ConditionItem): c is NestedConditionGroup {
  return !('field' in c) || (c as Condition).field === undefined
}

export interface ConditionGroup {
  /** Название правила («Договор для крупных сделок») — только подпись. */
  name?: string
  all?: ConditionItem[]
  any?: ConditionItem[]
}

/**
 * Правило формы «Если when, то then» (conditions.Rule в forms-api): when
 * выполнено, а then нет — запись не сохраняется. При fill сравнения «=»
 * верхнего уровня then подставляются в поля («Наблюдатель = А»).
 */
export interface FormRule {
  id: string
  name: string
  when?: ConditionGroup
  then?: ConditionGroup
  fill?: boolean
}

/** Все сравнения группы, включая вложенные. */
export function conditionLeaves(g: ConditionGroup | null | undefined): Condition[] {
  const out: Condition[] = []
  for (const c of [...(g?.all ?? []), ...(g?.any ?? [])]) {
    if (isNestedGroup(c)) out.push(...(c.all ?? []), ...(c.any ?? []))
    else out.push(c)
  }
  return out
}

export interface SelectOption {
  value: string
  label: string
  /** Цвет варианта (ключ палитры SECTION_COLORS): светлый фон значения, цвет иконки. */
  color?: SectionColor
  /**
   * Иконка варианта — имя из библиотеки иконок хоста (как у иконки формы, напр.
   * «lucide:Flag»). Рисует её хост через RenderContext.OptionIcon; без него — не рисуется.
   */
  icon?: string
}

// Config — настройки, специфичные для типа. Бэкенд хранит их как opaque JSON
// и заглядывает только в нужные ключи; здесь то же самое: общий тип — словарь,
// типизированные срезы — для конкретных типов поля.
export type FieldConfig = Record<string, unknown>

export interface SelectConfig {
  options?: SelectOption[]
  /**
   * Варианты — из справочника с этим ключом, а не свои (`options`): справочник —
   * общий список значений полей-списков, переиспользуется в разных формах.
   */
  catalog_key?: string
}

/** Справочник, из которого поле берёт варианты: поле «Справочник» и списки с `catalog_key`. */
export function catalogKeyOf(field: Pick<Field, 'type' | 'config'>): string | undefined {
  if (field.type !== 'catalog' && field.type !== 'select' && field.type !== 'multiselect') return undefined
  return (field.config as SelectConfig | undefined)?.catalog_key || undefined
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
/**
 * Поле «Форма» (record_ref, schema.RecordRefConfig): ссылка на запись другой
 * формы. Значение — id записи, при multiple — список id. У формы-карточки
 * (проекты, лиды ОУП) id — это id сущности модуля.
 */
/** Поле «Оценка»: максимум звёзд 2..10 (schema.RatingConfig), без config — RATING_DEFAULT_MAX. */
export interface RatingConfig {
  max?: number
}
export const RATING_DEFAULT_MAX = 5
export const RATING_MIN_MAX = 2
export const RATING_MAX_MAX = 10
export function ratingMax(field: Pick<Field, 'config'>): number {
  const m = (field.config as RatingConfig | undefined)?.max
  return m && m > 0 ? m : RATING_DEFAULT_MAX
}
/** Значение поля «Период»: ГГГГ-ММ-ДД, start ≤ end. */
export interface DateRangeValue {
  start: string
  end: string
}
/** Значение поля «Адрес»: адрес текстом, координаты необязательны. */
export interface LocationValue {
  address: string
  lat?: number
  lon?: number
}
export interface RecordRefConfig {
  form_id?: string
  multiple?: boolean
}
/** Вариант поля «Форма» — запись формы-источника (её даёт хост). */
export interface RecordRefOption {
  value: string
  label: string
  /** Вторая строка: номер, статус, заказчик. */
  hint?: string
  /** Куда ведёт ссылка на запись. */
  href?: string
  /** Закрыта/удалена: показывается у уже выбранного, но в список не попадает. */
  inactive?: boolean
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

// ─── Форма-карточка (internal/schema/binding.go) ─────────────────────────
//
// Карточка записи чужого модуля (проект, лид, ФМ ОУП): форма описывает только
// СТРУКТУРУ, данные живут в модуле-владельце. См. wh24-forms-api
// docs/RECORD-CARDS.md.

/** native — своя колонка сущности (sys_*), custom — jsonb custom по id поля. */
export type FieldStorage = 'native' | 'custom'

/** Поле Pyrus, из которого вебхук ОУП пишет значение. */
export interface PyrusLink {
  field_id: number
}

export interface FieldBinding {
  storage: FieldStorage
  /** value_type реестра ОУП; пусто — по типу поля. */
  value_type?: string
  options_source?: 'manual' | 'staff' | 'department' | 'dict'
  options_ref?: string
  show_always?: boolean
  read_modules?: string[]
  write_modules?: string[]
  pyrus?: PyrusLink
}

export interface DocBinding {
  /** Модуль-хранилище (пока только oup). */
  system: string
  /** project, lead или id привязки Pyrus пользовательской категории (ФМ). */
  entity: string
  pyrus_form_id?: number
}

/** UNSECTIONED_ID — раздел «без раздела» (section_id NULL в ОУП). */
export const UNSECTIONED_ID = 'unsectioned'

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
  /** Обязательно, когда условие выполнено (и поле видно); при required не нужно. */
  required_if?: ConditionGroup
  /** Только у формы-карточки: где лежит значение. */
  binding?: FieldBinding
  /** Системное поле записи (автор, ответственный, дата создания, срок, форма). */
  system?: SystemKey
}

export interface Section {
  id: string
  title: string
  sort: number
  /** Цвет-метка секции (ключ палитры SECTION_COLORS); нет — без цвета. */
  color?: SectionColor
}

/** Палитра цветов секции (15, по кругу оттенков). Ключи хранит сервер (forms-api SectionColors), оттенки — здесь. */
export const SECTION_COLORS = [
  { key: 'red', label: 'Красный', hex: '#e5484d' },
  { key: 'orange', label: 'Оранжевый', hex: '#ef6c1a' },
  { key: 'brown', label: 'Коричневый', hex: '#ad7f58' },
  { key: 'yellow', label: 'Жёлтый', hex: '#d9a21b' },
  { key: 'lime', label: 'Салатовый', hex: '#84b52d' },
  { key: 'green', label: 'Зелёный', hex: '#30a46c' },
  { key: 'teal', label: 'Бирюзовый', hex: '#12a594' },
  { key: 'cyan', label: 'Голубой', hex: '#00a2c7' },
  { key: 'blue', label: 'Синий', hex: '#0090ff' },
  { key: 'indigo', label: 'Индиго', hex: '#3e63dd' },
  { key: 'violet', label: 'Фиолетовый', hex: '#8e4ec6' },
  { key: 'plum', label: 'Сливовый', hex: '#ab4aba' },
  { key: 'pink', label: 'Розовый', hex: '#d6409f' },
  { key: 'crimson', label: 'Малиновый', hex: '#e93d82' },
  { key: 'gray', label: 'Серый', hex: '#8b8d98' },
] as const

export type SectionColor = (typeof SECTION_COLORS)[number]['key']

/** HEX цвета секции; неизвестный ключ или пусто — undefined (секция без цвета). */
export function sectionColorHex(key: string | undefined): string | undefined {
  return SECTION_COLORS.find((c) => c.key === key)?.hex
}

export interface SchemaDocument {
  schema_version: number
  /** id поля, дающего название записи. */
  title_field: string
  sections: Section[]
  fields: Field[]
  /** Только у формы-карточки: с какой сущностью какого модуля связана форма. */
  binding?: DocBinding
  /** Правила формы «если …, то …». */
  rules?: FormRule[]
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
  /** internal — записи в «Формах»; external — форма-карточка, данные в модуле. */
  data_source?: 'internal' | 'external'
  /**
   * Чат (лента) записи: true — карточка записи с лентой обсуждения и
   * согласования, false — только форма. Нет поля (старый сервис) — как true.
   */
  chat_enabled?: boolean
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
  /** Файл приложен к сообщению ленты (field_id тогда пуст). */
  comment_id?: string
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
  /** Учётка IAM сотрудника: по ней системное поле «Автор» (created_by) находит человека. */
  auth_user_id?: string
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
  | 'max_rows'
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

// ─── Лента записи (панель комментария как в Pyrus) ───────────────────────────

/** Решение согласующего; `revoked` — отзыв своего решения. */
export type ApprovalChoice = 'approved' | 'acknowledged' | 'rejected' | 'revoked'

export interface ValueChange {
  field_id: string
  from: unknown
  to: unknown
}

export interface Meeting {
  title: string
  /** RFC3339. */
  starts_at: string
  ends_at: string
  url: string
}

/** Что сделано сообщением кроме текста и файлов. */
export interface CommentActions {
  approval?: { step_id: string; step_name: string; choice: ApprovalChoice; approver: string }
  responsible?: ValueChange
  due?: ValueChange
  spent_minutes?: number
  meeting?: Meeting
  /** Упомянутые сотрудники (id HR). */
  mentions?: string[]
}

export interface RecordComment {
  id: string
  record_id: string
  /** Учётка IAM автора (как created_by записи). */
  author: string
  /** Текст с лёгкой разметкой: **жирный**, _курсив_, ~~зачёркнутый~~, `код`, «- » списки. */
  body: string
  reply_to: string | null
  actions: CommentActions
  created_at: string
  files: FormFile[]
}

export type RouteStepState = 'passed' | 'current' | 'rejected' | 'pending'

export interface RouteApprover {
  staff_id: string
  /** Пусто — ещё не решал. */
  choice: '' | Exclude<ApprovalChoice, 'revoked'>
  decided_at: string | null
  /** Это вызывающий: за него можно решать. */
  mine: boolean
}

export interface RecordRouteStep {
  id: string
  name: string
  state: RouteStepState
  approvers: RouteApprover[]
}

export interface RecordRoute {
  steps: RecordRouteStep[]
  current_step_id: string | null
  finished: boolean
}

export interface RecordFeed {
  comments: RecordComment[]
  route: RecordRoute
  /** «На контроле» у вызывающего. */
  watching: boolean
  /** id системных полей, которые правит лента; пусто — у формы такого поля нет. */
  fields: { responsible: string; due: string }
  /** Справочник HR недоступен: решения и уведомления сейчас не работают. */
  staff_unavailable?: boolean
}

/** Этап маршрута формы (настройка). */
export interface FormRouteStep {
  id: string
  form_id?: string
  position?: number
  name: string
  /** id сотрудников HR. */
  approvers: string[]
}

/** Сообщение ленты: всё, кроме body, необязательно. */
export interface NewComment {
  body?: string
  reply_to?: string
  mentions?: string[]
  approval?: { step_id: string; choice: ApprovalChoice }
  /** id сотрудника; '' — снять ответственного. */
  responsible?: string
  /** ГГГГ-ММ-ДД; '' — снять срок. */
  due?: string
  spent_minutes?: number
  meeting?: Meeting
  files?: File[]
}
