/**
 * Поле сообщения и панель под ним — порядок кнопок как в Pyrus:
 * ✓ «Утверждено», встреча, «На контроле», ответственный, срок, время,
 * @, форматирование, смайлики, картинка, файл. Действия копятся в черновике
 * (видны плашками над полем) и уходят одним сообщением.
 */
import { useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Combobox, DateField, Icon, Input, Textarea, type IconName } from '@wowhaus-24/ui-react'

import { FormsApiError } from '../api.js'
import type { ApprovalChoice, OrgOption, RecordFeed, RecordRoute } from '../types.js'
import { formatDate, formatDateTime, formatSize } from '../render/format.js'
import {
  CHOICE_LABEL,
  EMOJI,
  EMPTY_DRAFT,
  SPENT_PRESETS,
  availableChoices,
  buildMeeting,
  draftEmpty,
  formatMinutes,
  myDecisionStep,
  myRevocableSteps,
  parseMinutes,
  staffIndex,
  type Draft,
} from './logic.js'
import { listSelection, wrapSelection } from './markup.js'
import styles from './chat.module.css'

type Panel = 'approval' | 'meeting' | 'responsible' | 'due' | 'spent' | 'emoji' | null

const MAX_FILES = 10

export interface ComposerProps {
  route: RecordRoute
  fields: RecordFeed['fields']
  staff: OrgOption[]
  watching: boolean
  onToggleWatch: () => void
  replyTo: { author: string; body: string } | null
  onCancelReply: () => void
  /** Отклонённая отправка бросает — черновик остаётся. */
  onSend: (d: Draft) => Promise<void>
}

export function Composer({
  route,
  fields,
  staff,
  watching,
  onToggleWatch,
  replyTo,
  onCancelReply,
  onSend,
}: ComposerProps) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [panel, setPanel] = useState<Panel>(null)
  const [format, setFormat] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mention, setMention] = useState<{ start: number; query: string; active: number } | null>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const imageRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const people = useMemo(() => staffIndex(staff), [staff])

  const decisionStep = myDecisionStep(route)
  const revocable = myRevocableSteps(route)
  const canDecide = Boolean(decisionStep) || revocable.length > 0

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }))
  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p))

  // --- Текст: каретка, упоминания, форматирование ---

  const setBody = (value: string, caret?: number) => {
    patch({ body: value })
    if (caret != null) {
      requestAnimationFrame(() => {
        const el = textRef.current
        if (!el) return
        el.focus()
        el.setSelectionRange(caret, caret)
      })
    }
  }

  const insertAtCaret = (text: string) => {
    const el = textRef.current
    const start = el?.selectionStart ?? draft.body.length
    const end = el?.selectionEnd ?? start
    const value = draft.body.slice(0, start) + text + draft.body.slice(end)
    setBody(value, start + text.length)
    return { value, caret: start + text.length }
  }

  const detectMention = (value: string, caret: number) => {
    const before = value.slice(0, caret)
    const m = /(^|\s)@([^\s@][^@\n]{0,30})?$/u.exec(before)
    if (!m) {
      setMention(null)
      return
    }
    const query = m[2] ?? ''
    setMention({ start: caret - query.length - 1, query, active: 0 })
  }

  const mentionOptions = useMemo(() => {
    if (!mention) return []
    const q = mention.query.trim().toLowerCase()
    return staff.filter((s) => !q || s.label.toLowerCase().includes(q)).slice(0, 8)
  }, [mention, staff])

  const pickMention = (s: OrgOption) => {
    if (!mention) return
    const el = textRef.current
    const caret = el?.selectionStart ?? draft.body.length
    const ins = `@${s.label} `
    const value = draft.body.slice(0, mention.start) + ins + draft.body.slice(caret)
    setDraft((d) => ({ ...d, body: value, mentions: { ...d.mentions, [s.id]: s.label } }))
    setMention(null)
    const pos = mention.start + ins.length
    requestAnimationFrame(() => {
      textRef.current?.focus()
      textRef.current?.setSelectionRange(pos, pos)
    })
  }

  const onText = (e: ChangeEvent<HTMLTextAreaElement>) => {
    patch({ body: e.target.value })
    detectMention(e.target.value, e.target.selectionStart)
  }

  const applyFormat = (kind: 'bold' | 'italic' | 'strike' | 'code' | 'list') => {
    const el = textRef.current
    const start = el?.selectionStart ?? draft.body.length
    const end = el?.selectionEnd ?? start
    const marks = { bold: '**', italic: '_', strike: '~~', code: '`' } as const
    const res = kind === 'list' ? listSelection(draft.body, start, end) : wrapSelection(draft.body, start, end, marks[kind])
    patch({ body: res.value })
    requestAnimationFrame(() => {
      textRef.current?.focus()
      textRef.current?.setSelectionRange(res.start, res.end)
    })
  }

  // --- Файлы ---

  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return
    const incoming = Array.from(list)
    setDraft((d) => {
      const files = [...d.files, ...incoming].slice(0, MAX_FILES)
      if (d.files.length + incoming.length > MAX_FILES) setError(`Не больше ${MAX_FILES} файлов в сообщении`)
      return { ...d, files }
    })
  }

  // --- Отправка ---

  const submit = async () => {
    if (sending || draftEmpty(draft)) return
    setSending(true)
    setError(null)
    try {
      await onSend(draft)
      setDraft(EMPTY_DRAFT)
      setPanel(null)
    } catch (e) {
      setError(e instanceof FormsApiError ? e.message : 'Сообщение не отправлено — попробуйте ещё раз')
    } finally {
      setSending(false)
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && mentionOptions.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const d = e.key === 'ArrowDown' ? 1 : -1
        setMention({ ...mention, active: (mention.active + d + mentionOptions.length) % mentionOptions.length })
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const pick = mentionOptions[mention.active] ?? mentionOptions[0]
        if (pick) pickMention(pick)
        return
      }
      if (e.key === 'Escape') {
        setMention(null)
        return
      }
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      void submit()
    }
  }

  // --- Плашки отложенных действий ---

  const chips: Array<{ key: string; icon: IconName; text: string; clear: () => void }> = []
  if (draft.approval) {
    chips.push({
      key: 'approval',
      icon: draft.approval.choice === 'rejected' ? 'close' : 'check',
      text: `${CHOICE_LABEL[draft.approval.choice]} — «${draft.approval.step_name}»`,
      clear: () => patch({ approval: null }),
    })
  }
  if (draft.meeting) {
    chips.push({
      key: 'meeting',
      icon: 'video',
      text: `Встреча ${formatDateTime(draft.meeting.starts_at)}`,
      clear: () => patch({ meeting: null }),
    })
  }
  if (draft.responsible !== undefined) {
    chips.push({
      key: 'responsible',
      icon: 'send',
      text: draft.responsible ? `Ответственный: ${people.name(draft.responsible)}` : 'Снять ответственного',
      clear: () => patch({ responsible: undefined }),
    })
  }
  if (draft.due !== undefined) {
    chips.push({
      key: 'due',
      icon: 'calendar',
      text: draft.due ? `Срок: ${formatDate(draft.due)}` : 'Снять срок',
      clear: () => patch({ due: undefined }),
    })
  }
  if (draft.spent) {
    chips.push({ key: 'spent', icon: 'timer', text: `Затрачено: ${formatMinutes(draft.spent)}`, clear: () => patch({ spent: 0 }) })
  }

  const empty = draftEmpty(draft)

  return (
    <form
      className={styles.composer}
      aria-label="Новое сообщение"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        addFiles(e.dataTransfer.files)
      }}
    >
      {replyTo && (
        <div className={styles.replyBox}>
          <span>
            Ответ для <b>{replyTo.author}</b>: {replyTo.body.slice(0, 120) || 'вложение'}
          </span>
          <button type="button" className={styles.chipX} aria-label="Убрать цитату" onClick={onCancelReply}>
            ×
          </button>
        </div>
      )}

      {(chips.length > 0 || draft.files.length > 0) && (
        <ul className={styles.chips} aria-label="Действия сообщения">
          {chips.map((c) => (
            <li key={c.key} className={styles.chip}>
              <Icon name={c.icon} size={13} /> {c.text}
              <button type="button" className={styles.chipX} aria-label={`Убрать: ${c.text}`} onClick={c.clear}>
                ×
              </button>
            </li>
          ))}
          {draft.files.map((f, i) => (
            <li key={`${f.name}-${i}`} className={styles.chip}>
              <Icon name={f.type.startsWith('image/') ? 'image' : 'clip'} size={13} /> {f.name}{' '}
              <span className={styles.muted}>{formatSize(f.size)}</span>
              <button
                type="button"
                className={styles.chipX}
                aria-label={`Убрать файл ${f.name}`}
                onClick={() => patch({ files: draft.files.filter((_, j) => j !== i) })}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {format && (
        <div className={styles.formatBar} role="toolbar" aria-label="Форматирование">
          <FmtBtn label="Жирный" onClick={() => applyFormat('bold')}>
            <b>Ж</b>
          </FmtBtn>
          <FmtBtn label="Курсив" onClick={() => applyFormat('italic')}>
            <i>К</i>
          </FmtBtn>
          <FmtBtn label="Зачёркнутый" onClick={() => applyFormat('strike')}>
            <s>З</s>
          </FmtBtn>
          <FmtBtn label="Код" onClick={() => applyFormat('code')}>
            {'</>'}
          </FmtBtn>
          <FmtBtn label="Список" onClick={() => applyFormat('list')}>
            •&nbsp;—
          </FmtBtn>
        </div>
      )}

      <div className={styles.inputWrap}>
        <Textarea
          ref={textRef}
          aria-label="Текст сообщения"
          placeholder="Напишите сообщение… @ — упомянуть, Ctrl+Enter — отправить"
          rows={3}
          value={draft.body}
          onChange={onText}
          onKeyDown={onKeyDown}
          onBlur={() => setTimeout(() => setMention(null), 150)}
          onPaste={(e) => {
            if (e.clipboardData.files.length) {
              e.preventDefault()
              addFiles(e.clipboardData.files)
            }
          }}
        />
        {mention && mentionOptions.length > 0 && (
          <ul className={styles.mentions} role="listbox" aria-label="Упомянуть">
            {mentionOptions.map((s, i) => (
              <li
                key={s.id}
                role="option"
                aria-selected={i === mention.active}
                className={i === mention.active ? styles.mentionActive : undefined}
                onMouseDown={(e) => {
                  e.preventDefault()
                  pickMention(s)
                }}
              >
                {s.label}
                {s.hint && <span className={styles.muted}> · {s.hint}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {panel && (
        <div className={styles.panel}>
          {panel === 'approval' && (
            <ApprovalPanel
              route={route}
              current={decisionStep}
              onPick={(step_id, step_name, choice) => {
                patch({ approval: { step_id, step_name, choice } })
                setPanel(null)
              }}
            />
          )}
          {panel === 'meeting' && (
            <MeetingPanel
              onDone={(m) => {
                patch({ meeting: m })
                setPanel(null)
              }}
            />
          )}
          {panel === 'responsible' && (
            <div className={styles.panelRow}>
              <span>Ответственный</span>
              <Combobox
                ariaLabel="Ответственный"
                options={staff.map((s) => ({ value: s.id, label: s.label, hint: s.hint }))}
                value={draft.responsible ?? ''}
                onChange={(v) => {
                  patch({ responsible: v })
                  setPanel(null)
                }}
                placeholder="Выберите сотрудника"
                searchable
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  patch({ responsible: '' })
                  setPanel(null)
                }}
              >
                Снять
              </button>
            </div>
          )}
          {panel === 'due' && (
            <div className={styles.panelRow}>
              <span>Срок</span>
              <DateField
                ariaLabel="Срок"
                value={draft.due ?? ''}
                onChange={(v) => {
                  patch({ due: v })
                  setPanel(null)
                }}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  patch({ due: '' })
                  setPanel(null)
                }}
              >
                Снять
              </button>
            </div>
          )}
          {panel === 'spent' && (
            <SpentPanel
              onPick={(m) => {
                patch({ spent: m })
                setPanel(null)
              }}
            />
          )}
          {panel === 'emoji' && (
            <div className={styles.emoji} role="group" aria-label="Смайлики">
              {EMOJI.map((em) => (
                <button key={em} type="button" onClick={() => insertAtCaret(em)} aria-label={`Вставить ${em}`}>
                  {em}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      <div className={styles.toolbar} role="toolbar" aria-label="Действия">
        {canDecide && (
          <button
            type="button"
            className={[styles.approve, draft.approval?.choice === 'rejected' ? styles.approveNo : ''].join(' ')}
            aria-pressed={panel === 'approval'}
            onClick={() => toggle('approval')}
          >
            <span className={styles.approveDot}>
              <Icon name={draft.approval?.choice === 'rejected' ? 'close' : 'check'} size={14} stroke={2.2} />
            </span>
            {draft.approval ? CHOICE_LABEL[draft.approval.choice] : 'Утверждено'}
          </button>
        )}
        <Tool icon="video" label="Встреча (видеозвонок)" active={panel === 'meeting' || !!draft.meeting} onClick={() => toggle('meeting')} />
        <Tool icon="flag" label={watching ? 'Снять с контроля' : 'На контроле'} active={watching} onClick={onToggleWatch} />
        <Tool
          icon="send"
          label={fields.responsible ? 'Сменить ответственного' : 'У формы нет поля «Ответственный»'}
          disabled={!fields.responsible}
          active={panel === 'responsible' || draft.responsible !== undefined}
          onClick={() => toggle('responsible')}
        />
        <Tool
          icon="calendar"
          label={fields.due ? 'Срок' : 'У формы нет поля «Срок»'}
          disabled={!fields.due}
          active={panel === 'due' || draft.due !== undefined}
          onClick={() => toggle('due')}
        />
        <Tool icon="timer" label="Затраченное время" active={panel === 'spent' || draft.spent > 0} onClick={() => toggle('spent')} />
        <Tool
          icon="at"
          label="Упомянуть"
          onClick={() => {
            const pre = draft.body && !/\s$/.test(draft.body.slice(0, textRef.current?.selectionStart ?? 0)) ? ' @' : '@'
            const { value, caret } = insertAtCaret(pre)
            detectMention(value, caret)
          }}
        />
        <Tool icon="type" label="Форматирование" active={format} onClick={() => setFormat((f) => !f)} />
        <Tool icon="smile" label="Смайлики" active={panel === 'emoji'} onClick={() => toggle('emoji')} />
        <Tool icon="image" label="Картинка" onClick={() => imageRef.current?.click()} />
        <Tool icon="clip" label="Прикрепить файл" onClick={() => fileRef.current?.click()} />
        <input
          ref={imageRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <span className={styles.grow} />
        <button type="submit" className="btn btn-primary btn-sm" disabled={empty || sending}>
          {sending ? 'Отправляем…' : 'Отправить'}
        </button>
      </div>
    </form>
  )
}

function Tool({
  icon,
  label,
  onClick,
  active,
  disabled,
}: {
  icon: IconName
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={[styles.tool, active ? styles.toolOn : ''].join(' ')}
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} size={18} />
    </button>
  )
}

function FmtBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className={styles.fmt}
      aria-label={label}
      title={label}
      // Не отбирать фокус у поля: иначе пропадает выделение, которое оборачиваем.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function ApprovalPanel({
  route,
  current,
  onPick,
}: {
  route: RecordRoute
  current: RecordRoute['steps'][number] | null
  onPick: (stepId: string, stepName: string, choice: ApprovalChoice) => void
}) {
  const revocable = myRevocableSteps(route).filter((s) => s.id !== current?.id)
  return (
    <div className={styles.approvalPanel}>
      {current && (
        <div className={styles.panelRow}>
          <span>Этап «{current.name}»</span>
          {availableChoices(current).map((ch) => (
            <button
              key={ch}
              type="button"
              className={['btn', 'btn-sm', ch === 'approved' ? 'btn-primary' : 'btn-ghost'].join(' ')}
              onClick={() => onPick(current.id, current.name, ch)}
            >
              {CHOICE_LABEL[ch]}
            </button>
          ))}
        </div>
      )}
      {revocable.map((s) => (
        <div key={s.id} className={styles.panelRow}>
          <span>Этап «{s.name}»</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onPick(s.id, s.name, 'revoked')}>
            {CHOICE_LABEL.revoked}
          </button>
        </div>
      ))}
    </div>
  )
}

function MeetingPanel({ onDone }: { onDone: (m: NonNullable<Draft['meeting']>) => void }) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [from, setFrom] = useState('10:00')
  const [to, setTo] = useState('11:00')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const done = () => {
    const res = buildMeeting(title, date, from, to, url)
    if (res.error || !res.meeting) {
      setError(res.error ?? 'Проверьте поля встречи')
      return
    }
    onDone(res.meeting)
  }
  return (
    <div className={styles.meetingPanel} aria-label="Встреча">
      <Input aria-label="Тема встречи" placeholder="Тема (необязательно)" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className={styles.panelRow}>
        <DateField ariaLabel="Дата встречи" value={date} onChange={setDate} />
        <Input aria-label="Начало" className={styles.clock} value={from} onChange={(e) => setFrom(e.target.value)} />
        <span>—</span>
        <Input aria-label="Конец" className={styles.clock} value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <Input
        aria-label="Ссылка на звонок"
        placeholder="Ссылка на Телемост, Zoom…"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      <div>
        <button type="button" className="btn btn-primary btn-sm" onClick={done}>
          Добавить встречу
        </button>
      </div>
    </div>
  )
}

function SpentPanel({ onPick }: { onPick: (minutes: number) => void }) {
  const [custom, setCustom] = useState('')
  const [error, setError] = useState<string | null>(null)
  const apply = () => {
    const m = parseMinutes(custom)
    if (m == null || m <= 0 || m > 24 * 60) {
      setError('Время — например 1:30 или 45 мин, не больше суток')
      return
    }
    onPick(m)
  }
  return (
    <div className={styles.spentPanel}>
      <div className={styles.panelRow}>
        {SPENT_PRESETS.map((m) => (
          <button key={m} type="button" className="btn btn-ghost btn-sm" onClick={() => onPick(m)}>
            {formatMinutes(m)}
          </button>
        ))}
      </div>
      <div className={styles.panelRow}>
        <Input
          aria-label="Своё время"
          placeholder="ЧЧ:ММ"
          className={styles.clock}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              apply()
            }
          }}
        />
        <button type="button" className="btn btn-ghost btn-sm" onClick={apply}>
          Указать
        </button>
        {error && <span className={styles.errorInline}>{error}</span>}
      </div>
    </div>
  )
}
