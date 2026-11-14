import { useEffect, useRef, useState, type ReactNode } from 'react'

import { DateField } from '../../form/DateField.js'
import { Input } from '../../form/Input.js'
import { Menu, MenuItem } from '../../Menu/Menu.js'
import { keyboardInitiated } from '../../overlay/motion.js'
import { AnchorPopover } from '../../popup/AnchorPopover.js'
import { Icon } from '../Icon.js'
import { isEmptyValue } from './matchItem.js'
import type { DateRange, FilterBarConfig, FilterFieldDef, FilterState, FilterValue } from './types.js'
import styles from './filter.module.css'

/** Подписи фильтра-плашек; любую можно заменить через `labels`. */
export interface FilterChipsLabels {
  /** Кнопка «добавить условие». */
  add: string
  /** Имя меню полей для читалки. */
  addMenu: string
  /** Подпись кнопки «×» у условия. */
  remove: (fieldLabel: string) => string
  /** Имя списка значений для читалки. */
  values: (fieldLabel: string) => string
  yes: string
  no: string
  from: string
  to: string
  textPlaceholder: string
  /** Значение ещё не выбрано. */
  empty: string
}

const LABELS: FilterChipsLabels = {
  add: 'Фильтр',
  addMenu: 'Добавить условие',
  remove: (f) => `Снять условие «${f}»`,
  values: (f) => `${f}: значение`,
  yes: 'Да',
  no: 'Нет',
  from: 'С',
  to: 'По',
  textPlaceholder: 'Введите значение',
  empty: '…',
}

const ruDate = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso
}

/** Значение условия словами — для плашки «Поле: значение». */
export function conditionText<T>(
  field: FilterFieldDef<T>,
  v: FilterValue | undefined,
  l: Pick<FilterChipsLabels, 'yes' | 'no' | 'from' | 'to'> = LABELS,
): string {
  if (v === undefined || isEmptyValue(v)) return ''
  const labelOf = (val: string) => field.options?.find((o) => o.value === val)?.label ?? val
  if (typeof v === 'boolean') return v ? l.yes : l.no
  // Сохранённый выбор живёт дольше типа поля: строку у мультивыбора и массив
  // у одиночного показываем как есть, а не роняем отрисовку.
  if (Array.isArray(v)) return v.map(labelOf).join(', ')
  if (typeof v === 'string') return field.type === 'text' ? v : labelOf(v)
  const r = v as DateRange
  if (r.from && r.to) return `${ruDate(r.from)} – ${ruDate(r.to)}`
  return r.from ? `${l.from.toLowerCase()} ${ruDate(r.from)}` : `${l.to.toLowerCase()} ${ruDate(r.to)}`
}

export interface FilterChipsProps<T> {
  config: FilterBarConfig<T>
  state: FilterState
  setState: (s: FilterState) => void
  /** После кнопки «Фильтр» — например «Сохранить вид». */
  trailing?: ReactNode
  labels?: Partial<FilterChipsLabels>
}

/**
 * Фильтр плашками (принятый макет, `.cond`): каждое условие — «Поле: значение ▾»,
 * значение меняется на месте (список — общий `Menu`, текст и даты — панель с
 * полем), «×» снимает условие, «Фильтр» добавляет новое: поле → значение.
 * Состояние — тот же `FilterState`, что у панели: режимы меняются без данных.
 */
export function FilterChips<T>({ config, state, setState, trailing, labels }: FilterChipsProps<T>) {
  const l = { ...LABELS, ...labels }
  // Поле, которое только что добавили: его плашка открыта и ждёт значения.
  const [adding, setAdding] = useState<string | null>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  // Плашку сняли или не заполнили — фокус не должен упасть на <body>.
  const refocus = useRef(false)
  useEffect(() => {
    if (!refocus.current) return
    refocus.current = false
    if (document.activeElement && document.activeElement !== document.body) return
    ;(addRef.current ?? rootRef.current?.querySelector<HTMLElement>('button, input'))?.focus()
  })

  const shown = config.fields.filter((f) => f.key === adding || !isEmptyValue(state[f.key] ?? null))
  const free = config.fields.filter((f) => !shown.includes(f))

  const setValue = (key: string, v: FilterValue) => {
    const next = { ...state }
    if (isEmptyValue(v)) delete next[key]
    else next[key] = v
    setState(next)
  }

  return (
    <div className={styles.chipsBar} ref={rootRef} role="group" aria-label={config.search?.placeholder ?? l.add}>
      {config.search && (
        <label className={styles.chipsSearch}>
          <Icon name="search" size={15} />
          <input
            className={styles.chipsSearchInput}
            aria-label={config.search.placeholder ?? 'Поиск'}
            placeholder={config.search.placeholder ?? 'Поиск'}
            value={typeof state.q === 'string' ? state.q : ''}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => setState({ ...state, q: e.target.value })}
          />
        </label>
      )}
      {shown.map((f) => (
        <ConditionChip
          key={f.key}
          field={f}
          value={state[f.key] ?? null}
          labels={l}
          draft={f.key === adding}
          onChange={(v) => setValue(f.key, v)}
          onRemove={() => {
            refocus.current = true
            if (adding === f.key) setAdding(null)
            setValue(f.key, null)
          }}
          onSettled={() => {
            if (adding !== f.key) return
            if (isEmptyValue(state[f.key] ?? null)) refocus.current = true
            setAdding(null)
          }}
        />
      ))}
      {free.length > 0 && (
        <Menu
          label={l.addMenu}
          align="start"
          trigger={
            <button ref={addRef} type="button" className={`btn btn-ghost btn-sm ${styles.chipsAdd}`}>
              <Icon name="filter" size={14} />
              {l.add}
            </button>
          }
        >
          {free.map((f) => (
            <MenuItem key={f.key} onSelect={() => setAdding(f.key)}>
              {f.label}
            </MenuItem>
          ))}
        </Menu>
      )}
      {trailing}
    </div>
  )
}

interface ConditionChipProps<T> {
  field: FilterFieldDef<T>
  value: FilterValue
  labels: FilterChipsLabels
  /** Только что добавлено: редактор значения открыт сразу. */
  draft: boolean
  onChange: (v: FilterValue) => void
  onRemove: () => void
  /** Редактор значения закрылся. */
  onSettled: () => void
}

function ConditionChip<T>({ field, value, labels: l, draft, onChange, onRemove, onSettled }: ConditionChipProps<T>) {
  const [open, setOpenState] = useState(draft)
  const btnRef = useRef<HTMLButtonElement>(null)
  // Плашка появилась от действия с клавиатуры — без анимации входа.
  const instant = useRef(keyboardInitiated()).current
  const setOpen = (next: boolean) => {
    setOpenState(next)
    if (!next) onSettled()
  }
  const text = conditionText(field, value, l)
  const panel = field.type === 'text' || field.type === 'daterange'
  const button = (
    <button
      ref={btnRef}
      type="button"
      className={styles.condValue}
      aria-haspopup={panel ? 'dialog' : undefined}
      aria-expanded={open}
      onClick={panel ? () => setOpen(!open) : undefined}
      title={text ? `${field.label}: ${text}` : undefined}
    >
      <span className={styles.condField}>{field.label}:</span>
      <b className={styles.condText}>{text || l.empty}</b>
      <Icon name="chevdown" size={12} />
    </button>
  )

  let editor: ReactNode
  if (panel) {
    const range: DateRange =
      value && typeof value === 'object' && !Array.isArray(value) ? (value as DateRange) : { from: '', to: '' }
    const patch = (p: Partial<DateRange>) => {
      const next = { ...range, ...p }
      onChange(next.from || next.to ? next : null)
    }
    editor = (
      <>
        {button}
        <AnchorPopover
          open={open}
          anchor={() => btnRef.current}
          label={l.values(field.label)}
          onClose={(back) => {
            setOpen(false)
            if (back) btnRef.current?.focus()
          }}
        >
          {field.type === 'text' ? (
            <Input
              className={styles.condInput}
              aria-label={field.label}
              placeholder={field.placeholder ?? l.textPlaceholder}
              value={typeof value === 'string' ? value : ''}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                setOpen(false)
                btnRef.current?.focus()
              }}
            />
          ) : (
            <div className={styles.condRange}>
              <DateField ariaLabel={`${field.label}: ${l.from.toLowerCase()}`} value={range.from} max={range.to || undefined} onChange={(from) => patch({ from })} />
              <span aria-hidden="true">—</span>
              <DateField ariaLabel={`${field.label}: ${l.to.toLowerCase()}`} value={range.to} min={range.from || undefined} onChange={(to) => patch({ to })} />
            </div>
          )}
        </AnchorPopover>
      </>
    )
  } else {
    const options =
      field.type === 'boolean'
        ? [
            { value: 'true', label: l.yes },
            { value: 'false', label: l.no },
          ]
        : (field.options ?? [])
    const multi = field.type === 'multiselect'
    const current: string[] = Array.isArray(value)
      ? value
      : typeof value === 'boolean'
        ? [String(value)]
        : typeof value === 'string' && value
          ? [value]
          : []
    const pick = (v: string) => {
      if (field.type === 'boolean') onChange(v === 'true')
      else if (multi) onChange(current.includes(v) ? current.filter((x) => x !== v) : [...current, v])
      else onChange(v)
    }
    editor = (
      <Menu label={l.values(field.label)} align="start" open={open} onOpenChange={setOpen} trigger={button}>
        {options.map((o) => (
          <MenuItem key={o.value} checked={current.includes(o.value)} keepOpen={multi} onSelect={() => pick(o.value)}>
            {o.label}
          </MenuItem>
        ))}
      </Menu>
    )
  }

  return (
    <span className={styles.cond} data-draft={draft && !text ? '' : undefined} data-instant={instant || undefined}>
      {editor}
      <button type="button" className={styles.condRemove} aria-label={l.remove(field.label)} onClick={onRemove}>
        <Icon name="close" size={12} />
      </button>
    </span>
  )
}
