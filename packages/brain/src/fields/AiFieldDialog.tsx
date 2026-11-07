import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Combobox, FieldGrid, FieldRow, Icon, Input, Textarea, type ComboboxOption } from '@wowhaus-24/ui-react'

import { BrainApiError } from '../api.js'
import { BrainSwitch } from '../agents/Switch.js'
import { formatCost } from '../agents/labels.js'
import { PrivacyNotice } from '../meta/PrivacyNotice.js'
import { BrainDialog } from './Dialog.js'
import type { FieldsApi } from './client.js'
import { brainErrorText } from './errors.js'
import { AI_FIELD_KINDS, AI_FIELD_KIND_LABEL, LANGUAGES, SENTIMENT_OPTIONS } from './labels.js'
import type { AiField, AiFieldDraft, AiFieldKind, AiFieldPatch, FieldPreview } from './types.js'
import styles from './fields.module.css'

export interface AiFieldDialogProps {
  api: { fields: Pick<FieldsApi, 'create' | 'update' | 'preview' | 'getPreview'> }
  open: boolean
  onClose: () => void
  /** Список, для которого заводится колонка: `oup` / `lead`, `tasks` / `task`, `forms` / `form_record`… */
  module: string
  entityType: string
  /** Записи форм: id формы — колонка принадлежит ей. Для остальных списков не передаётся. */
  scope?: string
  /** Правка существующей колонки; без неё — создание. */
  field?: AiField | null
  /** Только управляющий может сделать колонку общей («Видна всем»). */
  canManage?: boolean
  /** id записей списка для «Попробовать на 3 строках» (берутся первые три); пусто — кнопки нет. */
  previewIds?: string[]
  /**
   * Сохранено. `valuesReset` — смысл ячейки изменился, посчитанные значения стёрты:
   * хост показывает подсказку и перечитывает значения.
   */
  onSaved?: (field: AiField, info: { created: boolean; valuesReset: boolean }) => void
}

const MAX_LABEL = 60
const MAX_OPTIONS = 12
const MAX_OPTION = 40
const PREVIEW_ROWS = 3

const KIND_OPTIONS: ComboboxOption[] = AI_FIELD_KINDS.map((k) => ({
  value: k,
  label: AI_FIELD_KIND_LABEL[k].title,
  hint: AI_FIELD_KIND_LABEL[k].hint,
}))

interface FormState {
  label: string
  kind: AiFieldKind
  prompt: string
  options: string[]
  language: string
  onChange: boolean
  isPublic: boolean
}

function initialState(f: AiField | null | undefined): FormState {
  return {
    label: f?.label ?? '',
    kind: f?.kind ?? 'summary',
    prompt: f?.prompt ?? '',
    options: f?.kind === 'categorize' ? [...(f.params.options ?? [])] : [],
    language: f?.params.language || 'английский',
    onChange: f?.on_change ?? false,
    isPublic: f?.visibility === 'public',
  }
}

/** Поля формы, у которых есть место для текста ошибки. */
const FIELD_ERROR_KEYS = new Set(['label', 'prompt', 'options', 'language'])

/**
 * Ошибка сервера `field` → ключ поля формы. Для поля без места под ошибку (`scope`,
 * `kind`, `entity_type`) — `undefined`: сообщение сервера уйдёт общим блоком, а не потеряется.
 */
function formKey(field: string | undefined): string | undefined {
  if (!field) return undefined
  const key = field === 'params.options' ? 'options' : field === 'params.language' ? 'language' : field
  return FIELD_ERROR_KEYS.has(key) ? key : undefined
}

/** Проверка до отправки — те же правила, что у сервера (`fields.Normalize`). */
function problems(s: FormState): Record<string, string> {
  const p: Record<string, string> = {}
  const label = s.label.trim()
  if (!label) p.label = 'Дайте колонке название.'
  else if (label.length > MAX_LABEL) p.label = `Название длиннее ${MAX_LABEL} символов.`
  if (s.kind === 'custom' && !s.prompt.trim()) p.prompt = 'Опишите, что ИИ должен писать в ячейке.'
  if (s.kind === 'categorize') {
    const n = new Set(s.options.map((o) => o.trim().toLowerCase()).filter(Boolean)).size
    if (n < 2) p.options = 'Добавьте хотя бы два варианта.'
  }
  return p
}

function paramsOf(s: FormState): AiFieldDraft['params'] {
  switch (s.kind) {
    case 'categorize':
      return { options: s.options.map((o) => o.trim()).filter(Boolean) }
    case 'translate':
      return { language: s.language }
    case 'sentiment':
      return { options: [...SENTIMENT_OPTIONS] }
    default:
      return {}
  }
}

/**
 * Создание и правка колонки «Поле ИИ»: название, вид и его параметры (варианты
 * категории, язык перевода, свой промпт), «Обновлять при изменении записи»,
 * «Видна всем» (только управляющему) и «Попробовать на 3 строках» — проба до
 * сохранения, в базу ничего не пишет. Ошибки проверки сервера подсвечивают своё поле.
 */
export function AiFieldDialog({
  api,
  open,
  onClose,
  module,
  entityType,
  scope,
  field,
  canManage,
  previewIds,
  onSaved,
}: AiFieldDialogProps) {
  const editing = Boolean(field)
  const [s, setS] = useState<FormState>(() => initialState(field))
  const [newOption, setNewOption] = useState('')
  const [touched, setTouched] = useState(false)
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<{ state: 'idle' | 'running' | 'done' | 'error'; data?: FieldPreview; error?: string }>({
    state: 'idle',
  })
  const previewRun = useRef(0)
  const uid = useId()
  const id = (name: string) => `${uid}-${name}`
  const labelRef = useRef<HTMLInputElement>(null)

  // Каждое открытие — с чистого листа (или с данными правки).
  useEffect(() => {
    if (!open) return
    previewRun.current++
    setS(initialState(field))
    setNewOption('')
    setTouched(false)
    setServerErrors({})
    setFormError('')
    setSaving(false)
    setPreview({ state: 'idle' })
  }, [open, field])

  useEffect(() => () => void previewRun.current++, [])

  const local = useMemo(() => problems(s), [s])
  const err = (k: string): string | undefined => serverErrors[k] || (touched ? local[k] : undefined)
  /** Текст ошибки поля как узел: `role="alert"` объявляет его сразу, `id` связывает с полем через aria-describedby. */
  const errNode = (k: string): ReactNode =>
    err(k) ? (
      <span id={id(`${k}-err`)} role="alert">
        {err(k)}
      </span>
    ) : undefined
  const describedBy = (k: string): string | undefined => (err(k) ? id(`${k}-err`) : undefined)

  const change = (patch: Partial<FormState>, keys: string[] = []) => {
    setS((v) => ({ ...v, ...patch }))
    if (keys.length) setServerErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !keys.includes(k))))
    // Описание поменялось — проба уже не про него.
    previewRun.current++
    setPreview((p) => (p.state === 'idle' ? p : { state: 'idle' }))
    setFormError('')
  }

  const addOption = () => {
    const v = newOption.trim()
    if (!v) return
    if (s.options.some((o) => o.trim().toLowerCase() === v.toLowerCase())) {
      setServerErrors((e) => ({ ...e, options: `Вариант «${v}» уже есть.` }))
      return
    }
    if (s.options.length >= MAX_OPTIONS) {
      setServerErrors((e) => ({ ...e, options: `Не больше ${MAX_OPTIONS} вариантов.` }))
      return
    }
    change({ options: [...s.options, v] }, ['options'])
    setNewOption('')
  }

  const languageOptions: ComboboxOption[] = useMemo(() => {
    const list: string[] = [...LANGUAGES]
    if (s.language && !list.includes(s.language)) list.unshift(s.language)
    return list.map((l) => ({ value: l, label: l }))
  }, [s.language])

  const draft = (): AiFieldDraft => ({
    module,
    entity_type: entityType,
    ...((field?.scope || scope) ? { scope: field?.scope || scope } : {}),
    label: s.label.trim(),
    kind: s.kind,
    prompt: s.prompt.trim(),
    params: paramsOf(s),
    on_change: s.onChange,
    visibility: canManage && s.isPublic ? 'public' : 'private',
  })

  const showServerError = (e: unknown) => {
    if (e instanceof BrainApiError && e.status === 400 && e.field) {
      const k = formKey(e.field)
      if (k) {
        setServerErrors((prev) => ({ ...prev, [k]: e.message }))
        return
      }
    }
    setFormError(brainErrorText(e))
  }

  const save = async () => {
    setTouched(true)
    setFormError('')
    setServerErrors({})
    const firstBad = ['label', 'options', 'prompt'].find((k) => local[k])
    if (firstBad) {
      // Фокус — на первое неверное поле: клавиатура и скринридер сразу попадают к ошибке.
      requestAnimationFrame(() => document.getElementById(id(firstBad === 'options' ? 'options' : firstBad))?.focus())
      return
    }
    setSaving(true)
    try {
      if (field) {
        const d = draft()
        const patch: AiFieldPatch = { label: d.label, prompt: d.prompt, params: d.params, on_change: d.on_change }
        if (canManage) patch.visibility = d.visibility
        const res = await api.fields.update(field.id, patch)
        onSaved?.(res.field, { created: false, valuesReset: res.values_reset })
      } else {
        const created = await api.fields.create(draft())
        onSaved?.(created, { created: true, valuesReset: false })
      }
      onClose()
    } catch (e) {
      showServerError(e)
    } finally {
      setSaving(false)
    }
  }

  const ids = (previewIds ?? []).slice(0, PREVIEW_ROWS)
  const runPreview = async () => {
    setTouched(true)
    if (Object.keys(local).length > 0 || ids.length === 0) return
    const run = ++previewRun.current
    setPreview({ state: 'running' })
    try {
      const { preview_id } = await api.fields.preview({ ...draft(), entity_ids: ids })
      let delay = 700
      for (let i = 0; i < 60; i++) {
        const p = await api.fields.getPreview(preview_id)
        if (run !== previewRun.current) return
        if (p.status === 'done') {
          setPreview({ state: 'done', data: p })
          return
        }
        setPreview({ state: 'running', data: p })
        await new Promise((r) => setTimeout(r, delay))
        if (run !== previewRun.current) return
        delay = Math.min(2000, Math.round(delay * 1.4))
      }
      setPreview({ state: 'error', error: 'ИИ не успел ответить — попробуйте ещё раз.' })
    } catch (e) {
      if (run !== previewRun.current) return
      if (e instanceof BrainApiError && e.status === 400 && e.field) {
        const k = formKey(e.field)
        if (k) setServerErrors((prev) => ({ ...prev, [k]: e.message }))
        setPreview({ state: 'idle' })
        return
      }
      setPreview({ state: 'error', error: brainErrorText(e) })
    }
  }

  const busy = saving

  return (
    <BrainDialog
      open={open}
      onClose={onClose}
      title={editing ? 'Настроить поле ИИ' : 'Новое поле ИИ'}
      description="Колонка, которую заполняет ИИ по каждой записи списка."
      busy={busy}
      initialFocus={labelRef}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Отмена
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? 'Сохраняю…' : editing ? 'Сохранить' : 'Создать поле'}
          </button>
        </>
      }
    >
      <FieldGrid>
      <FieldRow label="Название колонки" htmlFor={id('label')} required span={12} error={errNode('label')}>
        <Input
          ref={labelRef}
          id={id('label')}
          aria-describedby={describedBy('label')}
          value={s.label}
          maxLength={MAX_LABEL + 20}
          placeholder="Например, «Теплота лида»"
          invalid={Boolean(err('label'))}
          onChange={(e) => change({ label: e.target.value }, ['label'])}
        />
      </FieldRow>

      <FieldRow
        label="Что заполнять"
        htmlFor={id('kind')}
        span={12}
        hint={editing ? 'Вид колонки не меняется: если нужен другой — создайте новую.' : AI_FIELD_KIND_LABEL[s.kind].hint}
      >
        <Combobox
          id={id('kind')}
          options={KIND_OPTIONS}
          value={s.kind}
          disabled={editing}
          searchable={false}
          ariaLabel="Что заполнять"
          onChange={(v) => change({ kind: v as AiFieldKind }, ['kind', 'prompt', 'options'])}
        />
      </FieldRow>

      {s.kind === 'categorize' && (
        <FieldRow
          label="Варианты"
          span={12}
          required
          error={errNode('options')}
          hint={`От 2 до ${MAX_OPTIONS} вариантов. ИИ выберет один; если ничего не подходит — «Не определено».`}
        >
          <div className={styles.options} id={id('options')} tabIndex={-1} aria-describedby={describedBy('options')}>
            {s.options.length > 0 && (
              <ul className={styles.optionList} aria-label="Варианты категории">
                {s.options.map((o, i) => (
                  <li key={`${o}-${i}`} className={styles.optionRow}>
                    <span className={styles.optionText}>{o}</span>
                    <button
                      type="button"
                      className={styles.optionRemove}
                      aria-label={`Убрать вариант «${o}»`}
                      onClick={() => change({ options: s.options.filter((_, j) => j !== i) }, ['options'])}
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className={styles.optionAdd}>
              <Input
                value={newOption}
                maxLength={MAX_OPTION}
                placeholder="Новый вариант"
                aria-label="Новый вариант"
                invalid={Boolean(err('options'))}
                onChange={(e) => {
                  setNewOption(e.target.value)
                  setServerErrors((prev) => (prev.options ? { ...prev, options: '' } : prev))
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addOption()
                  }
                }}
              />
              <button type="button" className="btn btn-secondary" onClick={addOption} disabled={!newOption.trim()}>
                Добавить
              </button>
            </div>
          </div>
        </FieldRow>
      )}

      {s.kind === 'sentiment' && (
        <p className={styles.fixedNote}>
          ИИ выберет одно из трёх: {SENTIMENT_OPTIONS.join(' · ')}.
        </p>
      )}

      {s.kind === 'translate' && (
        <FieldRow label="На какой язык" htmlFor={id('language')} span={12} error={errNode('language')}>
          <Combobox
            id={id('language')}
            options={languageOptions}
            value={s.language}
            ariaLabel="На какой язык"
            onChange={(v) => change({ language: v }, ['language'])}
          />
        </FieldRow>
      )}

      <FieldRow
        label={s.kind === 'custom' ? 'Что писать в ячейке' : 'Уточнение'}
        htmlFor={id('prompt')}
        span={12}
        required={s.kind === 'custom'}
        error={errNode('prompt')}
        hint={
          s.kind === 'custom'
            ? 'Задание для ИИ по каждой записи: например, «Назови главный риск проекта одним предложением».'
            : 'Необязательно: что учесть, например «упор на сроки и бюджет».'
        }
      >
        <Textarea
          id={id('prompt')}
          aria-describedby={describedBy('prompt')}
          rows={s.kind === 'custom' ? 4 : 2}
          value={s.prompt}
          maxLength={2000}
          invalid={Boolean(err('prompt'))}
          onChange={(e) => change({ prompt: e.target.value }, ['prompt'])}
        />
      </FieldRow>
      </FieldGrid>

      <div className={styles.switches}>
        <BrainSwitch checked={s.onChange} onChange={(v) => change({ onChange: v })} describedBy={id('onchange-hint')}>
          Обновлять при изменении записи
        </BrainSwitch>
        <p id={id('onchange-hint')} className={styles.switchHint}>
          Уже заполненные ячейки пересчитываются, когда запись изменилась. Новые записи заполняются кнопкой «Заполнить пустые» в меню колонки.
        </p>
        {canManage && (
          <>
            <BrainSwitch checked={s.isPublic} onChange={(v) => change({ isPublic: v })} describedBy={id('public-hint')}>
              Видна всем
            </BrainSwitch>
            <p id={id('public-hint')} className={styles.switchHint}>
              Колонку увидят все, у кого есть доступ к модулю ИИ. Значение в ячейке по-прежнему видят только те, у кого есть доступ к записи.
            </p>
          </>
        )}
      </div>

      <PrivacyNotice>
        Значение в ячейке видят только те, у кого есть доступ к самой записи. ИИ читает текст этой записи и её комментарии — других данных портала у него нет.
      </PrivacyNotice>

      {ids.length > 0 && (
        <section className={styles.preview} aria-label="Проба">
          <div className={styles.previewHead}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={runPreview}
              disabled={busy || preview.state === 'running'}
            >
              {preview.state === 'running' ? 'Пробую…' : `Попробовать на ${ids.length === 1 ? '1 строке' : `${ids.length} строках`}`}
            </button>
            <span className={styles.previewNote}>Результат нигде не сохраняется.</span>
          </div>
          <div aria-live="polite">
            {preview.state === 'error' && (
              <p className={styles.error} role="alert">
                {preview.error}
              </p>
            )}
            {(preview.state === 'running' || preview.state === 'done') && preview.data && (
              <ul className={styles.previewList}>
                {preview.data.rows.map((r) => (
                  <li key={r.entity_id} className={styles.previewRow}>
                    <span className={styles.previewTitle}>{r.title || r.entity_id}</span>
                    {!r.done ? (
                      <span className={styles.previewBusy}>
                        <span className={styles.spinner} aria-hidden="true" />
                        Считаю…
                      </span>
                    ) : r.error ? (
                      <span className={styles.previewErr}>{r.error}</span>
                    ) : (
                      <span className={styles.previewText}>{r.text || '—'}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {preview.state === 'done' && preview.data && (
              <p className={styles.previewCost}>Стоимость пробы: {formatCost(preview.data.cost_usd)}</p>
            )}
          </div>
        </section>
      )}

      {formError && (
        <p className={styles.error} role="alert">
          {formError}
        </p>
      )}
    </BrainDialog>
  )
}
