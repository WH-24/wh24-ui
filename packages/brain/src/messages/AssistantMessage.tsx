import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'

import { AgentSteps } from '../agent/AgentSteps.js'
import { ChartBlockFallback } from '../blocks/ChartBlockFallback.js'
import { BrainIcon } from '../icons.js'
import { htmlForCopy } from '../copy.js'
import { Markdown, type MarkdownCitation } from '../markdown/Markdown.js'
import type { FeedbackVote, RunBlock, RunStep, SuggestedAction } from '../types.js'
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
  /** Графики и таблицы к ответу (`Run.blocks`) — между текстом и слотом `children`. */
  blocks?: RunBlock[]
  /**
   * Как рисовать блок: хост с Perspective отдаёт свой компонент. Нет колбэка
   * или он вернул `null`/`undefined` — запасная таблица `ChartBlockFallback`.
   */
  renderBlock?: (block: RunBlock) => ReactNode
  /** Подпись над ответом, обычно `AiLabel`. */
  label?: ReactNode
  /** Слот под текстом: карточка действия, список источников. */
  children?: ReactNode

  // Строка действий. Нет колбэка — нет кнопки.
  /**
   * Копирование: `text` — markdown ответа, `html` — отрисованный ответ без
   * кнопок (для вставки с форматированием). Готовая реализация — `copyAnswer`.
   * Вернул `false` — кнопка покажет «Не удалось скопировать».
   */
  onCopy?: (text: string, html?: string) => void | boolean | Promise<void | boolean>
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
 * собеседнику, а ответ ИИ — это содержимое экрана. Порядок: подпись → шаги
 * агента → текст → блоки (графики) → индикатор → ошибка → слот (действие
 * агента, источники) → строка действий → чипы «спросить дальше».
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
  blocks,
  renderBlock,
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
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<number | null>(null)
  const mdRef = useRef<HTMLDivElement>(null)
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
    },
    [],
  )

  const copy = async () => {
    if (!onCopy) return
    let ok = true
    try {
      ok = (await onCopy(text, mdRef.current ? htmlForCopy(mdRef.current) : undefined)) !== false
    } catch {
      ok = false
    }
    setCopyState(ok ? 'copied' : 'failed')
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopyState('idle'), 2000)
  }
  const copyLabel =
    copyState === 'copied' ? 'Скопировано' : copyState === 'failed' ? 'Не удалось скопировать' : 'Копировать'

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
        <div ref={mdRef}>
          <Markdown
            text={text}
            citations={citations}
            activeCitation={activeCitation}
            onCitationClick={onCitationClick}
            onNavigate={onNavigate}
          />
        </div>
      )}
      {blocks && blocks.length > 0 && (
        <div className={styles.blocks} role="group" aria-label="Графики и таблицы к ответу">
          {blocks.map((b) => (
            <Fragment key={b.id}>{renderBlock?.(b) ?? <ChartBlockFallback block={b} />}</Fragment>
          ))}
        </div>
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
        // Как в ChatGPT: иконки без подписи (подсказка — при наведении), рядом
        // «Создать задачу» и действия хоста словами — их иконкой не угадать.
        <div className={styles.actions} aria-label="Действия с ответом">
          {onCopy && (
            <button
              type="button"
              className={styles.iconAct}
              data-state={copyState}
              aria-label={copyLabel}
              title={copyLabel}
              onClick={() => void copy()}
            >
              <BrainIcon name={copyState === 'copied' ? 'check' : 'copy'} size={16} />
            </button>
          )}
          {onFeedback && (
            <>
              <button
                type="button"
                className={styles.iconAct}
                aria-label="Полезно"
                title="Полезно"
                aria-pressed={feedback === 'up'}
                onClick={() => onFeedback('up')}
              >
                <BrainIcon name="thumbup" size={16} />
              </button>
              <button
                type="button"
                className={styles.iconAct}
                aria-label="Не полезно"
                title="Не полезно"
                aria-pressed={feedback === 'down'}
                onClick={() => onFeedback('down')}
              >
                <BrainIcon name="thumbdown" size={16} />
              </button>
            </>
          )}
          {onRetry && (
            <button
              type="button"
              className={styles.iconAct}
              aria-label="Повторить"
              title="Повторить"
              onClick={onRetry}
            >
              <BrainIcon name="refresh" size={16} />
            </button>
          )}
          {onCreateTask && (
            <button type="button" className={styles.act} onClick={() => onCreateTask(text)}>
              <BrainIcon name="task" size={14} />
              Создать задачу
            </button>
          )}
          {extraActions}
          <span className={styles.copyStatus} role="status">
            {copyState === 'idle' ? '' : copyLabel}
          </span>
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
