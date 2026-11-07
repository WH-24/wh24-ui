import { useState } from 'react'

import { AgentSteps } from '../agent/AgentSteps.js'
import { AiActionCard } from '../agent/AiActionCard.js'
import { BrainIcon } from '../icons.js'
import { Markdown } from '../markdown/Markdown.js'
import { SourceList } from '../sources/SourceList.js'
import type { ModuleMetaMap } from '../sources/modules.js'
import type { BrainSource, PendingAction } from '../types.js'
import { formatCost, formatDateTime, skipReasonText } from './labels.js'
import { RESTRICTED_NOTE, RunStatusBadge, runCost, runDuration, runTime, triggerLabel } from './RunLogTable.js'
import styles from './runs.module.css'
import type { AgentRun } from './types.js'

export interface RunDetailProps {
  run: AgentRun
  /** Внутренняя ссылка из ответа (`/gen/…`) — переход без перезагрузки. */
  onNavigate?: (path: string) => void
  onOpenSource?: (url: string, source: BrainSource) => void
  modules?: ModuleMetaMap
  /** Подтвердить/отменить отложенное действие — только у того, чьими правами шёл запуск (проверит сервер). */
  onConfirmAction?: (action: PendingAction) => void
  onCancelAction?: (action: PendingAction) => void
  /** id действия, по которому сейчас идёт запрос. */
  busyActionId?: string | null
  /** Ошибки по действиям: id действия → текст. */
  actionErrors?: Record<string, string>
  /** «Повторить» — новый ручной запуск этого агента (делает хост). Для чужих запусков кнопки нет. */
  onRetry?: (run: AgentRun) => void
  retrying?: boolean
  /** «К журналу» — возврат на телефоне, где журнал и детали идут друг за другом. */
  onBack?: () => void
  className?: string
}

const FINISHED = new Set(['completed', 'skipped', 'failed', 'cancelled'])

/**
 * Сервер отдаёт `preview` и `result` как есть от инструмента модуля: `preview`
 * бывает пустым, а `result` — объектом. Карточка ждёт строку: непонятное ей
 * значение не выводим (статус «Выполнено» и так виден), чем роняем весь экран.
 */
function safeAction(a: PendingAction): PendingAction {
  return { ...a, preview: a.preview ?? {}, result: typeof a.result === 'string' ? a.result : undefined }
}

/**
 * Один запуск агента: кто и по какому триггеру, ответ с цитатами, источники,
 * что смотрел агент (только инструменты), действие, которое ждёт «Подтвердить».
 * Пропуск объясняется причиной, ошибка — текстом. Запуск `restricted` —
 * только метаданные: он шёл чужими правами и содержимое вам не показывается.
 */
export function RunDetail({
  run,
  onNavigate,
  onOpenSource,
  modules,
  onConfirmAction,
  onCancelAction,
  busyActionId,
  actionErrors,
  onRetry,
  retrying,
  onBack,
  className,
}: RunDetailProps) {
  const [activeCite, setActiveCite] = useState<number>()
  const restricted = Boolean(run.restricted)
  const time = formatDateTime(runTime(run))
  const cost = formatCost(runCost(run))
  const duration = runDuration(run)
  const toolSteps = (run.steps ?? []).filter((s) => s.kind !== 'model')
  const actions = (run.pending_actions ?? (run.pending_action ? [run.pending_action] : [])).map(safeAction)
  const citations = run.citations ?? []
  const finished = FINISHED.has(run.status)
  const title = run.agent_name || (run.agent_id ? 'Агент' : 'Агент удалён')
  const canRetry = Boolean(onRetry && run.agent_id && finished && !restricted)

  return (
    <article className={[styles.detail, className].filter(Boolean).join(' ')} aria-label={`Запуск: ${title}`}>
      {onBack && (
        <button type="button" className={styles.back} onClick={onBack}>
          ‹ К журналу
        </button>
      )}
      <header className={styles.detailHead}>
        <div className={styles.detailTitleRow}>
          <h3 className={styles.detailTitle}>{title}</h3>
          {canRetry && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={retrying}
              onClick={() => onRetry!(run)}
            >
              <BrainIcon name="refresh" size={14} />
              {retrying ? 'Запускаю…' : 'Повторить'}
            </button>
          )}
        </div>
        <div className={styles.detailMeta}>
          <RunStatusBadge run={run} />
          <span>{triggerLabel(run.trigger_kind)}</span>
          {time && <span>{time}</span>}
        </div>
        <dl className={styles.facts}>
          <div>
            <dt>Стоимость</dt>
            <dd>{cost}</dd>
          </div>
          <div>
            <dt>Длительность</dt>
            <dd>{duration}</dd>
          </div>
          {run.usage?.model && (
            <div>
              <dt>Модель</dt>
              <dd>{run.usage.model}</dd>
            </div>
          )}
        </dl>
      </header>

      {restricted && (
        <div className={styles.callout} data-tone="info" role="note">
          <BrainIcon name="lock" size={15} />
          <div>
            <strong>{RESTRICTED_NOTE}</strong>
            <p>
              Вы управляете журналом, но этот запуск шёл чужими правами: ответ, источники и шаги вам не показываются.
            </p>
          </div>
        </div>
      )}

      {!restricted && run.status === 'skipped' && (
        <div className={styles.callout} data-tone="warn" role="note">
          <BrainIcon name="pause" size={15} />
          <div>
            <strong>Запуск пропущен</strong>
            <p>{skipReasonText(run.skip_reason)}</p>
          </div>
        </div>
      )}

      {!restricted && run.status === 'failed' && (
        <div className={styles.callout} data-tone="bad" role="alert">
          <BrainIcon name="alert" size={15} />
          <div>
            <strong>Запуск завершился ошибкой</strong>
            {run.error && <p>{run.error}</p>}
          </div>
        </div>
      )}

      {!restricted && (run.status === 'queued' || run.status === 'running') && (
        <p className={styles.muted} role="status">
          Агент ещё работает — результат появится здесь.
        </p>
      )}

      {!restricted && run.answer_md && (
        <section className={styles.answer} aria-label="Ответ агента">
          <Markdown
            text={run.answer_md}
            citations={citations}
            activeCitation={activeCite}
            onCitationClick={setActiveCite}
            onNavigate={onNavigate}
          />
        </section>
      )}

      {!restricted && toolSteps.length > 0 && <AgentSteps steps={toolSteps} label="Что смотрел агент" />}

      {!restricted && actions.length > 0 && (
        <div className={styles.actions}>
          {actions.map((a) => (
            <AiActionCard
              key={a.id}
              action={a}
              busy={busyActionId === a.id}
              error={actionErrors?.[a.id]}
              onConfirm={onConfirmAction ? () => onConfirmAction(a) : undefined}
              onCancel={onCancelAction ? () => onCancelAction(a) : undefined}
            />
          ))}
        </div>
      )}

      {!restricted && run.status === 'completed' && (
        <SourceList
          sources={citations}
          activeN={activeCite}
          onOpen={onOpenSource}
          modules={modules}
          emptyText="Ответ без ссылок на документы портала."
        />
      )}
    </article>
  )
}
