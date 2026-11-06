import { useEffect, useRef, useState, type ReactNode } from 'react'

import { AgentSteps } from '../agent/AgentSteps.js'
import { BrainIcon } from '../icons.js'
import { Markdown, type MarkdownCitation } from '../markdown/Markdown.js'
import type { FeedbackVote, RunStep, SuggestedAction } from '../types.js'
import styles from './messages.module.css'

export interface AssistantMessageProps {
  /** Ответ в markdown (`Run.answer_md`). */
  text: string
  citations?: MarkdownCitation[]
  activeCitation?: number
  onCitationClick?: (n: number) => void
  onNavigate?: (path: string) => void
  /** Ответ ещё идёт: три точки под тем, что уже пришло. */
  pending?: boolean
  /** Прогон упал — текст ошибки сервера, по-русски. */
  error?: string | null
  /** Шаги агента («Поиск лидов · Карточка лида») над текстом. */
  steps?: RunStep[]
  /** Подпись над ответом, обычно `AiLabel`. */
  label?: ReactNode
  /** Слот под текстом: карточка действия, список источников. */
  children?: ReactNode

  // Строка действий. Нет колбэка — нет кнопки.
  onCopy?: (text: string) => void | Promise<void>
  onCreateTask?: (text: string) => void
  onRetry?: () => void
  onFeedback?: (vote: FeedbackVote) => void
  /** Уже поставленная оценка. */
  feedback?: FeedbackVote | null
  /** Дополнительные кнопки в строке действий («В вики»…). */
  extraActions?: ReactNode
  /** Чипы «спросить дальше». */
  followUps?: SuggestedAction[]
  onFollowUp?: (s: SuggestedAction) => void
  className?: string
}

/**
 * Ответ ассистента — текст без пузыря (владелец, 06.11.2026): пузырь нужен
 * собеседнику, а ответ ИИ — это содержимое экрана. Под текстом — слот
 * (действие агента, источники) и строка действий.
 */
export function AssistantMessage({
  text,
  citations,
  activeCitation,
  onCitationClick,
  onNavigate,
  pending,
  error,
  steps,
  label,
  children,
  onCopy,
  onCreateTask,
  onRetry,
  onFeedback,
  feedback,
  extraActions,
  followUps,
  onFollowUp,
  className,
}: AssistantMessageProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
    },
    [],
  )

  const copy = async () => {
    if (!onCopy) return
    await onCopy(text)
    setCopied(true)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 1500)
  }

  const hasActions = Boolean(onCopy || onCreateTask || onRetry || onFeedback || extraActions)
  const showActions = hasActions && !pending

  return (
    <article
      className={[styles.assistant, className].filter(Boolean).join(' ')}
      aria-busy={pending || undefined}
    >
      {label && <div className={styles.label}>{label}</div>}
      {steps && steps.length > 0 && <AgentSteps steps={steps} />}
      {text && (
        <Markdown
          text={text}
          citations={citations}
          activeCitation={activeCitation}
          onCitationClick={onCitationClick}
          onNavigate={onNavigate}
        />
      )}
      {pending && (
        <div className={styles.typing} role="status" aria-label="Ассистент отвечает">
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
        </div>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {children}
      {showActions && (
        <div className={styles.actions} aria-label="Действия с ответом">
          {onCopy && (
            <button type="button" className={styles.act} onClick={() => void copy()}>
              <BrainIcon name="copy" size={14} />
              {copied ? 'Скопировано' : 'Копировать'}
            </button>
          )}
          {onCreateTask && (
            <button type="button" className={styles.act} onClick={() => onCreateTask(text)}>
              <BrainIcon name="task" size={14} />
              Создать задачу
            </button>
          )}
          {onRetry && (
            <button type="button" className={styles.act} onClick={onRetry}>
              <BrainIcon name="refresh" size={14} />
              Повторить
            </button>
          )}
          {extraActions}
          {onFeedback && (
            <span className={styles.votes}>
              <button
                type="button"
                className={styles.vote}
                aria-label="Полезно"
                aria-pressed={feedback === 'up'}
                onClick={() => onFeedback('up')}
              >
                <BrainIcon name="thumbup" size={14} />
              </button>
              <button
                type="button"
                className={styles.vote}
                aria-label="Не полезно"
                aria-pressed={feedback === 'down'}
                onClick={() => onFeedback('down')}
              >
                <BrainIcon name="thumbdown" size={14} />
              </button>
            </span>
          )}
        </div>
      )}
      {!pending && followUps && followUps.length > 0 && onFollowUp && (
        <div className={styles.followups} aria-label="Спросить дальше">
          {followUps.map((s, i) => (
            <button
              key={s.id ?? `${i}-${s.label}`}
              type="button"
              className={styles.followup}
              onClick={() => onFollowUp(s)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </article>
  )
}
