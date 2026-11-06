import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Icon } from '@wowhaus-24/ui-react'

import { BrainIcon } from '../icons.js'
import { AgentAvatar } from './AgentAvatar.js'
import { triggerSummary } from './draft.js'
import { AGENT_STATUS_LABEL, RUN_STATUS_LABEL, formatDateTime } from './labels.js'
import styles from './cards.module.css'
import type { Agent, AgentStatus } from './types.js'

export interface AgentCardProps {
  agent: Agent
  /** Открыть профиль: клик по названию и по самой карточке. */
  onOpen?: (agent: Agent) => void
  /** «Запустить» — видна, если сервер разрешил (`agent.can.run`). */
  onRun?: (agent: Agent) => void
  runBusy?: boolean
  /** В меню «⋯»: «Дублировать» (создать копию могут только с ролью «Редактирование» — решает хост). */
  onDuplicate?: (agent: Agent) => void
  /** В меню «⋯»: «Удалить» — только если `agent.can.delete`. Подтверждение (`ConfirmDialog`) показывает хост. */
  onDelete?: (agent: Agent) => void
  className?: string
}

const STATUS_GLYPH: Record<AgentStatus, ReactNode> = {
  active: <Icon name="check" size={12} />,
  paused: <BrainIcon name="pause" size={12} />,
  draft: <Icon name="pen" size={12} />,
}

export function AgentStatusBadge({ status }: { status: AgentStatus | undefined }) {
  const s = status ?? 'draft'
  return (
    <span className={styles.statusBadge} data-status={s}>
      {STATUS_GLYPH[s]}
      {AGENT_STATUS_LABEL[s] ?? s}
    </span>
  )
}

interface MenuItem {
  label: string
  danger?: boolean
  onSelect: () => void
}

/** Меню «⋯»: Esc и клик мимо закрывают, стрелки двигают, фокус возвращается на кнопку. */
function CardMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const menuId = useId()

  const close = (restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) btn.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    list.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (list.current?.contains(t) || btn.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown, true)
    return () => document.removeEventListener('mousedown', onDown, true)
  }, [open])

  const onKeyDown = (e: KeyboardEvent) => {
    const els = Array.from(list.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    const i = els.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      close(true)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      els[(i + 1) % els.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      els[(i - 1 + els.length) % els.length]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      els[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      els[els.length - 1]?.focus()
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div className={styles.menuWrap}>
      <button
        ref={btn}
        type="button"
        className={styles.menuBtn}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="more" size={16} />
      </button>
      {open && (
        <div ref={list} id={menuId} className={styles.menu} role="menu" aria-label={label} onKeyDown={onKeyDown}>
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              className={styles.menuItem}
              data-danger={it.danger || undefined}
              onClick={() => {
                close(false)
                it.onSelect()
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Карточка агента в списке: название, описание, статус, как запускается, сколько
 * было запусков. «Запустить» — по `can.run`, меню — «Дублировать» и «Удалить».
 * Права только решают, что показать: запрещённое действие сервер отклонит.
 */
export function AgentCard({ agent, onOpen, onRun, runBusy, onDuplicate, onDelete, className }: AgentCardProps) {
  const triggers = triggerSummary(agent.triggers, true)
  const last = formatDateTime(agent.last_run_at)
  const total = agent.runs_total
  const items: MenuItem[] = []
  if (onDuplicate) items.push({ label: 'Дублировать', onSelect: () => onDuplicate(agent) })
  if (onDelete && agent.can?.delete) items.push({ label: 'Удалить', danger: true, onSelect: () => onDelete(agent) })
  const canRun = Boolean(onRun && agent.can?.run)
  const lastStatus = agent.last_status ? RUN_STATUS_LABEL[agent.last_status as keyof typeof RUN_STATUS_LABEL] : null

  return (
    <article className={[styles.card, className].filter(Boolean).join(' ')} data-status={agent.status ?? 'draft'}>
      <div className={styles.top}>
        <AgentAvatar name={agent.avatar} />
        <div className={styles.titleBlock}>
          <h3 className={styles.title}>
            {onOpen ? (
              <button type="button" className={styles.titleBtn} onClick={() => onOpen(agent)}>
                {agent.name || 'Без названия'}
              </button>
            ) : (
              agent.name || 'Без названия'
            )}
          </h3>
          <div className={styles.badges}>
            <AgentStatusBadge status={agent.status} />
            {agent.visibility === 'public' && <span className={styles.shared}>Общий</span>}
          </div>
        </div>
        {items.length > 0 && <CardMenu label={`Действия: ${agent.name || 'агент'}`} items={items} />}
      </div>

      {agent.description && <p className={styles.desc}>{agent.description}</p>}

      <dl className={styles.facts}>
        <div>
          <dt>Запуск</dt>
          <dd>{triggers.length ? triggers.join(' · ') : 'Триггеры выключены'}</dd>
        </div>
        {agent.model && (
          <div>
            <dt>Модель</dt>
            <dd>{agent.model}</dd>
          </div>
        )}
      </dl>

      <footer className={styles.foot}>
        <span className={styles.runs}>
          {total === undefined
            ? null
            : total === 0
              ? 'Запусков нет'
              : `Запусков ${total}${last ? ` · последний ${last}` : ''}${lastStatus ? ` — ${lastStatus}` : ''}`}
        </span>
        {canRun && (
          <button type="button" className="btn btn-secondary btn-sm" disabled={runBusy} onClick={() => onRun!(agent)}>
            <Icon name="send" size={14} />
            {runBusy ? 'Запускаю…' : 'Запустить'}
          </button>
        )}
      </footer>
    </article>
  )
}
