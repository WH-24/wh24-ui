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
import { useEffect, useId, useState, type ComponentType, type ReactNode } from 'react'
import {
  Combobox,
  DateField,
  FileDrop,
  Icon,
  Input,
  MultiCombobox,
  StaticValue,
  Textarea,
  type ComboboxOption,
} from '@wowhaus-24/ui-react'

import type {
  Field,
  FieldType,
  FileConfig,
  FormFile,
  MoneyConfig,
  NumberConfig,
  OrgOption,
  SelectOption,
  TableColumn,
  TableConfig,
  TextConfig,
} from '../types.js'
import {
  currencySign,
  fieldOptions,
  fileExt,
  formatDate,
  formatDateTime,
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
}

export interface FieldRenderer {
  Edit: ComponentType<FieldRenderProps>
  View: ComponentType<FieldRenderProps>
  /** Значение по умолчанию для новой записи (undefined — ключа нет). */
  empty?: () => unknown
  /** Числовые типы выравниваются вправо (список, таблица). */
  align?: 'left' | 'right'
}

// ─── Общие кусочки ──────────────────────────────────────────────────────

function toComboOptions(opts: SelectOption[]): ComboboxOption[] {
  return opts.map((o) => ({ value: o.value, label: o.label }))
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
}: {
  id: string
  value: unknown
  onChange: (v: unknown) => void
  suffix?: string
  invalid?: boolean
  disabled?: boolean
  placeholder?: string
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
      suffix={(field.config as NumberConfig & { suffix?: string } | undefined)?.suffix}
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
    <span className={[styles.checkBox, on ? styles.checkBoxOn : ''].filter(Boolean).join(' ')} aria-hidden>
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
  empty: () => false,
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

const link: FieldRenderer = {
  Edit: ({ field, value, onChange, id, invalid, disabled }) => (
    <Input
      id={id}
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
      ) : (
        <a className={styles.link} href={str(value)} target="_blank" rel="noreferrer">
          {str(value)}
        </a>
      )}
    </StaticValue>
  ),
}

const select: FieldRenderer = {
  Edit: ({ field, value, onChange, id, invalid, disabled, ctx }) => (
    <Combobox
      id={id}
      options={toComboOptions(fieldOptions(field, ctx))}
      value={str(value)}
      onChange={(v) => onChange(v || undefined)}
      placeholder={field.placeholder ?? '— выбрать —'}
      clearable={!field.required}
      invalid={invalid}
      disabled={disabled}
    />
  ),
  View: TextView,
}

const multiselect: FieldRenderer = {
  Edit: ({ field, value, onChange, id, invalid, disabled, ctx }) => (
    <MultiCombobox
      id={id}
      options={toComboOptions(fieldOptions(field, ctx))}
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
          : items.map((v) => (
              <span key={v} className={styles.chip}>
                {optionLabel(field, v, ctx)}
              </span>
            ))}
      </StaticValue>
    )
  },
  empty: () => [],
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
  Edit: ({ field, value, onChange, id, invalid, disabled, ctx }) => (
    <Combobox
      id={id}
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

// ─── Файлы ─────────────────────────────────────────────────────────────

function fileItems(value: unknown, byId: Record<string, FormFile> | undefined) {
  const ids = Array.isArray(value) ? value.map(String) : []
  return ids.map((id) => {
    const f = byId?.[id]
    return { id, name: f?.name ?? id, size: f?.size }
  })
}

const file: FieldRenderer = {
  Edit: ({ field, value, id, disabled, ctx }) => (
    <FileDrop
      id={id}
      files={fileItems(value, ctx.filesById)}
      maxFiles={(field.config as FileConfig | undefined)?.max_files}
      disabled={disabled}
      onAdd={ctx.onUploadFiles ? (files) => ctx.onUploadFiles!(field, files) : undefined}
      onRemove={ctx.onRemoveFile ? (item) => ctx.onRemoveFile!(field, item.id) : undefined}
      onOpen={ctx.onOpenFile ? (item) => ctx.onOpenFile!(field, item.id) : undefined}
    />
  ),
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
  empty: () => [],
}

// ─── Таблица ───────────────────────────────────────────────────────────

type Row = Record<string, unknown>

function tableColumns(field: Field): TableColumn[] {
  return (field.config as TableConfig | undefined)?.columns ?? []
}

function isNumCol(c: TableColumn): boolean {
  return c.type === 'number' || c.type === 'money'
}

function cellText(col: TableColumn, v: unknown, currency?: string): string {
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
      return str(v)
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

function TableView({ field, value }: FieldRenderProps) {
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
                  {cellText(c, r[c.id], currency)}
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
  value,
  onChange,
  disabled,
  ctx,
}: {
  col: TableColumn
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
        <input
          className={cls}
          inputMode="decimal"
          aria-label={col.label || col.key}
          value={numberText(value)}
          disabled={disabled}
          onChange={(e) => onChange(parseNumber(e.target.value))}
        />
      )
    case 'date':
      return (
        <DateField
          value={str(value)}
          onChange={(v) => onChange(v || undefined)}
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

function TableEdit({ field, value, onChange, disabled, ctx }: FieldRenderProps) {
  const cols = tableColumns(field)
  const rows: Row[] = Array.isArray(value) ? (value as Row[]) : []
  const cfg = field.config as TableConfig & MoneyConfig | undefined
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
  empty: () => [],
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

export const fieldRegistry: Record<FieldType, FieldRenderer> = {
  text,
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
