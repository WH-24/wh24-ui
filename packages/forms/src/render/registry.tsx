/**
 * Реестр контролов по типу поля: для каждого из 17 типов данных (+ секция и
 * пояснение) — как редактировать (Edit) и как показывать (View). FormRenderer
 * и превью редактора схемы рисуют поля только через него; второй раскладки
 * «тип → контрол» в пакете быть не должно.
 *
 * Контролы — примитивы @wowhaus-24/ui-react (Input/Combobox/DateField/…):
 * никаких нативных <select>/<input type=date> — вид поля одинаков во всех
 * модулях.
 */
import { useEffect, useId, useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from 'react'
import {
  Combobox,
  DateField,
  FileDrop,
  Icon,
  Input,
  MultiCombobox,
  OptionMarker,
  StaticValue,
  Textarea,
  type ComboboxOption,
  type FileDropItem,
} from '@wowhaus-24/ui-react'

import type {
  DateRangeValue,
  Field,
  FieldType,
  FileConfig,
  LocationValue,
  FormFile,
  MoneyConfig,
  NumberConfig,
  OrgOption,
  RecordRefConfig,
  RecordRefOption,
  SelectOption,
  TableColumn,
  TableConfig,
  TextConfig,
} from '../types.js'
import { SECTION_COLORS, formulaResultField, lookupTargetField, ratingMax, sectionColorHex } from '../types.js'
import {
  currencySign,
  fieldOptions,
  fileExt,
  formatDate,
  formatDateTime,
  formatDuration,
  formatMoney,
  formatNumber,
  formatSize,
  formatValue,
  initials,
  isBlank,
  optionLabel,
  type FormatContext,
} from './format.js'
import styles from './render.module.css'

export type RenderMode = 'view' | 'edit'

/** Всё, что контролам нужно от хоста: справочники и операции с файлами. */
export interface RenderContext extends FormatContext {
  /** Загрузить выбранные файлы в поле (карточка записи: сразу в S3). */
  onUploadFiles?: (field: Field, files: File[]) => void
  onRemoveFile?: (field: Field, fileId: string) => void
  /** Открыть вложение (получить presigned-URL и перейти). */
  onOpenFile?: (field: Field, fileId: string) => void
  /**
   * Выбор контактов реестра ОУП для поля «Контакт»: карточки, поиск, создание.
   * Реестр живёт в портале, не здесь — без этого компонента поле только
   * показывает число контактов и просит открыть запись в портале.
   */
  ContactsControl?: ComponentType<ContactsControlProps>
  /**
   * Иконка варианта поля «Выбор» по имени (SelectOption.icon): библиотека иконок
   * у хоста. Нет — варианты показываются без иконок (цвет остаётся).
   */
  OptionIcon?: ComponentType<{ name: string; size?: number }>
  /**
   * Подсказки поля «Теги»: уже использованные значения этого поля (API
   * /forms/:id/fields/:field_id/tags?q=). Нет — свободный ввод без подсказок.
   */
  loadTags?: (field: Field, q: string) => Promise<string[]>
}

/** Что хост получает от поля «Контакт». */
export interface ContactsControlProps {
  /** id выбранных контактов. */
  value: string[]
  onChange: (ids: string[]) => void
  /** Просмотр без правки. */
  readOnly?: boolean
  /** id контрола для <label htmlFor>. */
  id?: string
  /** Подпись поля — для доступных имён кнопок. */
  label?: string
  invalid?: boolean
}

export interface FieldRenderProps {
  field: Field
  value: unknown
  onChange: (value: unknown) => void
  /** id контрола для <label htmlFor>. */
  id: string
  invalid?: boolean
  disabled?: boolean
  ctx: RenderContext
  /** Доступное имя контрола, когда <label> рядом нет (ячейка таблицы). */
  ariaLabel?: string
}

export interface FieldRenderer {
  Edit: ComponentType<FieldRenderProps>
  View: ComponentType<FieldRenderProps>
  /** Числовые типы выравниваются вправо (список, таблица). */
  align?: 'left' | 'right'
}

// ─── Общие кусочки ──────────────────────────────────────────────────────

function optionIcon(o: SelectOption, ctx: RenderContext, size = 14): ReactNode {
  const OptionIcon = ctx.OptionIcon
  return o.icon && OptionIcon ? <OptionIcon name={o.icon} size={size} /> : undefined
}

function toComboOptions(opts: SelectOption[], ctx: RenderContext): ComboboxOption[] {
  return opts.map((o) => ({
    value: o.value,
    label: o.label,
    color: sectionColorHex(o.color),
    icon: optionIcon(o, ctx),
  }))
}

/** Значение варианта в просмотре: чип с иконкой и светлым фоном цвета варианта. */
function OptionChip({ field, value, ctx }: { field: Field; value: string; ctx: RenderContext }) {
  const opt = fieldOptions(field, ctx).find((o) => o.value === value)
  const color = sectionColorHex(opt?.color)
  const icon = opt ? optionIcon(opt, ctx, 13) : undefined
  return (
    <span
      className={styles.chip}
      style={color ? ({ '--chip-color': color } as CSSProperties) : undefined}
      data-color={color ? '' : undefined}
    >
      {icon && <OptionMarker icon={icon} color={color} />}
      {optionLabel(field, value, ctx)}
    </span>
  )
}

/** У варианта поля есть цвет или иконка — показываем значение чипом. */
function hasMarkedOptions(field: Field, ctx: RenderContext): boolean {
  return fieldOptions(field, ctx).some((o) => o.color || (o.icon && ctx.OptionIcon))
}

function orgOptions(list: OrgOption[] | undefined, withAvatar: boolean): ComboboxOption[] {
  return (list ?? []).map((o) => ({
    value: o.id,
    label: o.label,
    hint: o.hint ?? null,
    ...(withAvatar ? { avatar: null } : {}),
  }))
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v)
}

/** Текст → число или undefined (пусто). Нечисловой текст остаётся текстом:
 *  валидатор скажет «ожидается число», а не молча выкинет ввод. */
function parseNumber(raw: string): unknown {
  const s = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (s === '') return undefined
  const n = Number(s)
  return Number.isFinite(n) && /^-?\d*\.?\d*$/.test(s) ? n : raw
}

function numberText(v: unknown): string {
  if (typeof v === 'number') return String(v).replace('.', ',')
  return str(v)
}

const TextView: ComponentType<FieldRenderProps> = ({ field, value, ctx }) => (
  <StaticValue>{formatValue(field, value, ctx)}</StaticValue>
)

const NumView: ComponentType<FieldRenderProps> = ({ field, value, ctx }) => (
  <StaticValue className={styles.num}>{formatValue(field, value, ctx)}</StaticValue>
)

/**
 * Числовое поле с суффиксом (₽, %). Текст ввода живёт локально: контролируемый
 * round-trip через число съедал бы разделитель дробной части («12,» → 12 →
 * «12»), и набрать 12,5 было бы невозможно. Значение наружу — число или
 * undefined; нечисловой текст уходит как есть (валидатор скажет «ожидается
 * число»).
 */
function SuffixInput({
  id,
  value,
  onChange,
  suffix,
  invalid,
  disabled,
  placeholder,
  ariaLabel,
}: {
  id: string
  value: unknown
  onChange: (v: unknown) => void
  suffix?: string
  invalid?: boolean
  disabled?: boolean
  placeholder?: string
  ariaLabel?: string
}) {
  const [text, setText] = useState(() => numberText(value))
  // Внешняя смена значения (сброс, загрузка записи) → пересинхронизировать
  // текст; свой же ввод не трогаем, пока он парсится в то же значение.
  useEffect(() => {
    if (parseNumber(text) !== value) setText(numberText(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <div className={styles.suffixWrap}>
      <Input
        id={id}
        aria-label={ariaLabel}
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        invalid={invalid}
        disabled={disabled}
        onChange={(e) => {
          setText(e.target.value)
          onChange(parseNumber(e.target.value))
        }}
      />
      {suffix && (
        <span className={styles.suffix} aria-hidden>
          {suffix}
        </span>
      )}
    </div>
  )
}

// ─── Реестр ─────────────────────────────────────────────────────────────

const text: FieldRenderer = {
  Edit: ({ field, value, onChange, id, invalid, disabled }) => (
    <Input
      id={id}
      value={str(value)}
      placeholder={field.placeholder}
      maxLength={(field.config as TextConfig | undefined)?.max_length}
      invalid={invalid}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  View: TextView,
}

const textarea: FieldRenderer = {
  Edit: ({ field, value, onChange, id, invalid, disabled }) => (
    <Textarea
      id={id}
      value={str(value)}
      placeholder={field.placeholder}
      maxLength={(field.config as TextConfig | undefined)?.max_length}
      invalid={invalid}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  View: ({ field, value, ctx }) => (
    <StaticValue className={styles.pre}>{formatValue(field, value, ctx)}</StaticValue>
  ),
}

const number: FieldRenderer = {
  Edit: ({ field, value, onChange, id, invalid, disabled }) => (
    <SuffixInput
      id={id}
      value={value}
      onChange={onChange}
      suffix={(field.config as (NumberConfig & { suffix?: string }) | undefined)?.suffix}
      placeholder={field.placeholder}
      invalid={invalid}
      disabled={disabled}
    />
  ),
  View: NumView,
  align: 'right',
}

const money: FieldRenderer = {
  Edit: ({ field, value, onChange, id, invalid, disabled }) => (
    <SuffixInput
      id={id}
      value={value}
      onChange={onChange}
      suffix={currencySign((field.config as MoneyConfig | undefined)?.currency)}
      placeholder={field.placeholder}
      invalid={invalid}
      disabled={disabled}
    />
  ),
  View: NumView,
  align: 'right',
}

const date: FieldRenderer = {
  Edit: ({ value, onChange, id, invalid, disabled }) => (
    <DateField
      id={id}
      value={str(value)}
      onChange={(v) => onChange(v || undefined)}
      invalid={invalid}
      disabled={disabled}
    />
  ),
  View: TextView,
}

/** Локальный сдвиг зоны в виде ±ЧЧ:ММ — чтобы RFC 3339 был про «здесь». */
function tzOffset(d: Date): string {
  const off = -d.getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  const a = Math.abs(off)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${sign}${p(Math.floor(a / 60))}:${p(a % 60)}`
}

function splitDateTime(v: unknown): { date: string; time: string } {
  const t = typeof v === 'string' ? Date.parse(v) : NaN
  if (Number.isNaN(t)) return { date: '', time: '' }
  const d = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    time: `${p(d.getHours())}:${p(d.getMinutes())}`,
  }
}

function joinDateTime(dateStr: string, time: string): unknown {
  if (!dateStr) return undefined
  const [h, m] = (time || '00:00').split(':')
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return undefined
  return `${dateStr}T${(h ?? '00').padStart(2, '0')}:${(m ?? '00').padStart(2, '0')}:00${tzOffset(d)}`
}

/** Время чч:мм с локальным текстом — по той же причине, что SuffixInput:
 *  round-trip через RFC 3339 дописывал бы «01:00» после первой цифры. */
function TimeInput({
  date,
  value,
  onChange,
  disabled,
}: {
  date: string
  value: unknown
  onChange: (v: unknown) => void
  disabled?: boolean
}) {
  const fromValue = splitDateTime(value).time
  const [text, setText] = useState(fromValue)
  useEffect(() => {
    if (/^\d{2}:\d{2}$/.test(text) ? text !== fromValue : fromValue !== '' && text === '') {
      setText(fromValue)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromValue])
  return (
    <Input
      aria-label="Время"
      placeholder="чч:мм"
      inputMode="numeric"
      value={text}
      disabled={disabled || !date}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 4)
        const masked = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits
        setText(masked)
        if (/^\d{2}:\d{2}$/.test(masked)) onChange(joinDateTime(date, masked))
      }}
      onBlur={() => setText(fromValue)}
    />
  )
}

const datetime: FieldRenderer = {
  Edit: ({ value, onChange, id, invalid, disabled }) => {
    const { date: dPart, time } = splitDateTime(value)
    return (
      <div className={styles.datetime}>
        <DateField
          id={id}
          value={dPart}
          onChange={(v) => onChange(joinDateTime(v, time))}
          invalid={invalid}
          disabled={disabled}
        />
        <TimeInput date={dPart} value={value} onChange={onChange} disabled={disabled} />
      </div>
    )
  },
  View: TextView,
}

function CheckGlyph({ on }: { on: boolean }) {
  return (
    <span
      className={[styles.checkBox, on ? styles.checkBoxOn : ''].filter(Boolean).join(' ')}
      aria-hidden
    >
      {on && <Icon name="check" size={11} stroke={2.4} />}
    </span>
  )
}

const checkbox: FieldRenderer = {
  Edit: ({ value, onChange, id, invalid, disabled }) => {
    const on = value === true
    return (
      <button
        id={id}
        type="button"
        role="checkbox"
        aria-checked={on}
        aria-invalid={invalid || undefined}
        className={styles.checkBtn}
        disabled={disabled}
        onClick={() => onChange(!on)}
      >
        <CheckGlyph on={on} />
        {on ? 'Да' : 'Нет'}
      </button>
    )
  },
  View: ({ value }) => (
    <StaticValue className={styles.check}>
      <CheckGlyph on={value === true} />
      {value === true ? 'Да' : 'Нет'}
    </StaticValue>
  ),
}

const email: FieldRenderer = {
  Edit: ({ field, value, onChange, id, invalid, disabled }) => (
    <Input
      id={id}
      type="email"
      inputMode="email"
      value={str(value)}
      placeholder={field.placeholder ?? 'name@company.ru'}
      invalid={invalid}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  View: ({ value }) => (
    <StaticValue>
      {isBlank(value) ? (
        '—'
      ) : (
        <a className={styles.link} href={`mailto:${str(value)}`}>
          {str(value)}
        </a>
      )}
    </StaticValue>
  ),
}

const phone: FieldRenderer = {
  Edit: ({ field, value, onChange, id, invalid, disabled }) => (
    <Input
      id={id}
      type="tel"
      inputMode="tel"
      value={str(value)}
      placeholder={field.placeholder ?? '+7 ...'}
      invalid={invalid}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  View: ({ value }) => (
    <StaticValue>
      {isBlank(value) ? (
        '—'
      ) : (
        <a className={styles.link} href={`tel:${str(value).replace(/[^\d+]/g, '')}`}>
          {str(value)}
        </a>
      )}
    </StaticValue>
  ),
}

/** Ссылкой рендерим только http(s): остальное — текстом, как есть. */
function isHttpUrl(v: unknown): v is string {
  if (typeof v !== 'string') return false
  try {
    const u = new URL(v)
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.host !== ''
  } catch {
    return false
  }
}

const link: FieldRenderer = {
  Edit: ({ field, value, onChange, id, invalid, disabled, ariaLabel }) => (
    <Input
      id={id}
      aria-label={ariaLabel}
      type="url"
      inputMode="url"
      value={str(value)}
      placeholder={field.placeholder ?? 'https://…'}
      invalid={invalid}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  View: ({ value }) => (
    <StaticValue>
      {isBlank(value) ? (
        '—'
      ) : isHttpUrl(value) ? (
        <a className={styles.link} href={value} target="_blank" rel="noreferrer">
          {value}
        </a>
      ) : (
        str(value)
      )}
    </StaticValue>
  ),
}

const select: FieldRenderer = {
  Edit: ({ field, value, onChange, id, invalid, disabled, ctx }) => (
    <Combobox
      id={id}
      options={toComboOptions(fieldOptions(field, ctx), ctx)}
      value={str(value)}
      onChange={(v) => onChange(v || undefined)}
      placeholder={field.placeholder ?? '— выбрать —'}
      clearable={!field.required}
      invalid={invalid}
      disabled={disabled}
    />
  ),
  // Варианты с цветом или иконкой — значение чипом, как в списке; иначе текстом.
  View: (p) => {
    const v = str(p.value)
    if (!v || !hasMarkedOptions(p.field, p.ctx)) return <TextView {...p} />
    return (
      <StaticValue className={styles.chips}>
        <OptionChip field={p.field} value={v} ctx={p.ctx} />
      </StaticValue>
    )
  },
}

const multiselect: FieldRenderer = {
  Edit: ({ field, value, onChange, id, invalid, disabled, ctx }) => (
    <MultiCombobox
      id={id}
      options={toComboOptions(fieldOptions(field, ctx), ctx)}
      values={Array.isArray(value) ? value.map(String) : []}
      onChange={(v) => onChange(v.length ? v : undefined)}
      placeholder={field.placeholder ?? '— выбрать —'}
      invalid={invalid}
      disabled={disabled}
    />
  ),
  View: ({ field, value, ctx }) => {
    const items = Array.isArray(value) ? value.map(String) : []
    return (
      <StaticValue className={styles.chips}>
        {items.length === 0
          ? '—'
          : items.map((v) => <OptionChip key={v} field={field} value={v} ctx={ctx} />)}
      </StaticValue>
    )
  },
}

/** Справочник без загруженного содержимого — свободный ввод: лучше, чем
 *  заблокированное поле; принадлежность проверит бэкенд. */
const catalog: FieldRenderer = {
  Edit: (p) =>
    fieldOptions(p.field, p.ctx).length > 0 ? <select.Edit {...p} /> : <text.Edit {...p} />,
  View: TextView,
}

function PersonView({ field, value, ctx }: FieldRenderProps) {
  if (isBlank(value)) return <StaticValue>—</StaticValue>
  const label = optionLabel(field, str(value), ctx)
  return (
    <StaticValue className={styles.user}>
      <span className={styles.avatar} aria-hidden>
        {initials(label)}
      </span>
      {label}
    </StaticValue>
  )
}

const user: FieldRenderer = {
  Edit: ({ field, value, onChange, id, invalid, disabled, ctx, ariaLabel }) => (
    <Combobox
      id={id}
      inputAriaLabel={ariaLabel}
      options={orgOptions(ctx.staff, true)}
      value={str(value)}
      onChange={(v) => onChange(v || undefined)}
      placeholder={field.placeholder ?? '— сотрудник —'}
      clearable={!field.required}
      invalid={invalid}
      disabled={disabled}
      emptyText={ctx.staff ? 'Никого не найдено' : 'Справочник сотрудников недоступен'}
    />
  ),
  View: PersonView,
}

const department: FieldRenderer = {
  Edit: ({ field, value, onChange, id, invalid, disabled, ctx }) => (
    <Combobox
      id={id}
      options={orgOptions(ctx.departments, false)}
      value={str(value)}
      onChange={(v) => onChange(v || undefined)}
      placeholder={field.placeholder ?? '— отдел —'}
      clearable={!field.required}
      invalid={invalid}
      disabled={disabled}
      emptyText={ctx.departments ? 'Ничего не найдено' : 'Справочник отделов недоступен'}
    />
  ),
  View: TextView,
}

// ─── Поле «Форма»: ссылка на запись другой формы ─────────────────────

/** В список — активные записи и уже выбранные (даже закрытые), чтобы
 *  выбранное не пропадало из поля. */
function refOptions(list: RecordRefOption[] | undefined, chosen: string[]): ComboboxOption[] {
  return (list ?? [])
    .filter((o) => !o.inactive || chosen.includes(o.value))
    .map((o) => ({ value: o.value, label: o.label, hint: o.hint ?? null }))
}

function refValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  return typeof value === 'string' && value ? [value] : []
}

const recordRef: FieldRenderer = {
  Edit: ({ field, value, onChange, id, invalid, disabled, ctx }) => {
    const multiple = Boolean((field.config as RecordRefConfig | undefined)?.multiple)
    const chosen = refValues(value)
    const list = ctx.recordRefs?.[field.id]
    const options = refOptions(list, chosen)
    const emptyText = list ? 'Записей не найдено' : 'Записи формы недоступны'
    return multiple ? (
      <MultiCombobox
        id={id}
        options={options}
        values={chosen}
        onChange={(v) => onChange(v.length ? v : undefined)}
        placeholder={field.placeholder ?? '— выбрать записи —'}
        invalid={invalid}
        disabled={disabled}
      />
    ) : (
      <Combobox
        id={id}
        options={options}
        value={chosen[0] ?? ''}
        onChange={(v) => onChange(v || undefined)}
        placeholder={field.placeholder ?? '— выбрать запись —'}
        clearable={!field.required}
        invalid={invalid}
        disabled={disabled}
        emptyText={emptyText}
      />
    )
  },
  View: ({ field, value, ctx }) => {
    const items = refValues(value)
    if (!items.length) return <StaticValue>—</StaticValue>
    const byId = new Map((ctx.recordRefs?.[field.id] ?? []).map((o) => [o.value, o]))
    return (
      <StaticValue className={styles.chips}>
        {items.map((v) => {
          const o = byId.get(v)
          const label = o?.label ?? optionLabel(field, v, ctx)
          return o?.href ? (
            <a key={v} className={styles.chip} href={o.href}>
              {label}
            </a>
          ) : (
            <span key={v} className={styles.chip}>
              {label}
            </span>
          )
        })}
      </StaticValue>
    )
  },
}

// ─── Файлы ─────────────────────────────────────────────────────────────

function fileItems(value: unknown, byId: Record<string, FormFile> | undefined) {
  const ids = Array.isArray(value) ? value.map(String) : []
  return ids.map((id) => {
    const f = byId?.[id]
    return { id, name: f?.name ?? id, size: f?.size }
  })
}

const file: FieldRenderer = {
  Edit: ({ field, value, id, disabled, ctx }) => {
    // Без загрузчика (новая запись — id ещё нет, вложениям некуда лечь) —
    // объяснить, а не показать пустоту.
    if (!ctx.onUploadFiles && !(Array.isArray(value) && value.length)) {
      return <StaticValue>Прикрепить файлы можно после сохранения записи</StaticValue>
    }
    return (
      <FileDrop
        id={id}
        files={fileItems(value, ctx.filesById)}
        maxFiles={(field.config as FileConfig | undefined)?.max_files}
        disabled={disabled}
        onAdd={ctx.onUploadFiles ? (files) => ctx.onUploadFiles!(field, files) : undefined}
        onRemove={
          ctx.onRemoveFile ? (item: FileDropItem) => ctx.onRemoveFile!(field, item.id) : undefined
        }
        onOpen={
          ctx.onOpenFile ? (item: FileDropItem) => ctx.onOpenFile!(field, item.id) : undefined
        }
      />
    )
  },
  View: ({ field, value, ctx }) => {
    const items = fileItems(value, ctx.filesById)
    if (items.length === 0) return <StaticValue>—</StaticValue>
    return (
      <div className={styles.files}>
        {items.map((f) => (
          <div key={f.id} className={styles.fileRow}>
            <span className={styles.fileExt} aria-hidden>
              {fileExt(f.name)}
            </span>
            {ctx.onOpenFile ? (
              <button
                type="button"
                className={styles.fileName}
                title={f.name}
                onClick={() => ctx.onOpenFile!(field, f.id)}
              >
                {f.name}
              </button>
            ) : (
              <span className={styles.fileName} title={f.name}>
                {f.name}
              </span>
            )}
            {f.size != null && <span className={styles.fileSize}>{formatSize(f.size)}</span>}
            {ctx.onOpenFile && (
              <span style={{ color: 'var(--ink-3)', display: 'inline-flex' }} aria-hidden>
                <Icon name="download" size={14} />
              </span>
            )}
          </div>
        ))}
      </div>
    )
  },
}

// ─── Таблица ───────────────────────────────────────────────────────────

type Row = Record<string, unknown>

function tableColumns(field: Field): TableColumn[] {
  return (field.config as TableConfig | undefined)?.columns ?? []
}

function isNumCol(c: TableColumn): boolean {
  return c.type === 'number' || c.type === 'money'
}

function cellText(col: TableColumn, v: unknown, ctx: RenderContext, currency?: string): string {
  if (isBlank(v)) return '—'
  switch (col.type) {
    case 'number':
      return typeof v === 'number' ? formatNumber(v) : str(v)
    case 'money':
      return typeof v === 'number' ? formatMoney(v, currency) : str(v)
    case 'date':
      return formatDate(str(v))
    case 'checkbox':
      return v === true ? 'Да' : '—'
    default:
      // Остальные типы — тем же форматом, что и поле (сотрудник по имени,
      // период датами, длительность часами), а не сырым значением.
      return formatValue(columnField(col), v, ctx)
  }
}

function sums(cols: TableColumn[], rows: Row[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const c of cols) {
    if (!isNumCol(c)) continue
    let s = 0
    let any = false
    for (const r of rows) {
      const v = r[c.id]
      if (typeof v === 'number') {
        s += v
        any = true
      }
    }
    if (any) out[c.id] = s
  }
  return out
}

function TableView({ field, value, ctx }: FieldRenderProps) {
  const cols = tableColumns(field)
  const rows: Row[] = Array.isArray(value) ? (value as Row[]) : []
  const currency = (field.config as MoneyConfig | undefined)?.currency
  if (rows.length === 0) return <StaticValue>—</StaticValue>
  const total = sums(cols, rows)
  const hasSums = Object.keys(total).length > 0
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.numCol}>№</th>
            {cols.map((c) => (
              <th key={c.id} className={isNumCol(c) ? styles.right : undefined}>
                {c.label || c.key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className={[styles.numCol, styles.rowNum].join(' ')}>{i + 1}</td>
              {cols.map((c) => (
                <td key={c.id} className={isNumCol(c) ? styles.right : undefined}>
                  {cellText(c, r[c.id], ctx, currency)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {hasSums && (
          <tfoot>
            <tr>
              <td>Итого</td>
              {cols.map((c) => (
                <td key={c.id} className={isNumCol(c) ? styles.right : undefined}>
                  {c.id in total
                    ? c.type === 'money'
                      ? formatMoney(total[c.id]!, currency)
                      : formatNumber(total[c.id]!)
                    : ''}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

function TableCell({
  col,
  row,
  value,
  onChange,
  disabled,
  ctx,
}: {
  col: TableColumn
  row: number
  value: unknown
  onChange: (v: unknown) => void
  disabled?: boolean
  ctx: RenderContext
}) {
  const cls = [styles.cell, isNumCol(col) ? styles.right : ''].filter(Boolean).join(' ')
  switch (col.type) {
    case 'number':
    case 'money':
      return (
        <NumberCell
          className={cls}
          label={col.label || col.key}
          value={value}
          disabled={disabled}
          onChange={onChange}
        />
      )
    case 'date':
      return (
        <DateField
          value={str(value)}
          onChange={(v: string) => onChange(v || undefined)}
          ariaLabel={col.label || col.key}
          disabled={disabled}
        />
      )
    case 'checkbox': {
      const on = value === true
      return (
        <button
          type="button"
          role="checkbox"
          aria-checked={on}
          aria-label={col.label || col.key}
          className={styles.cellCheck}
          disabled={disabled}
          onClick={() => onChange(!on)}
        >
          <CheckGlyph on={on} />
        </button>
      )
    }
    // Типы 06.11.2026 — тем же реестром, что и поле: синтетическое поле из
    // колонки (справочники и сотрудники берутся из ctx).
    case 'user':
    case 'link':
    case 'rating':
    case 'percent':
    case 'duration':
    case 'date_range':
    case 'time': {
      const Edit = fieldRegistry[col.type].Edit
      return (
        <div className={styles.cellCtl}>
          <Edit
            field={columnField(col)}
            value={value}
            onChange={onChange}
            id={`${col.id}-r${row}`}
            ariaLabel={col.label || col.key}
            disabled={disabled}
            ctx={ctx}
          />
        </div>
      )
    }
    // select-колонка: у TableColumn бэкенда нет списка вариантов (v1) —
    // честнее свободный ввод, чем пустой дропдаун.
    default:
      return (
        <input
          className={cls}
          aria-label={col.label || col.key}
          value={str(value)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )
  }
}

/** Колонка таблицы как поле — для реестра контролов и formatValue. */
function columnField(col: TableColumn): Field {
  return {
    id: col.id,
    key: col.key,
    label: col.label || col.key,
    type: col.type,
    section_id: '',
    span: 12,
    required: false,
    show_in_list: false,
    filterable: false,
    archived: false,
  }
}

/** Числовая ячейка с локальным текстом — та же причина, что у SuffixInput:
 *  round-trip через число съедал бы «12,» и дробь было бы не набрать. */
function NumberCell({
  className,
  label: aria,
  value,
  onChange,
  disabled,
}: {
  className: string
  label: string
  value: unknown
  onChange: (v: unknown) => void
  disabled?: boolean
}) {
  const [text, setText] = useState(() => numberText(value))
  useEffect(() => {
    if (parseNumber(text) !== value) setText(numberText(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <input
      className={className}
      inputMode="decimal"
      aria-label={aria}
      value={text}
      disabled={disabled}
      onChange={(e) => {
        setText(e.target.value)
        onChange(parseNumber(e.target.value))
      }}
    />
  )
}

function TableEdit({ field, value, onChange, disabled, ctx }: FieldRenderProps) {
  const cols = tableColumns(field)
  const rows: Row[] = Array.isArray(value) ? (value as Row[]) : []
  const cfg = field.config as (TableConfig & MoneyConfig) | undefined
  const max = cfg?.max_rows
  const full = max != null && rows.length >= max
  const total = sums(cols, rows)
  const hasSums = Object.keys(total).length > 0

  const setCell = (i: number, colId: string, v: unknown) => {
    const next = rows.map((r, j) => (j === i ? { ...r, [colId]: v } : r))
    onChange(next)
  }
  const addRow = () => {
    if (full) return
    onChange([...rows, {}])
  }
  const removeRow = (i: number) => {
    const next = rows.filter((_, j) => j !== i)
    onChange(next.length ? next : undefined)
  }

  return (
    <div className={styles.tableWrap}>
      {rows.length === 0 ? (
        <div className={styles.tableEmpty}>Пока нет строк</div>
      ) : (
        <table className={[styles.table, styles.edit].join(' ')}>
          <thead>
            <tr>
              <th className={styles.numCol}>№</th>
              {cols.map((c) => (
                <th key={c.id} className={isNumCol(c) ? styles.right : undefined}>
                  {c.label || c.key}
                </th>
              ))}
              <th className={styles.numCol} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className={[styles.numCol, styles.rowNum].join(' ')}>{i + 1}</td>
                {cols.map((c) => (
                  <td key={c.id}>
                    <TableCell
                      col={c}
                      row={i}
                      value={r[c.id]}
                      onChange={(v) => setCell(i, c.id, v)}
                      disabled={disabled}
                      ctx={ctx}
                    />
                  </td>
                ))}
                <td className={styles.numCol}>
                  {!disabled && (
                    <button
                      type="button"
                      className={styles.rowRm}
                      aria-label={`Удалить строку ${i + 1}`}
                      onClick={() => removeRow(i)}
                    >
                      <Icon name="close" size={12} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {hasSums && (
            <tfoot>
              <tr>
                <td>Итого</td>
                {cols.map((c) => (
                  <td key={c.id} className={isNumCol(c) ? styles.right : undefined}>
                    {c.id in total
                      ? c.type === 'money'
                        ? formatMoney(total[c.id]!, cfg?.currency)
                        : formatNumber(total[c.id]!)
                      : ''}
                  </td>
                ))}
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      )}
      {!disabled && (
        <div className={styles.tableFoot}>
          <button type="button" className={styles.addRow} onClick={addRow} disabled={full}>
            + Строка
          </button>
          <span>
            {rows.length}
            {max != null ? ` из ${max}` : ''} строк
          </span>
        </div>
      )}
    </div>
  )
}

const table: FieldRenderer = {
  Edit: TableEdit,
  View: TableView,
}

// ─── Контакты ──────────────────────────────────────────────────────────

const contact: FieldRenderer = {
  Edit: ({ field, value, onChange, id, invalid, disabled, ctx }) => {
    const ids = refValues(value)
    const Control = ctx.ContactsControl
    if (!Control) {
      return (
        <StaticValue>
          {ids.length ? formatValue(field, ids, ctx) : 'Контакты выбираются в карточке записи в портале'}
        </StaticValue>
      )
    }
    return (
      <Control
        id={id}
        label={field.label}
        value={ids}
        invalid={invalid}
        readOnly={disabled}
        onChange={(v) => onChange(v.length ? v : undefined)}
      />
    )
  },
  View: ({ field, value, ctx }) => {
    const ids = refValues(value)
    if (!ids.length) return <StaticValue>—</StaticValue>
    const Control = ctx.ContactsControl
    return Control ? (
      <Control label={field.label} value={ids} onChange={() => undefined} readOnly />
    ) : (
      <StaticValue>{formatValue(field, ids, ctx)}</StaticValue>
    )
  },
}

// ─── Презентационные ───────────────────────────────────────────────────

const section: FieldRenderer = {
  Edit: ({ field }) => <div className={styles.subheading}>{field.label}</div>,
  View: ({ field }) => <div className={styles.subheading}>{field.label}</div>,
}

const note: FieldRenderer = {
  Edit: ({ field }) => <div className={styles.note}>{field.hint || field.label}</div>,
  View: ({ field }) => <div className={styles.note}>{field.hint || field.label}</div>,
}

// ─── Типы шага 1 «до уровня Monday» (06.11.2026) ────────────────────────

/** Оценка: ряд звёзд как radiogroup; повторный клик по выбранной — снять;
 *  стрелки меняют значение и переводят фокус на новую звезду. */
function Stars({
  value,
  max,
  onChange,
  disabled,
  label,
  id,
  invalid,
}: {
  value: unknown
  max: number
  onChange: (v: number | undefined) => void
  disabled?: boolean
  label: string
  id?: string
  invalid?: boolean
}) {
  const n = typeof value === 'number' ? value : 0
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const move = (next: number | undefined) => {
    onChange(next)
    const target = refs.current[(next ?? 1) - 1]
    target?.focus()
  }
  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={label}
      aria-invalid={invalid || undefined}
      className={styles.stars}
      onKeyDown={(e) => {
        if (disabled) return
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault()
          move(Math.min(max, n + 1))
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault()
          move(n > 1 ? n - 1 : undefined)
        }
      }}
    >
      {Array.from({ length: max }, (_, i) => i + 1).map((k) => (
        <button
          key={k}
          ref={(el) => {
            refs.current[k - 1] = el
          }}
          type="button"
          role="radio"
          aria-checked={k === n}
          aria-label={`${k} из ${max}`}
          tabIndex={k === (n || 1) ? 0 : -1}
          className={styles.star}
          data-on={k <= n ? '' : undefined}
          disabled={disabled}
          onClick={() => onChange(k === n ? undefined : k)}
        >
          ★
        </button>
      ))}
    </div>
  )
}

/** Звёзды для чтения: одна картинка с подписью «4 из 5», без интерактива. */
function StarsStatic({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <span role="img" aria-label={label} className={[styles.stars, styles.starsStatic].join(' ')}>
      {Array.from({ length: max }, (_, i) => i + 1).map((k) => (
        <span key={k} className={styles.star} data-on={k <= value ? '' : undefined} aria-hidden>
          ★
        </span>
      ))}
    </span>
  )
}

const rating: FieldRenderer = {
  Edit: ({ field, value, onChange, id, invalid, disabled, ariaLabel }) => (
    <Stars
      id={id}
      value={value}
      max={ratingMax(field)}
      onChange={(v) => onChange(v)}
      disabled={disabled}
      invalid={invalid}
      label={ariaLabel ?? (field.label || field.key)}
    />
  ),
  View: ({ field, value, ctx }) => (
    <StaticValue className={styles.ratingView}>
      {typeof value === 'number' ? (
        <>
          <StarsStatic value={value} max={ratingMax(field)} label={formatValue(field, value, ctx)} />
          <span>{formatValue(field, value, ctx)}</span>
        </>
      ) : (
        '—'
      )}
    </StaticValue>
  ),
  align: 'right',
}

/** Время «ЧЧ:ММ»: цифры и двоеточие, двоеточие подставляется после часов. */
function clockText(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits
}

const time: FieldRenderer = {
  Edit: ({ field, value, onChange, id, invalid, disabled, ariaLabel }) => (
    <Input
      id={id}
      aria-label={ariaLabel}
      inputMode="numeric"
      placeholder={field.placeholder ?? 'чч:мм'}
      value={str(value)}
      invalid={invalid}
      disabled={disabled}
      className={styles.clock}
      onChange={(e) => {
        const t = clockText(e.target.value)
        onChange(t || undefined)
      }}
    />
  ),
  View: TextView,
}

const dateRange: FieldRenderer = {
  Edit: ({ field, value, onChange, id, invalid, disabled, ariaLabel }) => {
    const v = (value && typeof value === 'object' ? value : {}) as Partial<DateRangeValue>
    const set = (patch: Partial<DateRangeValue>) => {
      const next = { ...v, ...patch }
      onChange(next.start || next.end ? next : undefined)
    }
    const name = ariaLabel ?? (field.label || field.key)
    return (
      <div className={styles.range}>
        <DateField
          id={id}
          ariaLabel={`${name}: с`}
          value={v.start ?? ''}
          max={v.end}
          onChange={(d) => set({ start: d || undefined })}
          invalid={invalid}
          disabled={disabled}
        />
        <span className={styles.rangeDash} aria-hidden>
          –
        </span>
        <DateField
          ariaLabel={`${name}: по`}
          value={v.end ?? ''}
          min={v.start}
          onChange={(d) => set({ end: d || undefined })}
          invalid={invalid}
          disabled={disabled}
        />
      </div>
    )
  },
  View: TextView,
}

/** Длительность: часы и минуты, значение — минуты. */
/**
 * Длительность: часы и минуты, значение — минуты. Текст полей живёт локально
 * (как у SuffixInput): round-trip через число съедал бы ввод и показывал NaN.
 * Наружу — число, undefined (оба пусты) или сам текст при нечисловом вводе
 * (валидатор скажет «ожидается длительность»).
 */
function DurationEdit({ field, value, onChange, id, invalid, disabled, ariaLabel }: FieldRenderProps) {
  const split = (v: unknown): [string, string] =>
    typeof v === 'number' && Number.isFinite(v) ? [String(Math.floor(v / 60)), String(v % 60)] : ['', '']
  // Текст → значение наружу: число минут, undefined (оба пусты) или сам текст.
  const parse = (h: string, m: string): unknown => {
    if (h.trim() === '' && m.trim() === '') return undefined
    if (!/^\d*$/.test(h.trim()) || !/^\d*$/.test(m.trim())) return `${h.trim()} ч ${m.trim()} мин`
    return (h.trim() === '' ? 0 : Number(h)) * 60 + (m.trim() === '' ? 0 : Number(m))
  }
  const [[hours, mins], setText] = useState<[string, string]>(() => split(value))
  // Внешняя смена значения (сброс, загрузка записи) → пересинхронизировать
  // текст; свой же ввод не трогаем, пока он парсится в то же значение.
  useEffect(() => {
    if (parse(hours, mins) !== value) setText(split(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  const name = ariaLabel ?? (field.label || field.key)
  const emit = (h: string, m: string) => {
    setText([h, m])
    onChange(parse(h, m))
  }
  return (
    <div className={styles.duration}>
      <div className={styles.suffixWrap}>
        <Input
          id={id}
          inputMode="numeric"
          aria-label={`${name}: часы`}
          value={hours}
          invalid={invalid}
          disabled={disabled}
          onChange={(e) => emit(e.target.value, mins)}
        />
        <span className={styles.suffix} aria-hidden>
          ч
        </span>
      </div>
      <div className={styles.suffixWrap}>
        <Input
          inputMode="numeric"
          aria-label={`${name}: минуты`}
          value={mins}
          invalid={invalid}
          disabled={disabled}
          onChange={(e) => emit(hours, e.target.value)}
        />
        <span className={styles.suffix} aria-hidden>
          мин
        </span>
      </div>
    </div>
  )
}

const duration: FieldRenderer = {
  Edit: DurationEdit,
  View: NumView,
  align: 'right',
}

const percent: FieldRenderer = {
  Edit: ({ field, value, onChange, id, invalid, disabled, ariaLabel }) => (
    <SuffixInput
      id={id}
      ariaLabel={ariaLabel}
      value={value}
      onChange={onChange}
      suffix="%"
      invalid={invalid}
      disabled={disabled}
      placeholder={field.placeholder}
    />
  ),
  View: ({ field, value, ctx }) => {
    const n = typeof value === 'number' ? Math.max(0, Math.min(100, value)) : null
    return (
      <StaticValue className={styles.percentView}>
        {n == null ? (
          '—'
        ) : (
          <>
            <span className={styles.num}>{formatValue(field, value, ctx)}</span>
            <span
              className={styles.bar}
              role="progressbar"
              aria-label={field.label || field.key}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={n}
            >
              <span className={styles.barFill} style={{ width: `${n}%` }} />
            </span>
          </>
        )}
      </StaticValue>
    )
  },
  align: 'right',
}

/** Теги: чипы + ввод; Enter или запятая добавляет, подсказки из ctx.loadTags. */
function TagsEdit({ field, value, onChange, id, invalid, disabled, ctx, ariaLabel }: FieldRenderProps) {
  const tags = Array.isArray(value) ? value.map(String) : []
  const [text, setText] = useState('')
  const [hints, setHints] = useState<string[]>([])
  const [active, setActive] = useState(-1)
  const listId = useId()
  const has = (t: string) => tags.some((x) => x.toLowerCase() === t.toLowerCase())
  useEffect(() => {
    const q = text.trim()
    if (!q || !ctx.loadTags) {
      setHints([])
      return
    }
    let alive = true
    ctx.loadTags(field, q).then(
      (list) => {
        if (!alive) return
        setHints(list.filter((t) => !has(t)).slice(0, 8))
        setActive(-1)
      },
      () => alive && setHints([]),
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])
  const add = (raw: string) => {
    const t = raw.trim()
    if (!t) return
    if (!has(t)) onChange([...tags, t])
    setText('')
    setHints([])
    setActive(-1)
  }
  const remove = (t: string) => {
    const next = tags.filter((x) => x !== t)
    onChange(next.length ? next : undefined)
  }
  return (
    <div className={[styles.tags, invalid ? styles.tagsInvalid : ''].filter(Boolean).join(' ')}>
      {tags.map((t) => (
        <span key={t} className={styles.chip}>
          {t}
          {!disabled && (
            <button type="button" className={styles.chipRm} aria-label={`Убрать метку ${t}`} onClick={() => remove(t)}>
              <Icon name="close" size={10} />
            </button>
          )}
        </span>
      ))}
      <input
        id={id}
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={hints.length > 0}
        aria-controls={hints.length > 0 ? listId : undefined}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        aria-autocomplete="list"
        aria-invalid={invalid || undefined}
        className={styles.tagsInput}
        placeholder={tags.length ? '' : (field.placeholder ?? 'Метка и Enter')}
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && hints.length) {
            e.preventDefault()
            setActive((a) => (a + 1) % hints.length)
          } else if (e.key === 'ArrowUp' && hints.length) {
            e.preventDefault()
            setActive((a) => (a <= 0 ? hints.length - 1 : a - 1))
          } else if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add(active >= 0 ? hints[active]! : text)
          } else if (e.key === 'Escape' && hints.length) {
            setHints([])
            setActive(-1)
          } else if (e.key === 'Backspace' && text === '' && tags.length) {
            remove(tags[tags.length - 1]!)
          }
        }}
        onBlur={() => text.trim() && add(text)}
      />
      {hints.length > 0 && (
        <ul id={listId} role="listbox" className={styles.tagsHints}>
          {hints.map((h, i) => (
            <li
              key={h}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={styles.tagsHint}
              data-active={i === active ? '' : undefined}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(h)}
            >
              {h}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const tags: FieldRenderer = {
  Edit: TagsEdit,
  View: ({ value }) => {
    const items = Array.isArray(value) ? value.map(String) : []
    return (
      <StaticValue className={styles.chips}>
        {items.length === 0
          ? '—'
          : items.map((t) => (
              <span key={t} className={styles.chip}>
                {t}
              </span>
            ))}
      </StaticValue>
    )
  },
}

const location: FieldRenderer = {
  Edit: ({ field, value, onChange, id, invalid, disabled, ariaLabel }) => {
    const v = (value && typeof value === 'object' ? value : {}) as Partial<LocationValue>
    return (
      <Input
        id={id}
        aria-label={ariaLabel}
        value={v.address ?? ''}
        placeholder={field.placeholder ?? 'Город, улица, дом'}
        invalid={invalid}
        disabled={disabled}
        onChange={(e) => {
          const address = e.target.value
          onChange(address.trim() === '' && v.lat == null ? undefined : { ...v, address })
        }}
      />
    )
  },
  View: ({ value }) => {
    const v = (value && typeof value === 'object' ? value : {}) as Partial<LocationValue>
    if (!v.address) return <StaticValue>—</StaticValue>
    return (
      <StaticValue className={styles.locationView}>
        <span>{v.address}</span>
        <a
          className={styles.link}
          href={`https://yandex.ru/maps/?text=${encodeURIComponent(v.address)}`}
          target="_blank"
          rel="noreferrer"
        >
          на карте
        </a>
      </StaticValue>
    )
  },
}

function ColorEdit({ field, value, onChange, id, invalid, disabled, ariaLabel }: FieldRenderProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const idx = Math.max(
    0,
    SECTION_COLORS.findIndex((c) => c.key === value),
  )
  const pick = (i: number) => {
    const c = SECTION_COLORS[(i + SECTION_COLORS.length) % SECTION_COLORS.length]!
    onChange(c.key)
    refs.current[SECTION_COLORS.indexOf(c)]?.focus()
  }
  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={ariaLabel ?? (field.label || field.key)}
      aria-invalid={invalid || undefined}
      className={styles.swatches}
      onKeyDown={(e) => {
        if (disabled) return
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault()
          pick(idx + 1)
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault()
          pick(idx - 1)
        }
      }}
    >
      {SECTION_COLORS.map((c, i) => (
        <button
          key={c.key}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="button"
          role="radio"
          aria-checked={value === c.key}
          aria-label={c.label}
          title={c.label}
          tabIndex={i === idx ? 0 : -1}
          className={styles.swatch}
          style={{ '--swatch': c.hex } as CSSProperties}
          disabled={disabled}
          onClick={() => onChange(value === c.key ? undefined : c.key)}
        />
      ))}
    </div>
  )
}

const color: FieldRenderer = {
  Edit: ColorEdit,
  View: ({ field, value, ctx }) => {
    const hex = typeof value === 'string' ? sectionColorHex(value) : undefined
    return (
      <StaticValue className={styles.colorView}>
        {hex ? (
          <>
            <span className={styles.swatch} data-static="" style={{ '--swatch': hex } as CSSProperties} aria-hidden />
            <span>{formatValue(field, value, ctx)}</span>
          </>
        ) : (
          '—'
        )}
      </StaticValue>
    )
  },
}

// ─── Вычисляемые (шаг 2, 06.11.2026) ────────────────────────────────────
// Оба — только просмотр: формулу считает FormRenderer вживую (и сервер при
// сохранении), подстановку приносит сервер в record.lookups (ctx.lookups).
// role="status": значение меняется само при вводе соседних полей.

function ComputedValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="status" aria-label={label}>
      <StaticValue className={styles.num}>{children}</StaticValue>
    </div>
  )
}

const formula: FieldRenderer = {
  Edit: ({ field, value, ctx }) => (
    <ComputedValue label={field.label || field.key}>{formatValue(formulaResultField(field), value, ctx)}</ComputedValue>
  ),
  View: ({ field, value, ctx }) => (
    <ComputedValue label={field.label || field.key}>{formatValue(formulaResultField(field), value, ctx)}</ComputedValue>
  ),
  align: 'right',
}

const lookup: FieldRenderer = {
  Edit: ({ field, ctx }) => (
    <div>
      <ComputedValue label={field.label || field.key}>
        {formatValue(lookupTargetField(field), ctx.lookups?.[field.id], ctx)}
      </ComputedValue>
      <span className={styles.note}>Подставится из выбранной записи после сохранения</span>
    </div>
  ),
  View: ({ field, ctx }) => (
    <ComputedValue label={field.label || field.key}>
      {formatValue(lookupTargetField(field), ctx.lookups?.[field.id], ctx)}
    </ComputedValue>
  ),
}

export const fieldRegistry: Record<FieldType, FieldRenderer> = {
  text,
  formula,
  lookup,
  textarea,
  number,
  money,
  date,
  datetime,
  checkbox,
  email,
  phone,
  link,
  select,
  multiselect,
  catalog,
  user,
  department,
  table,
  file,
  record_ref: recordRef,
  contact,
  rating,
  time,
  date_range: dateRange,
  duration,
  percent,
  tags,
  location,
  color,
  section,
  note,
}

/** Обёртка: рендер одного поля по реестру в нужном режиме. */
export function FieldControl({
  mode,
  ...props
}: FieldRenderProps & { mode: RenderMode }): ReactNode {
  const r = fieldRegistry[props.field.type]
  const C = mode === 'edit' ? r.Edit : r.View
  return <C {...props} />
}

/** id контрола: стабильный внутри формы, уникальный между формами на странице. */
export function useFieldIdPrefix(): string {
  return useId()
}
