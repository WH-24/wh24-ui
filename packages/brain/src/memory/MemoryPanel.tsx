import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Combobox, Icon, Input, type ComboboxOption } from '@wowhaus-24/ui-react'

import { BrainApiError } from '../api.js'
import { BrainSwitch } from '../agents/Switch.js'
import { BrainConfirm } from '../fields/Dialog.js'
import { brainErrorText } from '../fields/errors.js'
import type { MemoryApi } from './client.js'
import { MemoryImportDialog } from './MemoryImportDialog.js'
import { USER_MEMORY_KIND_LABEL } from './labels.js'
import type { MemoryImportResult, MemoryItem, UserMemoryKind, UserMemory } from './types.js'
import styles from './memory.module.css'

export interface MemoryPanelProps {
  api: { memory: MemoryApi }
  /** Коллеги для «С кем работаю»: выбираются из списка с поиском; можно вписать и своё имя. */
  peopleOptions?: { id: string; name: string }[]
  /** Короткие подтверждения («Память очищена», «Импортировано 5»). Без обработчика они не показываются. */
  onToast?: (message: string, tone: 'info' | 'error') => void
  className?: string
}

const MAX_NICKNAME = 60
const MAX_ROLE = 120

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function limitMessage(max: number): string {
  return `Достигнут предел — ${max} записей. Удалите ненужные и попробуйте ещё раз.`
}

/** Ошибка добавления записи: 409 — лимит, 400 с полем — фраза сервера, остальное — общий текст. */
function addErrorText(e: unknown, max: number): string {
  if (e instanceof BrainApiError && e.status === 409) return limitMessage(max)
  return brainErrorText(e, 'Не удалось сохранить. Попробуйте ещё раз.')
}

interface ListSectionProps {
  title: string
  hint?: string
  kind: UserMemoryKind
  items: MemoryItem[]
  placeholder: string
  maxText: number
  atLimit: boolean
  onAdd: (kind: UserMemoryKind, text: string) => Promise<string | null>
  onRemove: (item: MemoryItem) => void
  /** Для «С кем работаю»: список коллег. */
  people?: ComboboxOption[]
  /** Свой ввод скрыт (раздел «Что ИИ запомнил сам» — только список). */
  readOnly?: boolean
  showKind?: boolean
  emptyText: string
}

function ListSection({ title, hint, kind, items, placeholder, maxText, atLimit, onAdd, onRemove, people, readOnly, showKind, emptyText }: ListSectionProps) {
  const uid = useId()
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const add = async (value: string) => {
    const v = value.trim()
    if (!v || busy) return false
    setBusy(true)
    setError('')
    const err = await onAdd(kind, v)
    setBusy(false)
    if (err) {
      setError(err)
      return false
    }
    return true
  }

  return (
    <section className={styles.section} aria-labelledby={`${uid}-h`}>
      <h3 id={`${uid}-h`} className={styles.sectionTitle}>
        {title}
      </h3>
      {hint && <p className={styles.hint}>{hint}</p>}

      {items.length > 0 ? (
        <ul className={styles.items} aria-label={title}>
          {items.map((it) => (
            <li key={it.id} className={styles.item} data-kind={kind === 'person' ? 'person' : undefined}>
              <span className={styles.itemText}>
                {showKind && <span className={styles.kindTag}>{USER_MEMORY_KIND_LABEL[it.kind]}</span>}
                {it.text}
              </span>
              <button type="button" className={styles.itemRemove} aria-label={`Удалить: ${it.text}`} onClick={() => onRemove(it)}>
                <Icon name="close" size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>{emptyText}</p>
      )}

      {!readOnly && (
        <div className={styles.addBlock}>
          {people && people.length > 0 && (
            <>
              <label htmlFor={`${uid}-people`} className={styles.srOnly}>
                Выбрать коллегу
              </label>
              <Combobox
                id={`${uid}-people`}
                options={people}
              value=""
                ariaLabel="Открыть список коллег"
                placeholder="Выбрать коллегу из списка…"
                clearable={false}
                disabled={atLimit || busy}
                onChange={(v) => {
                  const name = people.find((p) => p.value === v)?.label
                  if (name) void add(name)
                }}
              />
            </>
          )}
          <form
            className={styles.addRow}
            onSubmit={async (e) => {
              e.preventDefault()
              if (await add(text)) setText('')
            }}
          >
            <Input
              value={text}
              maxLength={maxText}
              placeholder={placeholder}
              aria-label={`${title}: новая запись`}
              disabled={atLimit}
              invalid={Boolean(error)}
              onChange={(e) => {
                setText(e.target.value)
                setError('')
              }}
            />
            <button type="submit" className="btn btn-secondary" disabled={atLimit || busy || !text.trim()}>
              Добавить
            </button>
          </form>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  )
}

/** Однострочное поле профиля («Как к вам обращаться», «Роль»): сохраняется по потере фокуса и Enter. */
function ProfileField({
  label,
  hint,
  value,
  placeholder,
  maxLength,
  onSave,
}: {
  label: string
  hint: string
  value: string
  placeholder: string
  maxLength: number
  onSave: (v: string) => Promise<void>
}) {
  const uid = useId()
  const [v, setV] = useState(value)
  const [state, setState] = useState<SaveState>('idle')
  const [error, setError] = useState('')
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => setV(value), [value])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const commit = async () => {
    const next = v.trim()
    if (next === value.trim()) {
      if (v !== next) setV(next)
      return
    }
    setState('saving')
    setError('')
    try {
      await onSave(next)
      setState('saved')
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setState('idle'), 2500)
    } catch (e) {
      setState('error')
      setError(brainErrorText(e, 'Не удалось сохранить.'))
    }
  }

  return (
    <div className={styles.profile}>
      <label htmlFor={`${uid}-i`} className={styles.fieldLabel}>
        {label}
      </label>
      <div className={styles.profileRow}>
        <Input
          id={`${uid}-i`}
          value={v}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-describedby={`${uid}-h ${uid}-s`}
          invalid={state === 'error'}
          onChange={(e) => {
            setV(e.target.value)
            if (state !== 'saving') setState('idle')
          }}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void commit()
            }
          }}
        />
        <span id={`${uid}-s`} className={styles.saveState} role="status" data-state={state}>
          {state === 'saving' ? 'Сохраняю…' : state === 'saved' ? 'Сохранено' : ''}
        </span>
      </div>
      <p id={`${uid}-h`} className={styles.hint}>
        {hint}
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * Личная память ИИ о вас: «Как к вам обращаться», «Роль», переключатель «Использовать
 * память», «Мои предпочтения», «С кем работаю», «Факты о работе», «Что ИИ запомнил сам»,
 * «Импорт памяти» и «Забыть всё». Видна только владельцу — администратор чужую не читает.
 * Панель сама грузит и меняет данные через `api.memory`.
 */
export function MemoryPanel({ api, peopleOptions, onToast, className }: MemoryPanelProps) {
  const [mem, setMem] = useState<UserMemory | null>(null)
  const [loadError, setLoadError] = useState('')
  const [enabledBusy, setEnabledBusy] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [forgetOpen, setForgetOpen] = useState(false)
  const [forgetting, setForgetting] = useState(false)
  const [forgetError, setForgetError] = useState('')
  const memRef = useRef<UserMemory | null>(null)
  memRef.current = mem
  const uid = useId()

  const load = useCallback(async () => {
    setLoadError('')
    try {
      setMem(await api.memory.get())
    } catch (e) {
      setLoadError(brainErrorText(e, 'Не удалось загрузить память.'))
    }
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  const toast = (m: string, tone: 'info' | 'error' = 'info') => onToast?.(m, tone)

  const patchMem = (fn: (m: UserMemory) => UserMemory) => setMem((m) => (m ? fn(m) : m))

  const people = useMemo<ComboboxOption[]>(() => {
    const have = new Set((mem?.items ?? []).filter((i) => i.kind === 'person').map((i) => i.text.trim().toLowerCase()))
    return (peopleOptions ?? []).filter((p) => !have.has(p.name.trim().toLowerCase())).map((p) => ({ value: p.id, label: p.name }))
  }, [peopleOptions, mem])

  if (!mem) {
    return (
      <div className={className}>
        {loadError ? (
          <div className={styles.stateBox} role="alert">
            <p className={styles.stateText}>{loadError}</p>
            <button type="button" className="btn btn-secondary" onClick={() => void load()}>
              Повторить
            </button>
          </div>
        ) : (
          <p className={styles.stateBox} role="status">
            Загружаю память…
          </p>
        )}
      </div>
    )
  }

  const { limits } = mem
  const atLimit = mem.items.length >= limits.max_items
  const manual = (k: UserMemoryKind) => mem.items.filter((i) => i.kind === k && i.source !== 'ai')
  const byAi = mem.items.filter((i) => i.source === 'ai')

  const addItem = async (kind: UserMemoryKind, text: string): Promise<string | null> => {
    try {
      const item = await api.memory.addItem({ kind, text })
      patchMem((m) => ({ ...m, items: [...m.items, item] }))
      return null
    } catch (e) {
      return addErrorText(e, limits.max_items)
    }
  }

  const removeItem = async (item: MemoryItem) => {
    // Убираем сразу; не получилось — возвращаем на место и говорим об этом.
    patchMem((m) => ({ ...m, items: m.items.filter((i) => i.id !== item.id) }))
    try {
      await api.memory.removeItem(item.id)
    } catch (e) {
      patchMem((m) => ({ ...m, items: m.items.some((i) => i.id === item.id) ? m.items : [...m.items, item] }))
      toast(brainErrorText(e, 'Не удалось удалить запись.'), 'error')
    }
  }

  const saveNickname = async (nickname: string) => {
    const next = await api.memory.update({ nickname })
    setMem((m) => (m ? { ...m, nickname: next.nickname, role: next.role } : m))
  }
  const saveRole = async (role: string) => {
    const next = await api.memory.update({ role })
    setMem((m) => (m ? { ...m, nickname: next.nickname, role: next.role } : m))
  }

  const toggleEnabled = async (enabled: boolean) => {
    const before = memRef.current?.enabled ?? true
    patchMem((m) => ({ ...m, enabled }))
    setEnabledBusy(true)
    try {
      const next = await api.memory.update({ enabled })
      patchMem((m) => ({ ...m, enabled: next.enabled }))
    } catch (e) {
      patchMem((m) => ({ ...m, enabled: before }))
      toast(brainErrorText(e, 'Не удалось переключить память.'), 'error')
    } finally {
      setEnabledBusy(false)
    }
  }

  const forgetAll = async () => {
    setForgetting(true)
    setForgetError('')
    try {
      await api.memory.forget()
      patchMem((m) => ({ ...m, items: [], nickname: '', role: '' }))
      setForgetOpen(false)
      toast('Память очищена.')
    } catch (e) {
      setForgetError(brainErrorText(e, 'Не удалось очистить память.'))
    } finally {
      setForgetting(false)
    }
  }

  const imported = (res: MemoryImportResult) => {
    patchMem((m) => ({ ...m, items: [...m.items, ...res.items] }))
    toast(res.added > 0 ? `Импортировано записей: ${res.added}${res.skipped ? `, пропущено: ${res.skipped}` : ''}.` : 'Новых записей не нашлось — всё уже есть в памяти.')
    // Сервер мог добавить больше, чем вернул в `items`, — перечитываем для точности.
    void load()
  }

  return (
    <div className={[styles.panel, className].filter(Boolean).join(' ')}>
      <section className={styles.section} aria-labelledby={`${uid}-use`}>
        <h3 id={`${uid}-use`} className={styles.sectionTitle}>
          Использовать память
        </h3>
        <BrainSwitch checked={mem.enabled} onChange={(v) => void toggleEnabled(v)} disabled={enabledBusy} describedBy={`${uid}-use-h`}>
          {mem.enabled ? 'Память включена' : 'Память выключена'}
        </BrainSwitch>
        <p id={`${uid}-use-h`} className={styles.hint}>
          Это ваша личная память: её видите только вы, администратор чужую не читает. ИИ учитывает её в «Спросить ИИ» и в запусках ваших агентов, но не в общих лентах. Выключите — записи сохранятся, но ИИ перестанет их использовать.
        </p>
      </section>

      <section className={styles.section} aria-label="Обращение и роль">
        <ProfileField
          label="Как к вам обращаться"
          hint="Например: «Тарас». ИИ будет так к вам обращаться."
          value={mem.nickname}
          placeholder="Имя или обращение"
          maxLength={MAX_NICKNAME}
          onSave={saveNickname}
        />
        <ProfileField
          label="Роль"
          hint="Кто вы и чем занимаетесь: «владелец бюро», «ГИП». ИИ подстроит ответы."
          value={mem.role}
          placeholder="Например, владелец бюро"
          maxLength={MAX_ROLE}
          onSave={saveRole}
        />
      </section>

      <ListSection
        title="Мои предпочтения"
        hint="Как вы любите получать ответы."
        kind="preference"
        items={manual('preference')}
        placeholder="Например, отвечай коротко, без вступлений"
        maxText={limits.max_text}
        atLimit={atLimit}
        onAdd={addItem}
        onRemove={(i) => void removeItem(i)}
        emptyText="Пока нет предпочтений."
      />

      <ListSection
        title="С кем работаю"
        hint="Люди, которых ИИ должен узнавать по имени."
        kind="person"
        items={manual('person')}
        placeholder="Или впишите имя"
        maxText={limits.max_text}
        atLimit={atLimit}
        onAdd={addItem}
        onRemove={(i) => void removeItem(i)}
        people={people}
        emptyText="Пока никого."
      />

      <ListSection
        title="Факты о работе"
        hint="Устойчивые факты: проекты, отдел, зоны ответственности."
        kind="fact"
        items={manual('fact')}
        placeholder="Например, веду проект «Дом у озера»"
        maxText={limits.max_text}
        atLimit={atLimit}
        onAdd={addItem}
        onRemove={(i) => void removeItem(i)}
        emptyText="Пока нет фактов."
      />

      <ListSection
        title="Что ИИ запомнил сам"
        hint="ИИ сохраняет факты, когда вы просите «запомни…». Всё, что он записал, видно здесь — лишнее можно удалить."
        kind="fact"
        items={byAi}
        placeholder=""
        maxText={limits.max_text}
        atLimit={atLimit}
        onAdd={addItem}
        onRemove={(i) => void removeItem(i)}
        readOnly
        showKind
        emptyText="ИИ пока ничего не запоминал."
      />

      <div className={styles.footer}>
        <p className={styles.count} role="status">
          Записей: {mem.items.length} из {limits.max_items}
          {atLimit && ' — предел достигнут'}
        </p>
        <div className={styles.footerActions}>
          <button type="button" className="btn btn-secondary" onClick={() => setImportOpen(true)}>
            <Icon name="upload" size={14} />
            Импорт памяти
          </button>
          <button type="button" className="btn btn-secondary" data-danger onClick={() => setForgetOpen(true)}>
            Забыть всё
          </button>
        </div>
      </div>

      <MemoryImportDialog api={api} open={importOpen} onClose={() => setImportOpen(false)} maxText={limits.max_text} onImported={imported} />
      <BrainConfirm
        open={forgetOpen}
        title="Забыть всё, что ИИ о вас знает?"
        message={
          <>
            Будут удалены обращение, роль и все записи — и написанные вами, и запомненные ИИ. Это нельзя отменить.
            {forgetError && (
              <span className={styles.confirmError} role="alert">
                {forgetError}
              </span>
            )}
          </>
        }
        confirmLabel="Забыть всё"
        danger
        busy={forgetting}
        onConfirm={() => void forgetAll()}
        onCancel={() => {
          setForgetOpen(false)
          setForgetError('')
        }}
      />
    </div>
  )
}
