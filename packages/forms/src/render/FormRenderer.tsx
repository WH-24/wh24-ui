/**
 * FormRenderer — тело записи: секции → 12-колоночная сетка → поля через
 * fieldRegistry. Один компонент на три места: карточка записи (просмотр и
 * редактирование), drawer быстрого просмотра, live-превью в редакторе схемы.
 *
 * Видимость поля считает ТОЛЬКО conditions (fieldVisibility, с цепочками) —
 * та же функция, что у валидатора и у бэкенда. Скрытое поле не рендерится вовсе (не display:none):
 * его контрол не должен получать фокус табом и не должен участвовать в
 * автозаполнении браузера.
 *
 * Архивные поля (archived=true) со значением показываются свёрнутым блоком
 * «Архивные поля» только для чтения — значение уже сохранено и пользователь
 * должен видеть, что оно есть; без значения — не показываются вовсе.
 */
import { useId, useMemo, type CSSProperties } from 'react'
import { FieldGrid, FieldRow } from '@wowhaus-24/ui-react'

import { applyFillsOnChange, visibleIfMap } from '../conditions/rules.js'
import { fieldRequirement, fieldVisibility } from '../conditions/visibility.js'
import type { Field, RecordData, RecordFieldError, SchemaDocument, Section } from '../types.js'
import { isComputedField, isPresentation, sectionColorHex } from '../types.js'
import { computeFormulas } from '../formula/formula.js'
import { isBlank } from './format.js'
import { FieldControl, type RenderContext, type RenderMode } from './registry.js'
import styles from './render.module.css'

export type FieldErrors = RecordFieldError[] | Record<string, string>

export interface FormRendererProps {
  doc: SchemaDocument
  values: RecordData
  mode: RenderMode
  /** Обязателен в режиме edit. */
  onChange?: (fieldId: string, value: unknown) => void
  /** Ошибки заполнения: список от валидатора/бэкенда или уже по полям. */
  errors?: FieldErrors
  ctx?: RenderContext
  disabled?: boolean
  /** Поля, появившиеся после версии записи — бейдж «НОВОЕ» у подписи. */
  newFieldIds?: Iterable<string>
  className?: string
}

/** Ошибки → по id поля; несколько на поле — через «; ». */
export function errorsByField(errors: FieldErrors | undefined): Map<string, string> {
  const m = new Map<string, string>()
  if (!errors) return m
  if (Array.isArray(errors)) {
    for (const e of errors) {
      if (!e.field_id) continue
      const prev = m.get(e.field_id)
      m.set(e.field_id, prev ? `${prev}; ${e.message}` : e.message)
    }
  } else {
    for (const [k, v] of Object.entries(errors)) if (v) m.set(k, v)
  }
  return m
}

/** Видимые (по visible_if, с цепочками) неархивные поля в порядке документа. */
export function visibleFields(doc: SchemaDocument, values: RecordData): Field[] {
  const vis = fieldVisibility(doc.fields, values)
  return doc.fields.filter((f) => !f.archived && vis[f.id] !== false)
}

const noop = () => {}

/**
 * Значения после правки поля с подстановкой правил формы: правило, которое
 * эта правка включила, ставит свои значения («Ответственный = Т» →
 * «Наблюдатель = А»), остальные заполняют пустые поля. Возвращает только
 * подставленное — само изменённое поле хост ставит сам.
 */
export function ruleFillsAfterChange(
  doc: SchemaDocument,
  values: RecordData,
  fieldId: string,
  value: unknown,
): Record<string, unknown> {
  if (!doc.rules?.length) return {}
  const next = { ...values }
  if (value === undefined) delete next[fieldId]
  else next[fieldId] = value
  const { values: out, filled } = applyFillsOnChange(doc.rules, visibleIfMap(doc.fields), values, next)
  const patch: Record<string, unknown> = {}
  for (const id of filled) if (id !== fieldId) patch[id] = out[id]
  return patch
}

export function FormRenderer({
  doc,
  values,
  mode,
  onChange,
  errors,
  ctx,
  disabled,
  newFieldIds,
  className,
}: FormRendererProps) {
  const prefix = useId()
  const errMap = useMemo(() => errorsByField(errors), [errors])
  const newSet = useMemo(() => new Set(newFieldIds ?? []), [newFieldIds])
  const context: RenderContext = ctx ?? {}

  const sections = useMemo(
    () => [...doc.sections].sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title, 'ru')),
    [doc.sections],
  )
  const visible = visibleFields(doc, values)
  // Формулы — вживую по текущим значениям, тем же вычислителем, что сервер
  // при сохранении; сохранённое в data значение в форме не показывается.
  const computed = useMemo(() => computeFormulas(doc, values), [doc, values])
  // Звёздочка — и у полей, обязательных по условию (required_if выполнено).
  const required = fieldRequirement(doc.fields, values)
  const bySection = new Map<string, Field[]>()
  for (const f of visible) {
    const list = bySection.get(f.section_id) ?? []
    list.push(f)
    bySection.set(f.section_id, list)
  }
  const archived = doc.fields.filter((f) => f.archived && !isBlank(values[f.id]))

  const renderField = (f: Field, forceView: boolean) => {
    const id = `${prefix}-${f.id}`
    const err = errMap.get(f.id)
    const control = (
      <FieldControl
        mode={forceView ? 'view' : mode}
        field={f}
        value={
          // Правка — вживую; просмотр — сохранённое сервером (то же, что в
          // списке и выгрузке), а без него (запись старше формулы) — расчёт.
          f.type === 'formula' ? (mode === 'edit' && !forceView ? computed[f.id] : (values[f.id] ?? computed[f.id])) : values[f.id]
        }
        onChange={
          onChange
            ? (v) => {
                onChange(f.id, v)
                for (const [id, x] of Object.entries(ruleFillsAfterChange(doc, values, f.id, v))) {
                  onChange(id, x)
                }
              }
            : noop
        }
        id={id}
        invalid={Boolean(err)}
        disabled={disabled}
        ctx={context}
      />
    )
    if (isPresentation(f.type)) return <div key={f.id} style={{ gridColumn: 'span 12', minWidth: 0 }}>{control}</div>
    const label = newSet.has(f.id) ? (
      <span className={styles.labelRow}>
        {f.label}
        <span className={styles.newBadge}>НОВОЕ</span>
      </span>
    ) : (
      f.label
    )
    return (
      <FieldRow
        key={f.id}
        label={label}
        htmlFor={id}
        required={Boolean(required[f.id]) && mode === 'edit' && !forceView}
        hint={mode === 'edit' && !forceView ? f.hint : undefined}
        error={err}
        span={f.span}
      >
        {control}
      </FieldRow>
    )
  }

  const renderSection = (s: Section) => {
    const fields = bySection.get(s.id)
    if (!fields || fields.length === 0) return null
    const color = sectionColorHex(s.color)
    return (
      <section
        key={s.id}
        className={styles.section}
        aria-label={s.title}
        // Цвет — только полоса слева: заголовок остаётся главным ориентиром.
        style={color ? ({ '--sec-color': color } as CSSProperties) : undefined}
        data-color={color ? s.color : undefined}
      >
        {s.title && <h3 className={styles.sectionTitle}>{s.title}</h3>}
        {/* Вычисляемые системные поля (автор, дата создания, форма) не вводятся — всегда просмотр. */}
        <FieldGrid>
          {fields.map((f) =>
            // Системные вычисляемые и формула — всегда просмотр; у подстановки
            // свой read-only Edit с подсказкой «после сохранения».
            renderField(f, isComputedField({ system: f.system }) || f.type === 'formula'),
          )}
        </FieldGrid>
      </section>
    )
  }

  return (
    <div className={[styles.form, className].filter(Boolean).join(' ')}>
      {sections.map(renderSection)}
      {archived.length > 0 && (
        <details className={styles.archived}>
          <summary>Архивные поля · {archived.length}</summary>
          <div className={styles.archivedBody}>
            <FieldGrid>{archived.map((f) => renderField(f, true))}</FieldGrid>
          </div>
        </details>
      )}
    </div>
  )
}
