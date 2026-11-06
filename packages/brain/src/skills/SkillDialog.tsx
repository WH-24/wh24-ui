import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Combobox, FieldGrid, FieldRow, Input, Textarea, type ComboboxOption } from '@wowhaus-24/ui-react'

import { BrainApiError } from '../api.js'
import { BrainSwitch } from '../agents/Switch.js'
import { BrainDialog } from '../fields/Dialog.js'
import { brainErrorText } from '../fields/errors.js'
import { SKILL_STATUS_LABEL, SLASH_HINT, normalizeSlash, slashProblem, slugify } from './labels.js'
import type { SkillsApi } from './client.js'
import { SKILL_LIMITS, type Skill, type SkillDraft, type SkillPatch, type SkillStatus } from './types.js'
import styles from './skills.module.css'

export interface SkillDialogProps {
  api: { skills: Pick<SkillsApi, 'create' | 'update'> }
  open: boolean
  onClose: () => void
  /** Правка существующего навыка; без него — создание. */
  skill?: Skill | null
  /** Заготовка для создания (например, предложение из «Найти в чатах»). */
  initial?: Partial<SkillDraft>
  /** Только управляющий может сделать навык общим («Видна всем»). */
  canPublish?: boolean
  onSaved?: (skill: Skill, info: { created: boolean }) => void
}

interface FormState {
  name: string
  slash: string
  description: string
  instructions: string
  status: SkillStatus
  isPublic: boolean
}

function initialState(skill: Skill | null | undefined, initial: Partial<SkillDraft> | undefined): FormState {
  if (skill) {
    return {
      name: skill.name,
      slash: skill.slash,
      description: skill.description ?? '',
      instructions: skill.instructions,
      status: skill.status,
      isPublic: skill.visibility === 'public',
    }
  }
  return {
    name: initial?.name ?? '',
    slash: normalizeSlash(initial?.slash ?? '') || slugify(initial?.name ?? ''),
    description: initial?.description ?? '',
    instructions: initial?.instructions ?? '',
    status: initial?.status ?? 'active',
    isPublic: initial?.visibility === 'public',
  }
}

const STATUS_OPTIONS: ComboboxOption[] = (['active', 'draft', 'archived'] as SkillStatus[]).map((s) => ({
  value: s,
  label: SKILL_STATUS_LABEL[s],
  hint: s === 'active' ? 'Работает по «/» и в вопросах' : s === 'draft' ? 'Пока не работает' : 'Спрятан, не работает',
}))

/** Поля формы, у которых есть место для текста ошибки. */
const FIELD_ERROR_KEYS = new Set(['name', 'slash', 'description', 'instructions'])

function problems(s: FormState): Record<string, string> {
  const p: Record<string, string> = {}
  const name = s.name.trim()
  if (!name) p.name = 'Дайте навыку название.'
  else if (name.length > SKILL_LIMITS.name) p.name = `Название длиннее ${SKILL_LIMITS.name} символов.`
  const sp = slashProblem(s.slash)
  if (sp) p.slash = sp
  if (!s.instructions.trim()) p.instructions = 'Опишите, что ИИ должен делать по этой команде.'
  else if (s.instructions.length > SKILL_LIMITS.instructions) p.instructions = `Инструкции длиннее ${SKILL_LIMITS.instructions} символов.`
  if (s.description.length > SKILL_LIMITS.description) p.description = `Описание длиннее ${SKILL_LIMITS.description} символов.`
  return p
}

/**
 * Создание и правка навыка: название, команда (с «/» и живой проверкой формата,
 * подсказка из названия), описание для меню «/», инструкции (до 4000 знаков),
 * статус и «Видна всем» (только управляющему). Ошибки сервера (в том числе
 * «команда занята») подсвечивают своё поле.
 */
export function SkillDialog({ api, open, onClose, skill, initial, canPublish, onSaved }: SkillDialogProps) {
  const editing = Boolean(skill)
  const [s, setS] = useState<FormState>(() => initialState(skill, initial))
  const [slashTouched, setSlashTouched] = useState(false)
  const [touched, setTouched] = useState(false)
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const uid = useId()
  const id = (name: string) => `${uid}-${name}`
  const nameRef = useRef<HTMLInputElement>(null)
  // `initial` хост нередко передаёт литералом — форма не должна сбрасываться на каждый его рендер.
  const initialRef = useRef(initial)
  initialRef.current = initial

  useEffect(() => {
    if (!open) return
    const init = initialRef.current
    setS(initialState(skill, init))
    setSlashTouched(Boolean(skill) || Boolean(init?.slash))
    setTouched(false)
    setServerErrors({})
    setFormError('')
    setSaving(false)
  }, [open, skill])

  const local = useMemo(() => problems(s), [s])
  const err = (k: string): string | undefined => serverErrors[k] || (touched ? local[k] : undefined)
  const errNode = (k: string): ReactNode =>
    err(k) ? (
      <span id={id(`${k}-err`)} role="alert">
        {err(k)}
      </span>
    ) : undefined
  const describedBy = (k: string, extra?: string): string | undefined =>
    [err(k) ? id(`${k}-err`) : '', extra ?? ''].filter(Boolean).join(' ') || undefined

  const change = (patch: Partial<FormState>, keys: string[] = []) => {
    setS((v) => ({ ...v, ...patch }))
    if (keys.length) setServerErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !keys.includes(k))))
    setFormError('')
  }

  const onName = (name: string) => {
    // Пока команду не правили руками, она следует за названием.
    if (!slashTouched && !editing) change({ name, slash: slugify(name) }, ['name', 'slash'])
    else change({ name }, ['name'])
  }

  const slugHint = !slashTouched || s.slash === ''
  const suggested = slugify(s.name)
  const canSuggest = !editing && s.name.trim() !== '' && suggested !== '' && suggested !== s.slash

  const save = async () => {
    setTouched(true)
    setFormError('')
    setServerErrors({})
    const firstBad = ['name', 'slash', 'instructions', 'description'].find((k) => local[k])
    if (firstBad) {
      requestAnimationFrame(() => document.getElementById(id(firstBad))?.focus())
      return
    }
    const body: SkillDraft = {
      name: s.name.trim(),
      slash: s.slash,
      description: s.description.trim(),
      instructions: s.instructions.trim(),
      status: s.status,
      ...(canPublish ? { visibility: s.isPublic ? 'public' : 'private' } : {}),
    }
    setSaving(true)
    try {
      if (skill) {
        const patch: SkillPatch = {}
        if (body.name !== skill.name) patch.name = body.name
        if (body.slash !== skill.slash) patch.slash = body.slash
        if (body.description !== (skill.description ?? '')) patch.description = body.description
        if (body.instructions !== skill.instructions) patch.instructions = body.instructions
        if (body.status !== skill.status) patch.status = body.status
        if (body.visibility && body.visibility !== skill.visibility) patch.visibility = body.visibility
        const saved = Object.keys(patch).length > 0 ? await api.skills.update(skill.id, patch) : skill
        onSaved?.(saved, { created: false })
      } else {
        const created = await api.skills.create(body)
        onSaved?.(created, { created: true })
      }
      onClose()
    } catch (e) {
      if (e instanceof BrainApiError && e.field && FIELD_ERROR_KEYS.has(e.field)) {
        setServerErrors({ [e.field]: e.message })
        requestAnimationFrame(() => document.getElementById(id(e.field!))?.focus())
      } else {
        setFormError(brainErrorText(e))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <BrainDialog
      open={open}
      onClose={onClose}
      title={editing ? 'Редактировать навык' : 'Новый навык'}
      description="Сохранённая инструкция: ИИ выполнит её, когда вы начнёте вопрос с команды."
      busy={saving}
      initialFocus={nameRef}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Отмена
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving}>
            {saving ? 'Сохраняю…' : editing ? 'Сохранить' : 'Создать навык'}
          </button>
        </>
      }
    >
      <FieldGrid>
        <FieldRow label="Название" htmlFor={id('name')} required span={12} error={errNode('name')}>
          <Input
            ref={nameRef}
            id={id('name')}
            aria-describedby={describedBy('name')}
            value={s.name}
            maxLength={SKILL_LIMITS.name + 20}
            placeholder="Например, «Дайджест проекта»"
            invalid={Boolean(err('name'))}
            onChange={(e) => onName(e.target.value)}
          />
        </FieldRow>

        <FieldRow
          label="Команда"
          htmlFor={id('slash')}
          required
          span={12}
          error={errNode('slash')}
          hint={<span id={id('slash-hint')}>{SLASH_HINT} Вызов: «/{s.slash || 'команда'} о чём спросить».</span>}
        >
          <div className={styles.slashRow}>
            <span className={styles.slashPrefix} aria-hidden="true">
              /
            </span>
            <Input
              id={id('slash')}
              aria-describedby={describedBy('slash', id('slash-hint'))}
              value={s.slash}
              maxLength={SKILL_LIMITS.slashMax + 10}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="дайджест"
              invalid={Boolean(err('slash'))}
              onChange={(e) => {
                setSlashTouched(true)
                change({ slash: normalizeSlash(e.target.value.replace(/\s+/g, '-')) }, ['slash'])
              }}
            />
            {canSuggest && slugHint && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => change({ slash: suggested }, ['slash'])}>
                /{suggested}
              </button>
            )}
          </div>
        </FieldRow>

        <FieldRow
          label="Описание для меню «/»"
          htmlFor={id('description')}
          span={12}
          error={errNode('description')}
          hint="Необязательно: короткая подпись, чтобы узнать навык в списке."
        >
          <Input
            id={id('description')}
            aria-describedby={describedBy('description')}
            value={s.description}
            maxLength={SKILL_LIMITS.description + 20}
            invalid={Boolean(err('description'))}
            onChange={(e) => change({ description: e.target.value }, ['description'])}
          />
        </FieldRow>

        <FieldRow
          label="Инструкции"
          htmlFor={id('instructions')}
          required
          span={12}
          error={errNode('instructions')}
          hint={
            <span>
              Что ИИ должен сделать и как оформить результат. Остаток вопроса после команды ИИ получит как задание.{' '}
              <span className={styles.counter} aria-live="polite">
                {s.instructions.length} / {SKILL_LIMITS.instructions}
              </span>
            </span>
          }
        >
          <Textarea
            id={id('instructions')}
            aria-describedby={describedBy('instructions')}
            rows={7}
            value={s.instructions}
            invalid={Boolean(err('instructions'))}
            onChange={(e) => change({ instructions: e.target.value }, ['instructions'])}
          />
        </FieldRow>

        <FieldRow label="Статус" htmlFor={id('status')} span={12}>
          <Combobox
            id={id('status')}
            options={STATUS_OPTIONS}
            value={s.status}
            ariaLabel="Статус навыка"
            clearable={false}
            searchable={false}
            onChange={(v) => change({ status: v as SkillStatus })}
          />
        </FieldRow>
      </FieldGrid>

      {canPublish && (
        <div className={styles.switches}>
          <BrainSwitch checked={s.isPublic} onChange={(v) => change({ isPublic: v })} describedBy={id('public-hint')}>
            Видна всем
          </BrainSwitch>
          <p id={id('public-hint')} className={styles.switchHint}>
            Навык увидят и смогут вызвать все, у кого есть доступ к модулю ИИ. Команда общего навыка уникальна.
          </p>
        </div>
      )}

      {formError && (
        <p className={styles.formError} role="alert">
          {formError}
        </p>
      )}
    </BrainDialog>
  )
}
