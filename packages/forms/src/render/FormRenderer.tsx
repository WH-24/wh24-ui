/**
 * FormRenderer — тело записи: секции → 12-колоночная сетка → поля через
 * fieldRegistry. Один компонент на три места: карточка записи (просмотр и
 * редактирование), drawer быстрого просмотра, live-превью в редакторе схемы.
 *
 * Видимость поля считает ТОЛЬКО conditions/evaluate — та же функция, что у
 * валидатора и у бэкенда. Скрытое поле не рендерится вовсе (не display:none):
 * его контрол не должен получать фокус табом и не должен участвовать в
 * автозаполнении браузера.
 *
 * Архивные поля (archived=true) со значением показываются свёрнутым блоком
 * «Архивные поля» только для чтения — значение уже сохранено и пользователь
 * должен видеть, что оно есть; без значения — не показываются вовсе.
 */
import { useId, useMemo } from 'react'
import { FieldGrid, FieldRow } from '@wowhaus-24/ui-react'

import { evaluate } from '../conditions/conditions.js'
import type { Field, RecordData, RecordFieldError, SchemaDocument, Section } from '../types.js'
import { isPresentation } from '../types.js'
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

/** Видимые (по visible_if) неархивные поля секции в порядке документа. */
export function visibleFields(doc: SchemaDocument, values: RecordData): Field[] {
  return doc.fields.filter((f) => {
    if (f.archived) return false
    try {
      return evaluate(f.visible_if, values)
    } catch {
      return true
    }
  })
}

const noop = () => {}

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
        value={values[f.id]}
        onChange={onChange ? (v) => onChange(f.id, v) : noop}
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
        required={f.required && mode === 'edit' && !forceView}
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
    return (
      <section key={s.id} className={styles.section} aria-label={s.title}>
        {s.title && <h3 className={styles.sectionTitle}>{s.title}</h3>}
        <FieldGrid>{fields.map((f) => renderField(f, false))}</FieldGrid>
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
