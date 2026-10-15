/**
 * Сопоставление поля формы-карточки с полем Pyrus (решение владельца
 * 15.10.2026: поле заводится в конструкторе и там же сопоставляется с полем
 * Pyrus, публикация пишет карту вебхука ОУП).
 *
 * Правила совместимости — копия wh24-forms-api `internal/cardimport/mapping.go`
 * (`PyrusCompat`), а те — правил вебхука wowhaus-api (`internal/pyrus`
 * checkCustomType / builtinCompatible). Правка — во всех трёх местах сразу.
 */
import type { Field } from './types.js'

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
  }
  return `тип Pyrus «${t}» не подходит полю «${f.type}»`
}
