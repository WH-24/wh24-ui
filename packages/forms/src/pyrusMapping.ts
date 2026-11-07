/**
 * Сопоставление поля формы с полем Pyrus — у любой формы (решение владельца
 * 07.11.2026; до этого — только у карточек ОУП, 15.10.2026). Связь: форма —
 * `doc.pyrus.form_id`, поле — `field.pyrus.field_id`.
 *
 * Правила совместимости — копия wh24-forms-api `internal/cardimport/mapping.go`
 * (`PyrusCompat`), а те — правил вебхука wowhaus-api (`internal/pyrus`
 * checkCustomType / builtinCompatible). Правка — во всех трёх местах сразу.
 */
import type { Field, SchemaDocument } from './types.js'

/** Узел схемы формы Pyrus из зеркала (`GET /pyrus/api/v1/forms/{id}/schema`). */
export interface PyrusSchemaField {
  field_id: number
  name: string
  type: string
  required_step?: number | null
  deleted?: boolean
  info?: unknown
  children?: PyrusSchemaField[]
}

export interface FlatPyrusField {
  field_id: number
  name: string
  type: string
  required_step: number | null
  deleted: boolean
  /** Тип родителя (группа `title`, таблица `table`); пусто — верхний уровень. */
  parent_type: string
  /** Название родителя — подпись группы в списке. */
  parent_name: string
}

/** Штатные поля, которые вебхук наполняет из Pyrus (ключ без `sys_`). */
export const BUILTIN_PYRUS_FIELDS: readonly string[] = [
  'name',
  'type',
  'category',
  'work_kind',
  'stage',
  'subcategory',
  'folder_url',
  'client',
  'address',
  'budget',
  'starts_on',
  'ends_on',
  'description',
  'status',
]

export function isPyrusPersonType(t: string): boolean {
  return t === 'person' || t === 'author' || t === 'fio'
}

/** У поля Pyrus нет одного значения, которое вебхук прочитает. */
export function isPyrusValuelessType(t: string): boolean {
  return ['title', 'table', 'note', 'file', 'form_link', 'step', 'status', 'project', 'signature'].includes(t)
}

const isDate = (t: string) => ['date', 'due_date', 'due_date_time', 'creation_date'].includes(t)
const isNumber = (t: string) => t === 'number' || t === 'money'

function hasYesNo(f: Field): boolean {
  const opts = (f.config?.options as { value?: string; label?: string }[] | undefined) ?? []
  const vals = opts.flatMap((o) => [o.value ?? '', o.label ?? '']).map((v) => v.trim().toLowerCase())
  return vals.includes('да') && vals.includes('нет')
}

/** Дерево схемы Pyrus — плоским списком, родители раньше детей. */
export function flattenPyrusFields(fields: PyrusSchemaField[] | null | undefined): FlatPyrusField[] {
  const out: FlatPyrusField[] = []
  const walk = (list: PyrusSchemaField[], parentType: string, parentName: string) => {
    for (const f of list) {
      out.push({
        field_id: f.field_id,
        name: f.name,
        type: f.type,
        required_step: f.required_step ?? null,
        deleted: !!f.deleted,
        parent_type: parentType,
        parent_name: parentName,
      })
      walk(f.children ?? [], f.type, f.name)
    }
  }
  walk(fields ?? [], '', '')
  return out
}

/**
 * Можно ли писать поле Pyrus `p` в поле карточки `f`. `null` — можно, иначе —
 * причина по-русски (для подсказки в списке).
 */
export function pyrusCompat(f: Field, p: Pick<FlatPyrusField, 'type' | 'deleted' | 'parent_type'>): string | null {
  const t = p.type
  if (p.deleted) return 'поле удалено в Pyrus'
  if (p.parent_type === 'table') return 'колонка таблицы Pyrus — строки таблиц вебхук не читает'
  if (isPyrusPersonType(t)) return 'человека из Pyrus переносит цель «сотрудник» в «Интеграции Pyrus»'
  if (isPyrusValuelessType(t)) return 'у поля Pyrus этого типа нет одного значения'
  if (f.binding?.storage === 'native') {
    const name = f.key.startsWith('sys_') ? f.key.slice(4) : ''
    if (!name || !BUILTIN_PYRUS_FIELDS.includes(name)) return 'это штатное поле Pyrus не наполняет'
    if ((name === 'starts_on' || name === 'ends_on') && !isDate(t)) return 'нужна дата Pyrus'
    if (name === 'budget' && !isNumber(t) && t !== 'text') return 'нужно число, сумма или текст Pyrus'
    if (name === 'status' && !['multiple_choice', 'catalog', 'text'].includes(t))
      return 'нужен выбор, справочник или текст Pyrus'
    return null
  }
  switch (f.type) {
    case 'text':
    case 'textarea':
    case 'email':
      return null
    case 'phone':
    case 'link':
      if (['text', 'phone', 'email'].includes(t)) return null
      break
    case 'number':
    case 'money':
      if (isNumber(t)) return null
      break
    case 'date':
    case 'datetime':
      if (isDate(t)) return null
      break
    case 'checkbox':
      if (t === 'checkmark' || t === 'multiple_choice') return null
      break
    case 'select':
    case 'multiselect':
      if (['multiple_choice', 'catalog', 'text'].includes(t)) return null
      if (t === 'checkmark')
        return hasYesNo(f) ? null : 'галочка Pyrus пишется вариантом «Да»/«Нет» — добавьте такие варианты'
      break
    case 'user':
    case 'department':
      return 'сотрудника и отдел из Pyrus переносит цель «сотрудник» в «Интеграции Pyrus»'
    case 'contact':
      return 'контакты выбираются из реестра ОУП, из Pyrus их не перенести'
  }
  return `тип Pyrus «${t}» не подходит полю «${f.type}»`
}

/** Структура формы Pyrus из `GET /admin/forms/:id/pyrus-schema`. */
export interface PyrusFormSchema {
  form_id: number
  name: string
  fields: PyrusSchemaField[]
  steps?: { step: number; name: string }[]
}

export const PYRUS_TYPE_LABEL: Record<string, string> = {
  text: 'Текст',
  multiple_choice: 'Выбор',
  catalog: 'Справочник',
  checkmark: 'Галочка',
  date: 'Дата',
  due_date: 'Срок',
  due_date_time: 'Срок со временем',
  creation_date: 'Дата создания',
  number: 'Число',
  money: 'Сумма',
  phone: 'Телефон',
  email: 'Почта',
  person: 'Человек',
  author: 'Автор',
  file: 'Файл',
  title: 'Группа',
  table: 'Таблица',
  form_link: 'Связь с задачей',
  note: 'Примечание',
  step: 'Этап',
  status: 'Статус',
}

export const pyrusTypeLabel = (t: string): string => PYRUS_TYPE_LABEL[t] ?? t

export interface PyrusOption {
  field: FlatPyrusField
  /** «Тип · обязательно с этапа «…»» — подсказка в списке. */
  hint: string
}

export interface PyrusUnavailable {
  field: FlatPyrusField
  reason: string
}

/** Поля формы, уже связанные с полями Pyrus (кроме `exceptId`, без архивных). */
export function takenPyrusFields(doc: SchemaDocument, exceptId: string): Map<number, Field> {
  const out = new Map<number, Field>()
  for (const f of doc.fields) {
    const id = f.pyrus?.field_id
    if (id && f.id !== exceptId && !f.archived) out.set(id, f)
  }
  return out
}

export function pyrusStepName(steps: { step: number; name: string }[] | undefined, n: number): string {
  const s = steps?.find((x) => x.step === n)
  return s?.name ? `«${s.name}»` : String(n)
}

/** Поле Pyrus по id в дереве схемы (вместе с вложенными). */
export function findPyrusField(schema: PyrusFormSchema | null | undefined, id: number): FlatPyrusField | null {
  if (!schema) return null
  return flattenPyrusFields(schema.fields).find((f) => f.field_id === id) ?? null
}

/**
 * Список выбора «Поле Pyrus» для поля формы: подходящие и свободные поля
 * Pyrus — в `options` (тип и этап обязательности в подсказке), остальные — в
 * `unavailable` с причиной. Группы и таблицы сами не выбираются.
 */
export function pyrusChoices(
  doc: SchemaDocument,
  field: Field,
  schema: Pick<PyrusFormSchema, 'fields' | 'steps'>,
): { options: PyrusOption[]; unavailable: PyrusUnavailable[] } {
  const taken = takenPyrusFields(doc, field.id)
  const options: PyrusOption[] = []
  const unavailable: PyrusUnavailable[] = []
  for (const p of flattenPyrusFields(schema.fields)) {
    if (p.type === 'title' || p.type === 'table') continue
    const owner = taken.get(p.field_id)
    const reason = owner ? `уже сопоставлено с полем «${owner.label || owner.key}»` : pyrusCompat(field, p)
    if (reason) {
      if (!p.deleted) unavailable.push({ field: p, reason })
      continue
    }
    const parts = [pyrusTypeLabel(p.type)]
    if (p.required_step != null) parts.push(`обязательно с этапа ${pyrusStepName(schema.steps, p.required_step)}`)
    options.push({ field: p, hint: parts.join(' · ') })
  }
  return { options, unavailable }
}

/**
 * Документ без связи с Pyrus: форма отвязана — связи полей снимаются вместе с
 * ней (сервер не примет поле, связанное с полем Pyrus без формы Pyrus).
 */
export function withoutPyrus(doc: SchemaDocument): SchemaDocument {
  const { pyrus: _drop, ...rest } = doc
  return {
    ...rest,
    fields: doc.fields.map((f) => {
      if (!f.pyrus) return f
      const { pyrus: _p, ...field } = f
      return field
    }),
  }
}
