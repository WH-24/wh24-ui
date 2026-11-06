import { useLayoutEffect, useRef, useState } from 'react'

import { AssistantMessage } from '../messages/AssistantMessage.js'
import { UserMessage } from '../messages/UserMessage.js'
import { BrainComposer } from '../composer/BrainComposer.js'
import { BrainIcon } from '../icons.js'
import type { ModuleMetaMap } from '../sources/modules.js'
import { patchSummary } from './draft.js'
import styles from './builder.module.css'
import type { AgentPatch, AgentToolInfo } from './types.js'

export interface BuilderMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  /** Правка профиля, которую хост применил по ответу конструктора (`AgentDraftResult.patch`). */
  patch?: AgentPatch | null
  /** Что из предложенного отклонено проверкой (`AgentDraftResult.notes`). */
  notes?: string[]
  /** Правка откатана. */
  undone?: boolean
  /** Этот ответ не получился (сеть, квота). */
  error?: string
}

export interface AgentBuilderChatProps {
  messages: BuilderMessage[]
  /** Конструктор отвечает: отправка заблокирована, в ленте — индикатор. */
  busy?: boolean
  onSend: (text: string) => void
  /** «Отменить правку» — откат последней применённой правки. Кнопка стоит под ней. */
  onUndo?: () => void
  /** Названия инструментов и модулей для подписей «что изменено». */
  tools?: AgentToolInfo[]
  modules?: ModuleMetaMap
  /** Примеры запросов в пустом диалоге. */
  suggestions?: string[]
  /** Почему писать нельзя (нет роли, не настроен ИИ). */
  disabledReason?: string | null
  /** Общая ошибка под лентой (например, «лимит ИИ исчерпан»). */
  error?: string | null
  placeholder?: string
  hint?: string
  /** Фокус в поле при появлении. По умолчанию нет: диалог стоит рядом с формой и не должен её перебивать. */
  autoFocus?: boolean
  className?: string
}

const DEFAULT_SUGGESTIONS = [
  'Каждое утро в 9:30 присылай сводку по моим лидам и проектам',
  'Отвечай на вопросы сотрудников по регламентам из вики со ссылками на статьи',
  'Раз в неделю собирай апдейт по моим проектам: что сдвинулось и какие риски',
]

/**
 * Диалог-конструктор агента: человек описывает задачу словами, ассистент
 * отвечает и правит профиль. Правку применяет хост сразу (и подсвечивает поля
 * в `AgentProfile`), здесь она показана списком «Что изменено в профиле»; тут
 * же — то, что проверка отклонила, и «Отменить правку» под последней
 * применённой. Ничего не сохраняется, пока человек не нажмёт «Сохранить» у хоста.
 */
export function AgentBuilderChat({
  messages,
  busy = false,
  onSend,
  onUndo,
  tools,
  modules,
  suggestions = DEFAULT_SUGGESTIONS,
  disabledReason,
  error,
  placeholder = 'Опишите, что должен делать агент…',
  hint,
  autoFocus = false,
  className,
}: AgentBuilderChatProps) {
  const [draft, setDraft] = useState('')
  const log = useRef<HTMLDivElement>(null)

  // Лента держится у последней реплики.
  useLayoutEffect(() => {
    const el = log.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, busy])

  const send = (text: string) => {
    const t = text.trim()
    if (!t || busy || disabledReason) return
    setDraft('')
    onSend(t)
  }

  // Откатить можно только последнюю применённую правку.
  let lastApplied = -1
  messages.forEach((m, i) => {
    if (m.role === 'assistant' && !m.undone && patchSummary(m.patch, { tools, modules }).length > 0) lastApplied = i
  })

  return (
    <section className={[styles.chat, className].filter(Boolean).join(' ')} aria-label="Конструктор агента">
      <div ref={log} className={styles.log} role="log" aria-live="polite" aria-relevant="additions">
        {messages.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>
              <BrainIcon name="sparkle" size={20} />
            </span>
            <div className={styles.emptyTitle}>Опишите агента словами</div>
            <div className={styles.emptyText}>
              Что он делает, когда запускается и что ему можно трогать. Профиль заполнится по ходу разговора — потом его
              можно поправить руками.
            </div>
            {suggestions.length > 0 && (
              <div className={styles.suggestions} aria-label="Примеры запросов">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={styles.suggestion}
                    disabled={busy || Boolean(disabledReason)}
                    onClick={() => send(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((m, i) => {
            if (m.role === 'user') return <UserMessage key={m.id} text={m.text} />
            const changes = patchSummary(m.patch, { tools, modules })
            const notes = (m.notes ?? []).filter(Boolean)
            return (
              <AssistantMessage key={m.id} text={m.text} error={m.error}>
                {changes.length > 0 && (
                  <section
                    className={styles.changes}
                    data-undone={m.undone || undefined}
                    aria-label="Что изменено в профиле"
                  >
                    <h4 className={styles.changesTitle}>{m.undone ? 'Правка отменена' : 'Что изменено в профиле'}</h4>
                    <ul className={styles.changesList}>
                      {changes.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                    {onUndo && i === lastApplied && !busy && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={onUndo}>
                        <BrainIcon name="undo" size={14} />
                        Отменить правку
                      </button>
                    )}
                  </section>
                )}
                {notes.length > 0 && (
                  <section className={styles.notes} aria-label="Что не применено" role="note">
                    <h4 className={styles.changesTitle}>
                      <BrainIcon name="alert" size={13} />
                      Не применено
                    </h4>
                    <ul className={styles.changesList}>
                      {notes.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  </section>
                )}
              </AssistantMessage>
            )
          })
        )}
        {busy && <AssistantMessage text="" pending />}
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <BrainComposer
        value={draft}
        onChange={setDraft}
        onSend={() => send(draft)}
        busy={busy}
        placeholder={placeholder}
        hint={hint ?? 'Enter — отправить. Правки видны в профиле, сохраняете их вы'}
        disabledReason={disabledReason}
        autoFocus={autoFocus}
        ariaLabel="Сообщение конструктору агента"
      />
    </section>
  )
}
