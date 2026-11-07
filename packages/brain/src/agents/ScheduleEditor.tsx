import { useEffect, useId, useMemo, useState } from 'react'
import { Combobox, DateField, FieldGrid, FieldRow, Input, type ComboboxOption } from '@wowhaus-24/ui-react'

import {
  DEFAULT_TIMEZONES,
  DEFAULT_TZ,
  WEEKDAY_SHORT,
  cronFromParts,
  dateToEndsAt,
  describeNextRun,
  endsAtToDate,
  isValidTime,
  normalizeTime,
  partsFromCron,
  scheduleProblem,
  wallInTz,
  type Frequency,
  type ScheduleParts,
  type TimezoneOption,
} from './schedule.js'
import styles from './triggers.module.css'

export interface ScheduleValue {
  /** Cron из 5 полей. */
  cron: string
  /** IANA-таймзона расписания. */
  tz: string
  /** Конец расписания, RFC 3339; `null` — без конца. */
  ends_at: string | null
}

export interface ScheduleEditorProps {
  value: ScheduleValue
  onChange: (next: ScheduleValue) => void
  disabled?: boolean
  /** Список таймзон; по умолчанию — часовые пояса России и соседей. */
  timezones?: TimezoneOption[]
  /** «Сейчас» для расчёта ближайшего запуска (тесты). */
  now?: Date
  /** Ошибка проверки на сервере для этого расписания. */
  error?: string
  className?: string
}

const FREQ_OPTIONS: ComboboxOption[] = [
  { value: 'daily', label: 'Каждый день' },
  { value: 'weekdays', label: 'По будням' },
  { value: 'weekly', label: 'По дням недели' },
  { value: 'monthly', label: 'Раз в месяц' },
  { value: 'custom', label: 'Своё расписание (cron)' },
]

const DEFAULT_PARTS: ScheduleParts = { frequency: 'daily', time: '09:00', days: [1], monthDay: 1 }

/**
 * Расписание человеческим вводом: «по будням в 09:30, по Москве». Из выбранного
 * собирается cron и показывается «Следующий запуск …» — считаем по cron, который
 * сейчас в поле, а не по сохранённому. Не чаще раза в 5 минут: нарушение
 * объясняется простым текстом. Нестандартный cron вводится в раскрывающемся
 * поле «Расширенно».
 */
export function ScheduleEditor({
  value,
  onChange,
  disabled,
  timezones = DEFAULT_TIMEZONES,
  now,
  error,
  className,
}: ScheduleEditorProps) {
  const uid = useId()
  const parts = useMemo(() => partsFromCron(value.cron), [value.cron])
  const [forcedCustom, setForcedCustom] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const [timeText, setTimeText] = useState(parts?.time ?? '')
  const [dayText, setDayText] = useState(String(parts?.monthDay ?? 1))

  // Время пришло снаружи (другой триггер, ответ конструктора) — поле его показывает.
  useEffect(() => {
    if (parts) setTimeText((t) => (isValidTime(t) && normalizeTime(t) === parts.time ? t : parts.time))
  }, [parts])

  // То же для числа месяца: пока человек стирает и набирает, поле не должно перескакивать.
  useEffect(() => {
    if (parts?.frequency === 'monthly') {
      setDayText((t) => (Number(t) === parts.monthDay ? t : String(parts.monthDay)))
    }
  }, [parts])

  const frequency: Frequency = forcedCustom || !parts ? 'custom' : parts.frequency
  const emit = (patch: Partial<ScheduleValue>) => onChange({ ...value, ...patch })
  const setParts = (p: ScheduleParts) => {
    const cron = cronFromParts(p)
    if (cron) emit({ cron })
  }

  const tzOptions = useMemo<ComboboxOption[]>(() => {
    const opts = timezones.map((t) => ({ value: t.value, label: t.label }))
    // Таймзона из данных, которой нет в списке, не должна пропадать.
    if (value.tz && !opts.some((o) => o.value === value.tz)) opts.push({ value: value.tz, label: value.tz })
    return opts
  }, [timezones, value.tz])

  const tz = value.tz || DEFAULT_TZ
  const endsDate = endsAtToDate(value.ends_at, tz)
  const problem = scheduleProblem(value.cron)
  const nextRun = problem ? null : describeNextRun(value.cron, tz, value.ends_at, now)
  const shownError = problem ?? error
  const customOpen = advanced || frequency === 'custom'

  const changeFrequency = (f: string) => {
    if (f === 'custom') {
      setForcedCustom(true)
      setAdvanced(true)
      return
    }
    setForcedCustom(false)
    const base = parts ?? DEFAULT_PARTS
    setParts({ ...base, frequency: f as Frequency, days: base.days.length ? base.days : [1] })
  }

  const toggleDay = (day: number) => {
    if (!parts) return
    const has = parts.days.includes(day)
    // Хотя бы один день: пустой набор cron не выразит.
    if (has && parts.days.length === 1) return
    setParts({ ...parts, days: has ? parts.days.filter((d) => d !== day) : [...parts.days, day] })
  }

  const changeTz = (next: string) => {
    if (!next) return
    // Конец расписания — календарная дата: при смене пояса остаётся той же датой.
    emit({ tz: next, ends_at: endsDate ? dateToEndsAt(endsDate, next) : null })
  }

  const today = wallInTz(now ?? new Date(), tz)
  const minDate = today
    ? `${today.y}-${String(today.m).padStart(2, '0')}-${String(today.d).padStart(2, '0')}`
    : undefined
  const id = (s: string) => `${uid}-${s}`

  return (
    <div className={[styles.schedule, className].filter(Boolean).join(' ')}>
      <FieldGrid>
        <FieldRow label="Как часто" htmlFor={id('freq')} span={4}>
          <Combobox
            id={id('freq')}
            ariaLabel="Открыть список: как часто"
            options={FREQ_OPTIONS}
            value={frequency}
            onChange={changeFrequency}
            clearable={false}
            searchable={false}
            disabled={disabled}
          />
        </FieldRow>

        {parts && frequency !== 'custom' && (
          <FieldRow
            label="Время"
            htmlFor={id('time')}
            span={4}
            error={timeText && !isValidTime(timeText) ? 'Время в формате ЧЧ:ММ, например 09:30' : undefined}
          >
            <Input
              id={id('time')}
              inputMode="numeric"
              placeholder="чч:мм"
              autoComplete="off"
              value={timeText}
              disabled={disabled}
              invalid={Boolean(timeText) && !isValidTime(timeText)}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 4)
                const masked = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits
                setTimeText(masked)
                if (isValidTime(masked)) setParts({ ...parts, time: normalizeTime(masked) })
              }}
              onBlur={() => setTimeText(parts.time)}
            />
          </FieldRow>
        )}

        <FieldRow label="Часовой пояс" htmlFor={id('tz')} span={4}>
          <Combobox
            id={id('tz')}
            ariaLabel="Открыть список: часовой пояс"
            options={tzOptions}
            value={tz}
            onChange={changeTz}
            clearable={false}
            disabled={disabled}
          />
        </FieldRow>

        {parts && frequency === 'weekly' && (
          <div className={styles.fullRow} role="group" aria-labelledby={id('days')}>
            <span id={id('days')} className={styles.groupLabel}>
              Дни недели
            </span>
            <div className={styles.days}>
              {WEEKDAY_SHORT.map((name, i) => {
                const day = i + 1
                return (
                  <button
                    key={name}
                    type="button"
                    className={styles.day}
                    aria-pressed={parts.days.includes(day)}
                    disabled={disabled}
                    onClick={() => toggleDay(day)}
                  >
                    {parts.days.includes(day) && (
                      <span className={styles.dayMark} aria-hidden="true">
                        ✓
                      </span>
                    )}
                    {name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {parts && frequency === 'monthly' && (
          <FieldRow
            label="Число месяца"
            htmlFor={id('mday')}
            span={4}
            hint={parts.monthDay > 28 ? 'В месяцах без этого числа запуск пропускается' : 'От 1 до 31'}
          >
            <Input
              id={id('mday')}
              inputMode="numeric"
              maxLength={2}
              value={dayText}
              disabled={disabled}
              invalid={dayText !== '' && !(Number(dayText) >= 1 && Number(dayText) <= 31)}
              onChange={(e) => {
                const text = e.target.value.replace(/\D/g, '').slice(0, 2)
                setDayText(text)
                const n = Number(text)
                if (n >= 1 && n <= 31) setParts({ ...parts, monthDay: n })
              }}
              onBlur={() => setDayText(String(parts.monthDay))}
            />
          </FieldRow>
        )}

        <FieldRow label="Заканчивается" htmlFor={id('ends')} span={4} hint="Необязательно. Включительно">
          <DateField
            id={id('ends')}
            value={endsDate}
            min={minDate}
            disabled={disabled}
            onChange={(date) => emit({ ends_at: date ? dateToEndsAt(date, tz) : null })}
          />
        </FieldRow>
      </FieldGrid>

      <div className={styles.nextRun} aria-live="polite" data-bad={shownError ? '' : undefined}>
        {shownError ? <span role="alert">{shownError}</span> : nextRun}
      </div>

      <div>
        {frequency !== 'custom' && (
          <button
            type="button"
            className={styles.advToggle}
            aria-expanded={customOpen}
            aria-controls={id('adv')}
            onClick={() => setAdvanced((v) => !v)}
          >
            <span className={styles.chev} data-open={customOpen || undefined} aria-hidden="true">
              ›
            </span>
            Расширенно: cron
          </button>
        )}
        {customOpen && (
          <div id={id('adv')} className={styles.advBody}>
            <FieldRow
              label="Расписание в формате cron"
              htmlFor={id('cron')}
              span={12}
              hint="5 полей: минута, час, число, месяц, день недели. Например, 30 9 * * 1-5 — по будням в 09:30"
            >
              <Input
                id={id('cron')}
                className={styles.mono}
                spellCheck={false}
                autoComplete="off"
                value={value.cron}
                disabled={disabled}
                invalid={Boolean(shownError)}
                onChange={(e) => emit({ cron: e.target.value })}
              />
            </FieldRow>
          </div>
        )}
      </div>
    </div>
  )
}
