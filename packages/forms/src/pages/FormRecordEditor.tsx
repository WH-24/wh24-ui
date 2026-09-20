/**
 * FormRecordEditor — экран C в режиме создания/редактирования.
 *
 * Правила:
 *  - валидация перед отправкой тем же validateRecord, что и на бэкенде;
 *    ошибки — списком и инлайн у полей (после неуспешного сохранения);
 *  - серверные 400 (fields) ложатся на те же места, 409/403/503 — баннером,
 *    с различением «форма не опубликована», «нет прав», «сервис лежит»;
 *  - редактирование старой записи под новой версией формы: баннер «Форма
 *    обновлена» и бейджи «НОВОЕ» у появившихся полей (recordSchema → diff);
 *  - файлы грузятся сразу (S3) — но только у существующей записи: у новой ещё
 *    нет id, вложениям некуда лечь, контрол это объясняет;
 *  - guard несохранённых изменений: beforeunload + onDirtyChange для хоста.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Icon, Input } from '@wowhaus-24/ui-react'

import { FormsApiError, type FormsApi } from '../api.js'
import type { Field, Form, FormFile, FormRecord, RecordData, RecordFieldError, SchemaDocument } from '../types.js'
import { FormRenderer } from '../render/FormRenderer.js'
import { formatValue, isBlank } from '../render/format.js'
import type { RenderContext } from '../render/registry.js'
import { validateRecord } from '../validate.js'
import { DEFAULT_RECORD_STATUSES, StatusPill, statusLabel, type StatusLabel } from './StatusPill.js'
import { Banner } from './states.js'
import styles from './pages.module.css'

export interface FormRecordEditorProps {
  form: Form
  /** Схема ТЕКУЩЕЙ опубликованной версии: и новая, и правимая запись сохраняются под ней. */
  schema: SchemaDocument
  api: FormsApi
  /** Нет — создание. */
  record?: FormRecord
  /** Схема версии записи — чтобы отметить поля, появившиеся позже. */
  recordSchema?: SchemaDocument
  ctx?: Omit<RenderContext, 'onUploadFiles' | 'onRemoveFile' | 'onOpenFile'>
  /** Метаданные уже прикреплённых файлов (имена, размеры). */
  filesById?: Record<string, FormFile>
  statusLabels?: Record<string, StatusLabel>
  onSaved: (record: FormRecord) => void
  onCancel: () => void
  onDirtyChange?: (dirty: boolean) => void
  onBack?: () => void
  backLabel?: string
  /** Дополнительные действия справа в шапке. */
  actions?: ReactNode
}

function newFieldIdsOf(current: SchemaDocument, previous: SchemaDocument | undefined): string[] {
  if (!previous) return []
  const had = new Set(previous.fields.map((f) => f.id))
  return current.fields.filter((f) => !had.has(f.id) && !f.archived).map((f) => f.id)
}

function describeError(e: unknown): { text: string; tone: 'bad' | 'warn' } {
  if (e instanceof FormsApiError) {
    if (e.status === 409) return { text: 'Форма не опубликована — записи в неё сейчас не принимаются.', tone: 'warn' }
    if (e.forbidden) return { text: 'Нет прав на запись в этом модуле. Обратитесь к администратору модуля.', tone: 'warn' }
    if (e.unavailable) return { text: 'Сервис временно недоступен — не удалось проверить права или значения. Повторите позже.', tone: 'bad' }
    if (e.notFound) return { text: 'Запись или форма не найдена — возможно, удалена.', tone: 'bad' }
    return { text: e.message, tone: 'bad' }
  }
  return { text: 'Не удалось сохранить: проверьте соединение и повторите.', tone: 'bad' }
}

export function FormRecordEditor({
  form,
  schema,
  api,
  record,
  recordSchema,
  ctx = {},
  filesById: initialFiles,
  statusLabels = DEFAULT_RECORD_STATUSES,
  onSaved,
  onCancel,
  onDirtyChange,
  onBack,
  backLabel,
  actions,
}: FormRecordEditorProps) {
  const initial = useMemo<RecordData>(() => ({ ...(record?.data ?? {}) }), [record])
  const [values, setValues] = useState<RecordData>(initial)
  const [titleText, setTitleText] = useState(record?.title ?? '')
  const [errors, setErrors] = useState<RecordFieldError[]>([])
  const [banner, setBanner] = useState<{ text: string; tone: 'bad' | 'warn' } | null>(null)
  const [saving, setSaving] = useState(false)
  const [files, setFiles] = useState<Record<string, FormFile>>(initialFiles ?? {})

  const titleField: Field | undefined = schema.fields.find((f) => f.id === schema.title_field)
  const derivedTitle = titleField ? formatValue(titleField, values[titleField.id], ctx) : ''
  const title = titleField ? (derivedTitle === '—' ? '' : derivedTitle) : titleText

  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initial) || (!titleField && titleText !== (record?.title ?? '')),
    [values, initial, titleField, titleText, record?.title],
  )
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange])
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const newIds = useMemo(() => newFieldIdsOf(schema, recordSchema), [schema, recordSchema])
  const newRequired = newIds.filter((id) => {
    const f = schema.fields.find((x) => x.id === id)
    return f?.required && isBlank(values[id])
  })

  const setValue = useCallback((id: string, v: unknown) => {
    setValues((prev) => {
      const next = { ...prev }
      if (v === undefined) delete next[id]
      else next[id] = v
      return next
    })
    // Правка поля снимает его ошибку: чинить и видеть старую претензию — путает.
    setErrors((prev) => prev.filter((e) => e.field_id !== id))
  }, [])

  // ─── Файлы ───
  const uploadFiles = useCallback(
    async (field: Field, picked: File[]) => {
      if (!record) return
      for (const file of picked) {
        try {
          const saved = await api.records.uploadFile(form.id, record.id, field.id, file)
          setFiles((prev) => ({ ...prev, [saved.id]: saved }))
          setValues((prev) => {
            const cur = Array.isArray(prev[field.id]) ? (prev[field.id] as unknown[]) : []
            return { ...prev, [field.id]: [...cur, saved.id] }
          })
        } catch (e) {
          setBanner({ text: `Файл «${file.name}» не загружен: ${describeError(e).text}`, tone: 'bad' })
        }
      }
    },
    [api, form.id, record],
  )
  const removeFile = useCallback((field: Field, fileId: string) => {
    setValues((prev) => {
      const cur = Array.isArray(prev[field.id]) ? (prev[field.id] as unknown[]) : []
      const next = cur.filter((id) => id !== fileId)
      const out = { ...prev }
      if (next.length) out[field.id] = next
      else delete out[field.id]
      return out
    })
  }, [])
  const openFile = useCallback(
    async (_field: Field, fileId: string) => {
      if (!record) return
      try {
        const { url } = await api.records.fileUrl(form.id, record.id, fileId)
        window.open(url, '_blank', 'noopener')
      } catch (e) {
        setBanner({ text: `Не удалось открыть файл: ${describeError(e).text}`, tone: 'bad' })
      }
    },
    [api, form.id, record],
  )

  const renderCtx: RenderContext = {
    ...ctx,
    filesById: { ...(ctx.filesById ?? {}), ...files },
    onUploadFiles: record ? uploadFiles : undefined,
    onRemoveFile: record ? removeFile : undefined,
    onOpenFile: record ? openFile : undefined,
  }

  // ─── Сохранение ───
  const topRef = useRef<HTMLDivElement>(null)
  const save = async () => {
    setBanner(null)
    const local = validateRecord(schema, values)
    if (!titleField && !title.trim()) {
      local.unshift({ code: 'required', message: 'укажите название записи' })
    }
    if (local.length) {
      setErrors(local)
      topRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      return
    }
    setSaving(true)
    try {
      const body = { title: title.trim(), data: values }
      const saved = record
        ? await api.records.update(form.id, record.id, body)
        : await api.records.create(form.id, body)
      setErrors([])
      onSaved(saved)
    } catch (e) {
      if (e instanceof FormsApiError && e.status === 400 && e.fields?.length) {
        setErrors(e.fields)
        setBanner({ text: 'Сервер не принял запись — исправьте отмеченные поля.', tone: 'bad' })
      } else {
        setBanner(describeError(e))
      }
      topRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    } finally {
      setSaving(false)
    }
  }

  const s = record ? statusLabel(record.status, statusLabels) : null
  const generalErrors = errors.filter((e) => !e.field_id)

  return (
    <div className={styles.page} ref={topRef}>
      {onBack && (
        <div>
          <button type="button" className={['btn', 'btn-ghost', 'btn-sm', styles.back].join(' ')} onClick={onBack}>
            <Icon name="back" size={14} />
            {backLabel ?? form.nav_label ?? form.name}
          </button>
        </div>
      )}
      <div className={styles.recHead}>
        <div className={styles.recNum} aria-label={record ? `Запись № ${record.number}` : 'Новая запись'}>
          {record ? `№${record.number}` : 'new'}
        </div>
        <div className={styles.recTitleWrap}>
          <div className={styles.recTitleRow}>
            {titleField ? (
              <h1 className={styles.recTitle} title={title}>
                {title || <span className={styles.muted}>{record ? 'Без названия' : 'Новая запись'}</span>}
              </h1>
            ) : (
              <Input
                className={styles.recTitleInput}
                aria-label="Название записи"
                placeholder="Название записи"
                value={titleText}
                invalid={generalErrors.length > 0}
                onChange={(e) => {
                  setTitleText(e.target.value)
                  setErrors((prev) => prev.filter((x) => x.field_id))
                }}
              />
            )}
            {s && <StatusPill tone={s.tone}>{s.label}</StatusPill>}
          </div>
          {titleField && (
            <div className={styles.recMeta}>Название — из поля «{titleField.label || titleField.key}»</div>
          )}
        </div>
        <div className={styles.actions}>
          {actions}
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={saving}>
            Отмена
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </div>

      {banner && <Banner tone={banner.tone}>{banner.text}</Banner>}
      {generalErrors.length > 0 && (
        <Banner tone="bad">
          <ul className={styles.bannerList} style={{ margin: 0 }}>
            {generalErrors.map((e, i) => (
              <li key={i}>{e.message}</li>
            ))}
          </ul>
        </Banner>
      )}
      {errors.some((e) => e.field_id) && (
        <Banner tone="bad">
          Не сохранено: {errors.filter((e) => e.field_id).length === 1 ? 'одно поле заполнено' : 'поля заполнены'} с
          ошибками — они отмечены ниже.
        </Banner>
      )}
      {record && newIds.length > 0 && (
        <Banner tone="warn">
          Форма обновлена (v{record.form_version} → v{form.current_version}).
          {newRequired.length > 0
            ? ` Заполните новые обязательные поля: ${newRequired.length}.`
            : ' Появились новые поля — они отмечены «НОВОЕ».'}
        </Banner>
      )}

      <FormRenderer
        doc={schema}
        values={values}
        mode="edit"
        onChange={setValue}
        errors={errors}
        ctx={renderCtx}
        disabled={saving}
        newFieldIds={newIds}
      />

      <div className={styles.footer}>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
          Отмена
        </button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Сохраняем…' : record ? 'Сохранить' : 'Создать запись'}
        </button>
      </div>
    </div>
  )
}
