import { useId, useRef } from 'react'
import { Icon, type IconName } from '@wowhaus-24/ui-react'

import { BrainIcon } from '../icons.js'
import { EventTriggerFields } from './EventTriggerFields.js'
import { firstFocusable, useFocusAfterChange } from './focus.js'
import { TRIGGER_KIND_LABEL } from './labels.js'
import { ScheduleEditor } from './ScheduleEditor.js'
import { DEFAULT_TZ, type TimezoneOption } from './schedule.js'
import { BrainSwitch } from './Switch.js'
import styles from './triggers.module.css'
import type { EventKeyOption, Trigger, TriggerConfig, TriggerKind } from './types.js'

/** Не больше стольких триггеров у агента (то же ограничение у сервера). */
export const MAX_TRIGGERS = 10

/** Подсказка вместо полей события для тех, кто модулем не управляет. */
export const EVENT_LOCKED_HINT = 'Триггеры по событиям настраивает управляющий модулем ИИ'

const KIND_ICON: Record<TriggerKind, IconName> = { manual: 'bolt', schedule: 'timer', event: 'bell' }

export interface TriggerEditorProps {
  value: Trigger[]
  onChange: (next: Trigger[]) => void
  /** Управляет модулем ИИ: только им можно настраивать триггеры по событиям. Сервер проверит в любом случае. */
  canManage?: boolean
  readOnly?: boolean
  /** Ключи событий для выбора: `{key, label}` (даёт хост из notify-api). Можно вводить и `префикс.*`. */
  eventKeyOptions?: EventKeyOption[]
  timezones?: TimezoneOption[]
  /** Ошибки проверки: `triggers` — общая, `triggers[0]` — у конкретного триггера. */
  errors?: Record<string, string>
  /** «Сейчас» для расчёта ближайшего запуска (тесты). */
  now?: Date
  maxTriggers?: number
  className?: string
}

function newTrigger(kind: TriggerKind): Trigger {
  switch (kind) {
    case 'schedule':
      return { kind, enabled: true, config: { cron: '0 9 * * 1-5', tz: DEFAULT_TZ, ends_at: null } }
    case 'event':
      return { kind, enabled: true, config: { event_keys: [], filter: [], condition_nl: '', include_payload: false } }
    default:
      return { kind, enabled: true, config: {} }
  }
}

/**
 * Триггеры агента: «Вручную», «По расписанию», «По событию». Список правится
 * целиком (сервер заменяет набор). Триггеры по событиям доступны только тем, кто
 * управляет модулем: остальным блок показан заблокированным с подсказкой.
 */
export function TriggerEditor({
  value,
  onChange,
  canManage = false,
  readOnly = false,
  eventKeyOptions,
  timezones,
  errors,
  now,
  maxTriggers = MAX_TRIGGERS,
  className,
}: TriggerEditorProps) {
  const uid = useId()
  const listRef = useRef<HTMLUListElement>(null)
  const addRef = useRef<HTMLDivElement>(null)
  const after = useFocusAfterChange(value.length)
  const full = value.length >= maxTriggers
  const hasManual = value.some((t) => t.kind === 'manual')
  const patchAt = (i: number, p: Partial<Trigger>) => onChange(value.map((t, j) => (j === i ? { ...t, ...p } : t)))
  const configAt = (i: number, config: TriggerConfig) => patchAt(i, { config })
  const eventLocked = !canManage
  // Фокус не теряем: новый триггер — в его первое поле, удалённый — на соседа.
  const add = (kind: TriggerKind) => {
    after(() => firstFocusable(listRef.current?.lastElementChild))
    onChange([...value, newTrigger(kind)])
  }
  const remove = (i: number) => {
    after(() => {
      const cards = listRef.current?.children
      const next = cards?.[Math.min(i, (cards?.length ?? 1) - 1)]
      return (
        next?.querySelector<HTMLElement>('button[aria-label^="Удалить триггер"]') ??
        firstFocusable(next) ??
        firstFocusable(addRef.current)
      )
    })
    onChange(value.filter((_, j) => j !== i))
  }
  const countByKind: Record<TriggerKind, number> = { manual: 0, schedule: 0, event: 0 }

  return (
    <div className={[styles.editor, className].filter(Boolean).join(' ')}>
      {value.length === 0 && <p className={styles.empty}>Триггеров нет: агента нельзя запустить.</p>}
      {value.length > 0 && (
        <ul ref={listRef} className={styles.list}>
          {value.map((t, i) => {
            countByKind[t.kind]++
            const label = TRIGGER_KIND_LABEL[t.kind]
            const nameInKind = value.filter((x) => x.kind === t.kind).length > 1 ? ` ${countByKind[t.kind]}` : ''
            const lockedHere = readOnly || (t.kind === 'event' && eventLocked)
            const err = errors?.[`triggers[${i}]`]
            return (
              <li
                key={t.id || `new-${i}`}
                className={styles.card}
                data-kind={t.kind}
                data-off={!t.enabled || undefined}
              >
                <div className={styles.cardHead}>
                  <span className={styles.kind}>
                    <Icon name={KIND_ICON[t.kind]} size={14} />
                    {label}
                    {nameInKind}
                  </span>
                  <BrainSwitch
                    checked={t.enabled}
                    disabled={lockedHere}
                    ariaLabel={`Включён: ${label}${nameInKind}`}
                    onChange={(enabled) => patchAt(i, { enabled })}
                  >
                    {t.enabled ? 'Включён' : 'Выключен'}
                  </BrainSwitch>
                  {!lockedHere && (
                    <button
                      type="button"
                      className={styles.iconBtn}
                      aria-label={`Удалить триггер: ${label}${nameInKind}`}
                      onClick={() => remove(i)}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  )}
                </div>

                {t.kind === 'manual' && (
                  <p className={styles.note}>
                    Кнопка «Запустить» в карточке агента. Агент работает правами того, кто его запустил.
                  </p>
                )}

                {t.kind === 'schedule' && (
                  <ScheduleEditor
                    value={{
                      cron: t.config.cron ?? '',
                      tz: t.config.tz || DEFAULT_TZ,
                      ends_at: t.config.ends_at ?? null,
                    }}
                    disabled={lockedHere}
                    timezones={timezones}
                    now={now}
                    error={err}
                    onChange={(s) => configAt(i, { ...t.config, cron: s.cron, tz: s.tz, ends_at: s.ends_at })}
                  />
                )}

                {t.kind === 'event' && (
                  <>
                    {eventLocked && (
                      <p className={styles.lock} id={`${uid}-lock-${i}`} role="note">
                        <BrainIcon name="shield" size={14} />
                        {EVENT_LOCKED_HINT}
                      </p>
                    )}
                    <EventTriggerFields
                      config={t.config}
                      disabled={lockedHere}
                      eventKeyOptions={eventKeyOptions}
                      onChange={(c) => configAt(i, c)}
                    />
                  </>
                )}

                {err && t.kind !== 'schedule' && (
                  <p className={styles.fieldError} role="alert">
                    {err}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {errors?.triggers && (
        <p className={styles.fieldError} role="alert">
          {errors.triggers}
        </p>
      )}

      {!readOnly && (
        <div ref={addRef} className={styles.addRow} role="group" aria-label="Добавить триггер">
          <button type="button" className="btn btn-secondary btn-sm" disabled={full} onClick={() => add('schedule')}>
            <Icon name="plus" size={14} />
            По расписанию
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={full || eventLocked}
            aria-describedby={eventLocked ? `${uid}-event-lock` : undefined}
            onClick={() => add('event')}
          >
            <Icon name="plus" size={14} />
            По событию
          </button>
          {!hasManual && (
            <button type="button" className="btn btn-ghost btn-sm" disabled={full} onClick={() => add('manual')}>
              <Icon name="plus" size={14} />
              Вручную
            </button>
          )}
        </div>
      )}
      {!readOnly && eventLocked && !value.some((t) => t.kind === 'event') && (
        <p className={styles.lock} id={`${uid}-event-lock`} role="note">
          <BrainIcon name="shield" size={14} />
          {EVENT_LOCKED_HINT}
        </p>
      )}
      {!readOnly && full && <p className={styles.note}>Достигнут предел — не больше {maxTriggers} триггеров.</p>}
    </div>
  )
}
