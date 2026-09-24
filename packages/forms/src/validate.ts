/**
 * Проверка ЗНАЧЕНИЙ записи против схемы — порт wh24-forms-api/internal/validate.
 *
 * На фронте это предпроверка перед отправкой: те же коды и те же русские
 * сообщения, что вернёт бэкенд, чтобы пользователь увидел ошибки до похода на
 * сервер и ровно те же — после. Бэкенд остаётся источником истины (он ещё
 * проверяет принадлежность справочнику — сюда это не портировано: у фронта нет
 * содержимого справочника).
 *
 * Правила, унаследованные от плана:
 *  - обязательность СКРЫТОГО (visible_if) поля не нарушается — видимость
 *    считает только conditions/evaluate, второй реализации быть не должно;
 *  - ошибки списком, а не первой попавшейся;
 *  - архивное поле со значением ошибкой не считается.
 */
import { evaluate } from './conditions/conditions.js'
import type {
  Field,
  FileConfig,
  NumberConfig,
  RecordData,
  RecordFieldError,
  SchemaDocument,
  SelectConfig,
  TableColumn,
  TableConfig,
  TextConfig,
} from './types.js'
import { isPresentation } from './types.js'

function cfg<T>(f: Pick<Field, 'config'>): T {
  return (f.config ?? {}) as T
}

function label(f: Pick<Field, 'label' | 'key'>): string {
  return f.label || f.key
}

/** Пусто: null/undefined, пробельная строка, пустой массив/объект. */
export function isEmpty(v: unknown): boolean {
  if (v == null) return true
  if (typeof v === 'string') return v.trim() === ''
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === 'object') return Object.keys(v as object).length === 0
  return false
}

function typeErr(f: Pick<Field, 'id' | 'label' | 'key'>, want: string): RecordFieldError {
  return { field_id: f.id, code: 'type', message: `поле «${label(f)}»: ожидается ${want}` }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
// RFC 3339: дата, T, время с секундами, опционально доли, зона Z или ±hh:mm.
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

function validDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/**
 * Проверка записи. Возвращает СПИСОК ошибок (пустой — можно отправлять).
 */
export function validateRecord(
  doc: SchemaDocument,
  data: RecordData | null | undefined,
): RecordFieldError[] {
  const values: RecordData = data ?? {}
  const byId = new Map<string, Field>()
  for (const f of doc.fields) {
    if (isPresentation(f.type)) continue
    byId.set(f.id, f)
  }

  const errs: RecordFieldError[] = []
  for (const id of Object.keys(values)) {
    if (!byId.has(id)) {
      errs.push({
        field_id: id,
        code: 'unknown_field',
        message: 'поля с таким идентификатором нет в схеме этой версии формы',
      })
    }
  }

  for (const f of doc.fields) {
    if (isPresentation(f.type) || f.archived) continue
    let visible = true
    try {
      visible = evaluate(f.visible_if, values)
    } catch {
      // Невычислимое условие не должно превращаться в «поле обязательно»:
      // считаем видимым и проверяем значение как обычно.
      visible = true
    }
    const present = Object.prototype.hasOwnProperty.call(values, f.id)
    const value = values[f.id]
    if (!present || isEmpty(value)) {
      if (f.required && visible) {
        errs.push({
          field_id: f.id,
          code: 'required',
          message: `поле «${label(f)}» обязательно для заполнения`,
        })
      }
      continue
    }
    errs.push(...checkValue(f, value))
  }
  return errs
}

function checkValue(f: Field, value: unknown): RecordFieldError[] {
  switch (f.type) {
    case 'text':
    case 'textarea': {
      if (typeof value !== 'string') return [typeErr(f, 'текст')]
      const c = cfg<TextConfig>(f)
      if (c.max_length != null && Array.from(value).length > c.max_length) {
        return [
          {
            field_id: f.id,
            code: 'max_length',
            message: `поле «${label(f)}»: не длиннее ${c.max_length} символов`,
          },
        ]
      }
      return []
    }
    case 'number':
    case 'money': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return [typeErr(f, 'число')]
      const c = cfg<NumberConfig>(f)
      if (c.min != null && value < c.min) {
        return [{ field_id: f.id, code: 'min', message: `поле «${label(f)}»: не меньше ${c.min}` }]
      }
      if (c.max != null && value > c.max) {
        return [{ field_id: f.id, code: 'max', message: `поле «${label(f)}»: не больше ${c.max}` }]
      }
      return []
    }
    case 'date':
      if (typeof value !== 'string' || !validDate(value)) {
        return [typeErr(f, 'дата в формате ГГГГ-ММ-ДД')]
      }
      return []
    case 'datetime':
      if (typeof value !== 'string' || !RFC3339.test(value) || Number.isNaN(Date.parse(value))) {
        return [typeErr(f, 'дата и время в формате RFC 3339')]
      }
      return []
    case 'checkbox':
      return typeof value === 'boolean' ? [] : [typeErr(f, 'да/нет')]
    case 'email': {
      if (typeof value !== 'string') return [typeErr(f, 'адрес почты')]
      // net/mail.ParseAddress мягче RFC-полного regexp: достаточно «что-то@домен».
      if (!/^[^\s@]+@[^\s@]+$/.test(value.trim())) {
        return [
          {
            field_id: f.id,
            code: 'format',
            message: `поле «${label(f)}»: непохоже на адрес почты`,
          },
        ]
      }
      return []
    }
    case 'phone': {
      if (typeof value !== 'string') return [typeErr(f, 'номер телефона')]
      if (!/\d/.test(value)) {
        return [
          {
            field_id: f.id,
            code: 'format',
            message: `поле «${label(f)}»: в номере телефона нет ни одной цифры`,
          },
        ]
      }
      return []
    }
    case 'link': {
      if (typeof value !== 'string') return [typeErr(f, 'ссылка')]
      // Только http(s): new URL принимает и javascript://host/%0a…, и data:, и
      // file: — такая «ссылка» хранилась бы в записи и уходила бы в письма,
      // уведомления и любой не-React рендер как рабочий XSS/фишинг.
      let ok = false
      try {
        const u = new URL(value)
        ok = (u.protocol === 'http:' || u.protocol === 'https:') && u.host !== ''
      } catch {
        ok = false
      }
      if (!ok) {
        return [
          {
            field_id: f.id,
            code: 'format',
            message: `поле «${label(f)}»: ссылка должна быть вида https://…`,
          },
        ]
      }
      return []
    }
    case 'select':
      if (typeof value !== 'string') return [typeErr(f, 'одно значение из списка')]
      return optionErrs(f, [value])
    case 'multiselect': {
      const items = toStringArray(value)
      if (!items) return [typeErr(f, 'список значений')]
      return optionErrs(f, items)
    }
    case 'catalog':
      // Принадлежность справочнику проверяет бэкенд (у него содержимое).
      return typeof value === 'string' ? [] : [typeErr(f, 'значение справочника')]
    case 'user':
    case 'department':
      return typeof value === 'string' ? [] : [typeErr(f, 'идентификатор из справочника платформы')]
    case 'file': {
      const items = toStringArray(value)
      if (!items) return [typeErr(f, 'список файлов')]
      const c = cfg<FileConfig>(f)
      if (c.max_files != null && items.length > c.max_files) {
        return [
          {
            field_id: f.id,
            code: 'max_files',
            message: `поле «${label(f)}»: не больше ${c.max_files} файлов`,
          },
        ]
      }
      return []
    }
    case 'table':
      return checkTable(f, value)
    default:
      return []
  }
}

function colLabel(c: TableColumn): string {
  return c.label || c.key
}

/** Строки таблицы: неизвестные колонки и типы ячеек. Вложенных таблиц в v1 нет,
 *  поэтому ячейка проверяется тем же checkValue, что и обычное поле. */
function checkTable(f: Field, value: unknown): RecordFieldError[] {
  if (!Array.isArray(value)) return [typeErr(f, 'строки таблицы')]
  const maxRows = cfg<TableConfig>(f).max_rows
  if (maxRows != null && value.length > maxRows) {
    return [
      {
        field_id: f.id,
        code: 'max_rows',
        message: `поле «${label(f)}»: не больше ${maxRows} строк`,
      },
    ]
  }
  const cols = cfg<TableConfig>(f).columns ?? []
  const byId = new Map(cols.map((c) => [c.id, c]))
  const errs: RecordFieldError[] = []
  value.forEach((raw, i) => {
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
      errs.push({
        field_id: f.id,
        code: 'type',
        message: `поле «${label(f)}», строка ${i + 1}: ожидается набор значений колонок`,
      })
      return
    }
    for (const [colId, cell] of Object.entries(raw as Record<string, unknown>)) {
      const col = byId.get(colId)
      if (!col) {
        errs.push({
          field_id: f.id,
          code: 'unknown_column',
          message: `поле «${label(f)}», строка ${i + 1}: колонки "${colId}" нет в схеме`,
        })
        continue
      }
      if (isEmpty(cell)) continue
      const pseudo: Field = {
        id: f.id,
        key: col.key,
        label: `${label(f)} → ${colLabel(col)} (строка ${i + 1})`,
        type: col.type,
        section_id: f.section_id,
        span: 12,
        required: false,
        show_in_list: false,
        filterable: false,
        archived: false,
      }
      errs.push(...checkValue(pseudo, cell))
    }
  })
  return errs
}

function optionErrs(f: Field, values: string[]): RecordFieldError[] {
  const opts = cfg<SelectConfig>(f).options ?? []
  if (opts.length === 0) return []
  const allowed = new Set(opts.map((o) => o.value))
  const errs: RecordFieldError[] = []
  for (const v of values) {
    if (!allowed.has(v)) {
      errs.push({
        field_id: f.id,
        code: 'not_in_options',
        message: `поле «${label(f)}»: значения «${v}» нет среди вариантов`,
      })
    }
  }
  return errs
}

function toStringArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null
  return v.every((x) => typeof x === 'string') ? (v as string[]) : null
}
