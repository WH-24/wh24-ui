import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Combobox, FieldRow, Icon, Input, MultiCombobox, Textarea, type ComboboxOption } from '@wowhaus-24/ui-react'

import { PrivacyNotice } from '../meta/PrivacyNotice.js'
import { firstFocusable, useFocusAfterChange } from './focus.js'
import { BrainSwitch } from './Switch.js'
import styles from './triggers.module.css'
import type { EventKeyOption, FilterOp, FilterRule, TriggerConfig } from './types.js'

/** До стольких условий фильтра (то же ограничение у сервера). */
export const MAX_FILTER_RULES = 8
const MAX_EVENT_KEYS = 20
const EVENT_KEY_RE = /^[a-z0-9_]+(\.[a-z0-9_]+)*(\.\*)?$/

const FILTER_PATHS: ComboboxOption[] = [
  { value: 'subject_type', label: 'Тип записи', hint: 'subject_type' },
  { value: 'subject_id', label: 'ID записи', hint: 'subject_id' },
  { value: 'department_id', label: 'Отдел', hint: 'department_id' },
  { value: 'actor_user_id', label: 'Кто совершил действие', hint: 'actor_user_id' },
  { value: 'subject_user_id', label: 'О ком событие', hint: 'subject_user_id' },
  { value: 'link', label: 'Ссылка', hint: 'link' },
  { value: 'payload', label: 'Поле данных события', hint: 'payload.…' },
]

const FILTER_OPS: ComboboxOption[] = [
  { value: 'eq', label: 'равно' },
  { value: 'in', label: 'одно из' },
  { value: 'contains', label: 'содержит' },
  { value: 'exists', label: 'заполнено' },
]

const pathKind = (path: string) => (path === 'payload' || path.startsWith('payload.') ? 'payload' : path)

/** Ключи событий для выбора + шаблоны `префикс.*` там, где под префиксом больше одного ключа. */
export function eventKeyChoices(options: EventKeyOption[]): ComboboxOption[] {
  const out: ComboboxOption[] = options.map((o) => ({
    value: o.key,
    label: o.label || o.key,
    hint: o.label ? o.key : null,
  }))
  const known = new Set(options.map((o) => o.key))
  const under = new Map<string, Set<string>>()
  for (const { key } of options) {
    const segs = key.split('.')
    for (let i = 1; i < segs.length; i++) {
      const prefix = `${segs.slice(0, i).join('.')}.*`
      if (!under.has(prefix)) under.set(prefix, new Set())
      under.get(prefix)!.add(key)
    }
  }
  for (const [pattern, keys] of under) {
    if (keys.size > 1 && !known.has(pattern)) {
      out.push({ value: pattern, label: `Любое: ${pattern}`, hint: 'шаблон' })
    }
  }
  return out
}

/** Проверка ключа события или шаблона (как у сервера); `null` — подходит. */
export function eventKeyProblem(key: string): string | null {
  if (!key.trim()) return 'Введите ключ события'
  if (!EVENT_KEY_RE.test(key.trim())) {
    return 'Ключ — латиница, цифры и «_», части через точку; шаблон — с «.*» в конце, например oup.lead.*'
  }
  return null
}

const parseList = (text: string) =>
  text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

/** Значение условия «одно из»: текст хранится локально, иначе запятая в конце съедается при вводе. */
function ListValueInput({
  value,
  onChange,
  label,
  disabled,
}: {
  value: string[]
  onChange: (v: string[]) => void
  label: string
  disabled?: boolean
}) {
  const [text, setText] = useState(value.join(', '))
  // Список поменяли снаружи (сброс, ответ конструктора) — поле показывает его;
  // свой же ввод перечитывать нельзя: съест запятую в конце.
  useEffect(() => {
    if (JSON.stringify(parseList(text)) !== JSON.stringify(value)) setText(value.join(', '))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <Input
      aria-label={label}
      placeholder="значения через запятую"
      value={text}
      disabled={disabled}
      onChange={(e) => {
        setText(e.target.value)
        onChange(parseList(e.target.value))
      }}
    />
  )
}

function FilterRow({
  index,
  rule,
  onChange,
  onRemove,
  disabled,
}: {
  index: number
  rule: FilterRule
  onChange: (r: FilterRule) => void
  onRemove: () => void
  disabled?: boolean
}) {
  const n = index + 1
  const uid = useId()
  const kind = pathKind(rule.path)
  const setOp = (op: FilterOp) => {
    if (op === rule.op) return
    if (op === 'exists') return onChange({ path: rule.path, op })
    if (op === 'in') {
      const cur = typeof rule.value === 'string' ? rule.value : ''
      return onChange({ path: rule.path, op, value: cur ? [cur] : [] })
    }
    const first = Array.isArray(rule.value) ? (rule.value[0] ?? '') : (rule.value ?? '')
    onChange({ path: rule.path, op, value: first })
  }
  return (
    <li className={styles.filterRow}>
      <div className={styles.filterCell}>
        <label htmlFor={`${uid}-path`} className={styles.srOnly}>{`Поле условия ${n}`}</label>
        <Combobox
          id={`${uid}-path`}
          ariaLabel={`Открыть список: поле условия ${n}`}
          options={FILTER_PATHS}
          value={kind}
          clearable={false}
          searchable={false}
          disabled={disabled}
          onChange={(v) => v && onChange({ ...rule, path: v === 'payload' ? 'payload.' : v })}
        />
      </div>
      {kind === 'payload' && (
        <div className={styles.filterCell}>
          <Input
            aria-label={`Ключ данных события в условии ${n}`}
            className={styles.mono}
            placeholder="ключ"
            maxLength={40}
            value={rule.path.replace(/^payload\.?/, '')}
            disabled={disabled}
            onChange={(e) => onChange({ ...rule, path: `payload.${e.target.value.replace(/[^A-Za-z0-9_]/g, '')}` })}
          />
        </div>
      )}
      <div className={styles.filterCell}>
        <label htmlFor={`${uid}-op`} className={styles.srOnly}>{`Операция условия ${n}`}</label>
        <Combobox
          id={`${uid}-op`}
          ariaLabel={`Открыть список: операция условия ${n}`}
          options={FILTER_OPS}
          value={rule.op}
          clearable={false}
          searchable={false}
          disabled={disabled}
          onChange={(v) => v && setOp(v as FilterOp)}
        />
      </div>
      {rule.op !== 'exists' && (
        <div className={styles.filterCellGrow}>
          {rule.op === 'in' ? (
            <ListValueInput
              label={`Значения условия ${n}`}
              value={Array.isArray(rule.value) ? rule.value : []}
              disabled={disabled}
              onChange={(value) => onChange({ ...rule, value })}
            />
          ) : (
            <Input
              aria-label={`Значение условия ${n}`}
              placeholder="значение"
              value={typeof rule.value === 'string' ? rule.value : ''}
              disabled={disabled}
              onChange={(e) => onChange({ ...rule, value: e.target.value })}
            />
          )}
        </div>
      )}
      <button
        type="button"
        className={styles.iconBtn}
        aria-label={`Убрать условие ${n}`}
        disabled={disabled}
        onClick={onRemove}
      >
        <Icon name="close" size={14} />
      </button>
    </li>
  )
}

export interface EventTriggerFieldsProps {
  config: TriggerConfig
  onChange: (next: TriggerConfig) => void
  eventKeyOptions?: EventKeyOption[]
  disabled?: boolean
}

/**
 * Триггер по событию: ключи событий (из списка и `префикс.*`), фильтр по полям
 * события (до 8 условий), условие своими словами и передача данных события.
 * Показывать только тем, кто управляет модулем: решает вызывающий.
 */
export function EventTriggerFields({ config, onChange, eventKeyOptions = [], disabled }: EventTriggerFieldsProps) {
  const uid = useId()
  const keys = config.event_keys ?? []
  const filter = config.filter ?? []
  const filterList = useRef<HTMLUListElement>(null)
  const addRule = useRef<HTMLButtonElement>(null)
  const after = useFocusAfterChange(filter.length)
  const [manual, setManual] = useState(false)
  const [manualText, setManualText] = useState('')
  const [manualError, setManualError] = useState<string | null>(null)
  const choices = useMemo(() => eventKeyChoices(eventKeyOptions), [eventKeyOptions])
  const patch = (p: Partial<TriggerConfig>) => onChange({ ...config, ...p })

  const addManual = () => {
    const key = manualText.trim()
    const problem = eventKeyProblem(key)
    if (problem) return setManualError(problem)
    if (keys.length >= MAX_EVENT_KEYS) return setManualError(`Не больше ${MAX_EVENT_KEYS} ключей`)
    if (!keys.includes(key)) patch({ event_keys: [...keys, key] })
    setManualText('')
    setManualError(null)
  }

  const setRule = (i: number, r: FilterRule) => patch({ filter: filter.map((x, j) => (j === i ? r : x)) })
  const addFilter = () => {
    after(() => firstFocusable(filterList.current?.lastElementChild))
    patch({ filter: [...filter, { path: 'subject_type', op: 'eq', value: '' }] })
  }
  const removeFilter = (i: number) => {
    after(() => {
      const rows = filterList.current?.children
      const next = rows?.[Math.min(i, (rows?.length ?? 1) - 1)]
      return next?.querySelector<HTMLElement>('button[aria-label^="Убрать условие"]') ?? addRule.current
    })
    patch({ filter: filter.filter((_, j) => j !== i) })
  }

  return (
    <div className={styles.eventFields}>
      <FieldRow
        label="События"
        htmlFor={`${uid}-keys`}
        span={12}
        hint={
          keys.length === 0 ? 'Выберите одно или несколько событий — агент запустится при каждом из них' : undefined
        }
      >
        <MultiCombobox
          id={`${uid}-keys`}
          options={choices}
          values={keys}
          onChange={(v) => patch({ event_keys: v.slice(0, MAX_EVENT_KEYS) })}
          placeholder="— выбрать события —"
          ariaLabel="Открыть список событий"
          emptyText="Таких событий нет в списке — введите ключ вручную"
          disabled={disabled}
        />
      </FieldRow>

      {!disabled && (
        <div className={styles.manualKey}>
          {manual ? (
            <>
              <div className={styles.manualRow}>
                <Input
                  className={styles.mono}
                  aria-label="Ключ события или шаблон"
                  placeholder="oup.lead.* или oup.lead.stale"
                  spellCheck={false}
                  value={manualText}
                  invalid={Boolean(manualError)}
                  onChange={(e) => {
                    setManualText(e.target.value)
                    setManualError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addManual()
                    }
                  }}
                />
                <button type="button" className="btn btn-secondary btn-sm" onClick={addManual}>
                  Добавить
                </button>
              </div>
              {manualError && (
                <div className={styles.fieldError} role="alert">
                  {manualError}
                </div>
              )}
            </>
          ) : (
            <button type="button" className={styles.linkBtn} onClick={() => setManual(true)}>
              Ввести ключ или шаблон вручную
            </button>
          )}
        </div>
      )}

      <fieldset className={styles.filter} disabled={disabled}>
        <legend className={styles.groupLabel}>Фильтр по полям события</legend>
        <p className={styles.filterHint}>
          Запускать, только если поля события совпали. Условия соединяются через «и»; до {MAX_FILTER_RULES}.
        </p>
        {filter.length > 0 && (
          <ul ref={filterList} className={styles.filterList}>
            {filter.map((r, i) => (
              <FilterRow
                key={i}
                index={i}
                rule={r}
                disabled={disabled}
                onChange={(next) => setRule(i, next)}
                onRemove={() => removeFilter(i)}
              />
            ))}
          </ul>
        )}
        {!disabled && (
          <button
            ref={addRule}
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={filter.length >= MAX_FILTER_RULES}
            onClick={addFilter}
          >
            <Icon name="plus" size={14} />
            Условие
          </button>
        )}
      </fieldset>

      <FieldRow
        label="Условие своими словами"
        htmlFor={`${uid}-nl`}
        span={12}
        hint="Необязательно. Проверяет недорогая модель; если проверить не удалось, запуск пропускается"
      >
        <Textarea
          id={`${uid}-nl`}
          rows={2}
          maxLength={1000}
          placeholder="Например: только лиды крупнее 10 млн"
          value={config.condition_nl ?? ''}
          disabled={disabled}
          onChange={(e) => patch({ condition_nl: e.target.value })}
        />
      </FieldRow>

      <div className={styles.payload}>
        <BrainSwitch
          checked={Boolean(config.include_payload)}
          disabled={disabled}
          describedBy={`${uid}-payload-note`}
          onChange={(v) => patch({ include_payload: v })}
        >
          Передавать агенту данные события
        </BrainSwitch>
        <div id={`${uid}-payload-note`}>
          {config.include_payload ? (
            <PrivacyNotice tone="warn">
              Данные события могут быть шире ваших прав: агент увидит их целиком и может упомянуть в ответе. Включайте,
              только если без них не обойтись.
            </PrivacyNotice>
          ) : (
            <p className={styles.fieldHint}>Агент узнает только ссылку и тип записи, а не содержимое события.</p>
          )}
        </div>
      </div>
    </div>
  )
}
