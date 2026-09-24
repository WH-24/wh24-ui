/**
 * Форматирование значений полей для чтения: карточка (view), колонки списка,
 * история «было → стало». Одно место, чтобы «3 200 000 ₽» в списке и в
 * карточке выглядело одинаково.
 */
import type { Field, FormFile, MoneyConfig, OrgOption, SelectConfig, SelectOption } from '../types.js'
import type { FormCatalog } from '../api.js'

export interface FormatContext {
  staff?: OrgOption[]
  departments?: OrgOption[]
  /** catalog_key → варианты. */
  catalogs?: Record<string, SelectOption[]>
  /** id вложения → метаданные. */
  filesById?: Record<string, FormFile>
}

const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 })

/** ru-RU с неразрывными пробелами между разрядами: движки отдают то U+00A0,
 *  то узкий U+202F — приводим к одному, чтобы «3 200 000» не зависело от
 *  браузера и не переносилось посреди числа. */
export function formatNumber(n: number): string {
  return nf.format(n).replace(/[\u202f\u2009 ]/g, '\u00a0')
}

const CURRENCY_SIGN: Record<string, string> = { RUB: '₽', USD: '$', EUR: '€' }

export function currencySign(code?: string): string {
  if (!code) return '₽'
  return CURRENCY_SIGN[code.toUpperCase()] ?? code
}

export function formatMoney(n: number, currency?: string): string {
  return `${formatNumber(n)}\u00a0${currencySign(currency)}`
}

/** ISO yyyy-mm-dd → дд.мм.гггг. Не дата — как есть. */
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso
}

/** RFC 3339 → дд.мм.гггг, ЧЧ:ММ в локальной зоне. Не дата — как есть. */
export function formatDateTime(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  const d = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} КБ`
  return `${bytes} Б`
}

export function fileExt(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i + 1).toUpperCase().slice(0, 4) : 'FILE'
}

/** Инициалы: первые буквы 1–2 слов. */
export function initials(name: string): string {
  const w = name
    .replace(/[«»"'()]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!w.length) return '?'
  return (w[0]![0]! + (w[1]?.[0] ?? '')).toUpperCase()
}

/** Варианты поля select/multiselect/catalog. */
export function fieldOptions(field: Field, ctx: FormatContext): SelectOption[] {
  if (field.type === 'catalog') {
    const key = (field.config as { catalog_key?: string } | undefined)?.catalog_key
    return (key && ctx.catalogs?.[key]) || []
  }
  return (field.config as SelectConfig | undefined)?.options ?? []
}

/** Подпись значения по справочнику (select/catalog/user/department); без
 *  справочника — само значение, а не пустота: устаревшее лучше пустого. */
export function optionLabel(field: Field, value: string, ctx: FormatContext): string {
  if (field.type === 'user' || field.type === 'department') {
    const list = field.type === 'user' ? ctx.staff : ctx.departments
    return list?.find((o) => o.id === value)?.label ?? value
  }
  return fieldOptions(field, ctx).find((o) => o.value === value)?.label ?? value
}

export function isNumericType(t: Field['type']): boolean {
  return t === 'number' || t === 'money'
}

/** Пусто с точки зрения показа: null, '', [], {}. */
export function isBlank(v: unknown): boolean {
  if (v == null) return true
  if (typeof v === 'string') return v.trim() === ''
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === 'object') return Object.keys(v as object).length === 0
  return false
}

/**
 * Текстовое представление значения — для списка, истории и CSV на клиенте.
 * Пусто → '—'. Таблица → «N строк», файлы → «N файлов».
 */
export function formatValue(field: Field, value: unknown, ctx: FormatContext = {}): string {
  if (isBlank(value)) return '—'
  switch (field.type) {
    case 'number':
      return typeof value === 'number' ? formatNumber(value) : String(value)
    case 'money':
      return typeof value === 'number'
        ? formatMoney(value, (field.config as MoneyConfig | undefined)?.currency)
        : String(value)
    case 'date':
      return typeof value === 'string' ? formatDate(value) : String(value)
    case 'datetime':
      return typeof value === 'string' ? formatDateTime(value) : String(value)
    case 'checkbox':
      return value === true ? 'Да' : '—'
    case 'select':
    case 'catalog':
    case 'user':
    case 'department':
      return typeof value === 'string' ? optionLabel(field, value, ctx) : String(value)
    case 'multiselect':
      return Array.isArray(value)
        ? value.map((v) => optionLabel(field, String(v), ctx)).join(', ')
        : String(value)
    case 'file': {
      const n = Array.isArray(value) ? value.length : 0
      return plural(n, 'файл', 'файла', 'файлов')
    }
    case 'table': {
      const n = Array.isArray(value) ? value.length : 0
      return plural(n, 'строка', 'строки', 'строк')
    }
    default:
      return typeof value === 'string' ? value : JSON.stringify(value)
  }
}

export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  const word =
    mod10 === 1 && mod100 !== 11
      ? one
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)
        ? few
        : many
  return `${formatNumber(n)}\u00a0${word}`
}

/** Опции поля catalog из справочника: значение — id строки (так проверяет бэкенд), подпись — display_column. */
export function catalogOptions(cat: FormCatalog): SelectOption[] {
  return cat.items.map((it) => {
    const raw = it.values[cat.display_column]
    const label = raw == null || raw === '' ? it.id : String(raw)
    return { value: it.id, label }
  })
}

/** catalog_key → опции, для FormatContext.catalogs. */
export function catalogsToContext(cats: FormCatalog[]): Record<string, SelectOption[]> {
  return Object.fromEntries(cats.map((c) => [c.key, catalogOptions(c)]))
}
