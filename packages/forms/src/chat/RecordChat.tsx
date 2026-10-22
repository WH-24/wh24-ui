/**
 * RecordChat — лента записи формы с панелью комментария, как в Pyrus:
 * «Утверждено» (решение по этапу маршрута), встреча, «На контроле»,
 * ответственный, срок, затраченное время, @, форматирование, смайлики,
 * картинка, файл. Всё, кроме «На контроле», копится в черновике и уходит
 * одним сообщением по «Отправить» (Ctrl/⌘+Enter).
 *
 * Сверху — маршрут записи: этапы, согласующие и их решения; администратор
 * формы правит маршрут здесь же («Настроить»), без отдельной страницы.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Icon } from '@wowhaus-24/ui-react'

import type { FormsApi } from '../api.js'
import { FormsApiError } from '../api.js'
import type { FormFile, FormRecord, OrgOption, RecordComment, RecordFeed } from '../types.js'
import { formatDate, formatDateTime, formatSize } from '../render/format.js'
import { Composer } from './Composer.js'
import { RouteBar } from './RouteBar.js'
import { Markup } from './markup.js'
import { CHOICE_LABEL, draftToComment, formatMinutes, staffIndex, type Draft } from './logic.js'
import styles from './chat.module.css'

export interface RecordChatProps {
  api: FormsApi
  formId: string
  recordId: string
  /** Справочник сотрудников: имена, @, ответственный, согласующие. */
  staff: OrgOption[]
  /** Может писать в ленту (роль «Редактирование» в модуле). */
  canWrite?: boolean
  /** Может настраивать маршрут формы (роль «Управление»). */
  canManageRoute?: boolean
  /** Сообщение изменило запись (ответственный, срок) — обновить карточку. */
  onRecordChange?: (record: FormRecord) => void
  /** Ошибка открытия файла и прочее, что хост показывает тостом. */
  onError?: (message: string) => void
}

type Load = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; feed: RecordFeed }

function errText(e: unknown, fallback: string): string {
  return e instanceof FormsApiError ? e.message : fallback
}

export function RecordChat({
  api,
  formId,
  recordId,
  staff,
  canWrite = true,
  canManageRoute = false,
  onRecordChange,
  onError,
}: RecordChatProps) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [replyTo, setReplyTo] = useState<RecordComment | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const people = useMemo(() => staffIndex(staff), [staff])
  const names = useMemo(() => staff.map((s) => s.label), [staff])

  const reload = useCallback(async () => {
    try {
      const feed = await api.records.feed(formId, recordId)
      setLoad({ kind: 'ready', feed })
    } catch (e) {
      setLoad({ kind: 'error', message: errText(e, 'Не удалось загрузить ленту') })
    }
  }, [api, formId, recordId])

  useEffect(() => {
    setLoad({ kind: 'loading' })
    void reload()
  }, [reload])

  // Новое сообщение — прокрутить вниз.
  const count = load.kind === 'ready' ? load.feed.comments.length : 0
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [count])

  const send = async (d: Draft) => {
    const body = draftToComment(d)
    if (replyTo) body.reply_to = replyTo.id
    const res = await api.records.comment(formId, recordId, body)
    setReplyTo(null)
    setLoad((s) =>
      s.kind === 'ready'
        ? { kind: 'ready', feed: { ...s.feed, comments: [...s.feed.comments, res.comment], route: res.route } }
        : s,
    )
    if (d.responsible !== undefined || d.due !== undefined) onRecordChange?.(res.record)
  }

  const toggleWatch = async () => {
    if (load.kind !== 'ready') return
    const next = !load.feed.watching
    setLoad({ kind: 'ready', feed: { ...load.feed, watching: next } })
    try {
      await api.records.watch(formId, recordId, next)
    } catch (e) {
      setLoad({ kind: 'ready', feed: { ...load.feed, watching: !next } })
      onError?.(errText(e, 'Не удалось изменить пометку «На контроле»'))
    }
  }

  const openFile = async (f: FormFile) => {
    try {
      const { url } = await api.records.fileUrl(formId, recordId, f.id)
      window.open(url, '_blank', 'noopener')
    } catch (e) {
      onError?.(errText(e, 'Не удалось открыть файл'))
    }
  }

  if (load.kind === 'loading') {
    return (
      <section className={styles.chat} aria-label="Лента записи" aria-busy="true">
        <div className={styles.muted}>Загружаем ленту…</div>
      </section>
    )
  }
  if (load.kind === 'error') {
    return (
      <section className={styles.chat} aria-label="Лента записи">
        <div className={styles.error} role="alert">
          {load.message}{' '}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void reload()}>
            Повторить
          </button>
        </div>
      </section>
    )
  }

  const { feed } = load
  const byId = new Map(feed.comments.map((c) => [c.id, c]))
  const spentTotal = feed.comments.reduce((n, c) => n + (c.actions.spent_minutes ?? 0), 0)

  return (
    <section className={styles.chat} aria-label="Лента записи">
      <RouteBar
        api={api}
        formId={formId}
        route={feed.route}
        staff={staff}
        canManage={canManageRoute}
        onSaved={() => void reload()}
        onError={onError}
      />

      <div className={styles.list} ref={listRef} aria-label="Сообщения">
        {feed.comments.length === 0 && <div className={styles.muted}>Сообщений пока нет</div>}
        {feed.comments.map((c) => (
          <Message
            key={c.id}
            c={c}
            author={people.author(c.author)}
            name={people.name}
            names={names}
            quoted={c.reply_to ? byId.get(c.reply_to) : undefined}
            quotedAuthor={(q) => people.author(q.author)}
            onReply={canWrite ? () => setReplyTo(c) : undefined}
            onOpenFile={openFile}
            fileUrl={(f) => api.records.fileUrl(formId, recordId, f.id).then((r) => r.url)}
          />
        ))}
      </div>

      {spentTotal > 0 && <div className={styles.total}>Затрачено по записи: {formatMinutes(spentTotal)}</div>}

      {canWrite && (
        <Composer
          route={feed.route}
          fields={feed.fields}
          staff={staff}
          watching={feed.watching}
          onToggleWatch={() => void toggleWatch()}
          replyTo={replyTo ? { author: people.author(replyTo.author), body: replyTo.body } : null}
          onCancelReply={() => setReplyTo(null)}
          onSend={send}
        />
      )}
    </section>
  )
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function ActionLine({ children }: { children: ReactNode }) {
  return <div className={styles.action}>{children}</div>
}

function Message({
  c,
  author,
  name,
  names,
  quoted,
  quotedAuthor,
  onReply,
  onOpenFile,
  fileUrl,
}: {
  c: RecordComment
  author: string
  name: (id: string | null | undefined) => string
  names: string[]
  quoted?: RecordComment
  quotedAuthor: (q: RecordComment) => string
  onReply?: () => void
  onOpenFile: (f: FormFile) => void
  fileUrl: (f: FormFile) => Promise<string>
}) {
  const a = c.actions
  const images = c.files.filter((f) => f.mime.startsWith('image/'))
  const others = c.files.filter((f) => !f.mime.startsWith('image/'))
  const valueText = (v: unknown, kind: 'staff' | 'date') =>
    v == null || v === '' ? 'не задан' : kind === 'staff' ? name(String(v)) : formatDate(String(v))

  return (
    <article className={styles.msg} aria-label={`Сообщение: ${author}`}>
      <header className={styles.msgHead}>
        <span className={styles.author}>{author}</span>
        <time dateTime={c.created_at} className={styles.time}>
          {formatDateTime(c.created_at)}
        </time>
        {onReply && (
          <button type="button" className={styles.reply} onClick={onReply} aria-label={`Ответить: ${author}`}>
            Ответить
          </button>
        )}
      </header>

      {a.approval && (
        <div className={[styles.decision, styles[`ch_${a.approval.choice}`]].join(' ')}>
          <Icon name={a.approval.choice === 'rejected' ? 'close' : 'check'} size={14} />
          {a.approval.choice === 'revoked'
            ? `Отозвал(а) решение — этап «${a.approval.step_name}»`
            : `${CHOICE_LABEL[a.approval.choice]} — этап «${a.approval.step_name}»`}
          {a.approval.approver && name(a.approval.approver) !== author && (
            <span className={styles.muted}> за {name(a.approval.approver)}</span>
          )}
        </div>
      )}

      {quoted && (
        <blockquote className={styles.quote}>
          <b>{quotedAuthor(quoted)}:</b> {quoted.body.slice(0, 200) || 'вложение'}
        </blockquote>
      )}

      {c.body && (
        <div className={styles.body}>
          <Markup text={c.body} names={names} classes={{ code: styles.code, mention: styles.mention }} />
        </div>
      )}

      {a.meeting && (
        <div className={styles.meeting}>
          <Icon name="video" size={16} />
          <div>
            <div className={styles.meetingTitle}>{a.meeting.title || 'Встреча'}</div>
            <div className={styles.muted}>
              {formatDateTime(a.meeting.starts_at)} — {clock(a.meeting.ends_at)}
            </div>
            <a href={a.meeting.url} target="_blank" rel="noopener noreferrer">
              Подключиться
            </a>
          </div>
        </div>
      )}

      {a.responsible && (
        <ActionLine>
          <Icon name="send" size={13} /> Ответственный: {valueText(a.responsible.to, 'staff')}
        </ActionLine>
      )}
      {a.due && (
        <ActionLine>
          <Icon name="calendar" size={13} /> Срок: {valueText(a.due.to, 'date')}
        </ActionLine>
      )}
      {a.spent_minutes ? (
        <ActionLine>
          <Icon name="timer" size={13} /> Затрачено: {formatMinutes(a.spent_minutes)}
        </ActionLine>
      ) : null}

      {images.length > 0 && (
        <div className={styles.images}>
          {images.map((f) => (
            <Thumb key={f.id} file={f} load={fileUrl} onOpen={() => onOpenFile(f)} />
          ))}
        </div>
      )}
      {others.length > 0 && (
        <ul className={styles.files} aria-label="Вложения">
          {others.map((f) => (
            <li key={f.id}>
              <button type="button" className={styles.file} onClick={() => onOpenFile(f)}>
                <Icon name="clip" size={13} /> {f.name} <span className={styles.muted}>{formatSize(f.size)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

/** Миниатюра картинки: ссылка временная, грузится при показе. */
function Thumb({ file, load, onOpen }: { file: FormFile; load: (f: FormFile) => Promise<string>; onOpen: () => void }) {
  const [src, setSrc] = useState<string | null>(null)
  // Ссылку берём один раз на файл: функция загрузки приходит новой при
  // каждой перерисовке ленты, и зависимость от неё перезапрашивала бы ссылку.
  const loadRef = useRef(load)
  loadRef.current = load
  useEffect(() => {
    let alive = true
    loadRef
      .current(file)
      .then((u) => alive && setSrc(u))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [file])
  return (
    <button type="button" className={styles.thumb} onClick={onOpen} aria-label={`Открыть ${file.name}`}>
      {src ? <img src={src} alt={file.name} /> : <Icon name="image" size={20} />}
    </button>
  )
}
