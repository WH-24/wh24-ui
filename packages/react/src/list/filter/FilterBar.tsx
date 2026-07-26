import { useEffect, useMemo, useRef, useState } from 'react'

import { Icon } from '../Icon.js'
import { SearchModule } from './SearchModule.js'
import { activeCount, isEmptyValue } from './matchItem.js'
import type {
  DateRange,
  FilterBarConfig,
  FilterPreset,
  FilterSettingsProvider,
  FilterState,
} from './types.js'
import { loadPresets, readShareFromUrl } from './storage.js'
import styles from './filter.module.css'

export interface FilterBarProps<T> {
  config: FilterBarConfig<T>
  state: FilterState
  setState: (s: FilterState) => void
  fields: string[]
  setFields: (f: string[]) => void
  /** Может ли пользователь менять набор полей фильтра (админ модуля). */
  canEditFields?: boolean
  /** Источник глобальных настроек (бэкенд модуля). Без него — только локальные пресеты. */
  settings?: FilterSettingsProvider
}

export function FilterBar<T>({
  config,
  state,
  setState,
  fields,
  setFields,
  canEditFields = true,
  settings,
}: FilterBarProps<T>) {
  const [open, setOpen] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  // Явно выбранный пресет (по id) — чтобы при одинаковом state подсвечивался
  // именно кликнутый, а не все совпадающие. Сбрасывается при ручном изменении.
  const [activePresetId, setActivePresetId] = useState<string | null>(null)

  // Глобальные пресеты «для всех» (из бэкенда, видны всем пользователям).
  const [globalPresets, setGlobalPresets] = useState<FilterPreset[]>([])
  const [globalFields, setGlobalFields] = useState<string[]>([])
  // Пресет по умолчанию (pin) — id, применяется на свежей загрузке.
  const [defaultPresetId, setDefaultPresetId] = useState<string>('')

  useEffect(() => {
    if (!settings) return // нет провайдера — работаем только на локальных пресетах
    let active = true
    settings
      .load(config.scope)
      .then((s) => {
        if (!active) return
        const gp = s.presets.map((p) => ({ ...p, global: true }))
        setGlobalPresets(gp)
        setGlobalFields(s.fields)
        setDefaultPresetId(s.defaultPresetId)
        // Пресет по умолчанию (pin) применяется на загрузке страницы ВСЕГДА —
        // он и есть «фильтр по умолчанию». Исключение — фильтр, пришедший ссылкой
        // (?f_<scope>=…): она приоритетнее. Так pin перекрывает остаток в localStorage.
        if (s.defaultPresetId && !readShareFromUrl(config.scope)) {
          const def = [...(config.presets ?? []), ...gp].find((p) => p.id === s.defaultPresetId)
          if (def) {
            setState({ ...def.state })
            setFields(def.fields ?? config.defaultFields ?? [])
            setActivePresetId(def.id)
          }
        }
      })
      .catch(() => {
        /* нет доступа/сети — глобальных пресетов просто не будет */
      })
    return () => {
      active = false
    }
    // Намеренно один раз на scope: применяем дефолт по mount-time state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.scope])

  // Записать текущие глобальные настройки в бэкенд (оптимистично обновляем стейт).
  const pushSettings = (presets: FilterPreset[], defId: string) => {
    if (!settings) return
    void settings
      .save(config.scope, {
        presets: presets.map(({ global: _g, ...p }) => p),
        fields: globalFields,
        defaultPresetId: defId,
      })
      .catch(() => {
        /* откат не делаем — при следующем открытии перечитается с сервера */
      })
  }

  const persistGlobalPresets = (next: FilterPreset[]) => {
    setGlobalPresets(next)
    pushSettings(next, defaultPresetId)
  }

  // pin/unpin пресета по умолчанию (только админ; пишется в глобальные настройки).
  const persistDefaultPreset = (id: string) => {
    setDefaultPresetId(id)
    pushSettings(globalPresets, id)
  }

  // Закрытие по клику вне и по Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const count = activeCount(state)

  // Активный пресет (по id) — чтобы показать в строке его НАЗВАНИЕ вместо чипов условий.
  const activePreset = useMemo(() => {
    if (!activePresetId) return null
    const all = [...(config.presets ?? []), ...globalPresets, ...loadPresets(config.scope)]
    return all.find((p) => p.id === activePresetId) ?? null
  }, [activePresetId, config.presets, config.scope, globalPresets])

  const hasAny = count > 0 || (typeof state.q === 'string' && state.q.length > 0)

  // Применённые ad-hoc условия (не пресет) → чипы в строке: «Поле: значение».
  // Клик по × сбрасывает условие конкретного поля.
  const conditionChips = useMemo(() => {
    const out: { key: string; text: string }[] = []
    for (const field of config.fields) {
      const v = state[field.key]
      if (v === undefined || isEmptyValue(v)) continue
      const labelOf = (val: string) => field.options?.find((o) => o.value === val)?.label ?? val
      let text = ''
      if (field.type === 'multiselect' && Array.isArray(v)) text = v.map(labelOf).join(', ')
      else if (field.type === 'select' && typeof v === 'string') text = labelOf(v)
      else if (field.type === 'text' && typeof v === 'string') text = v
      else if (field.type === 'boolean') text = v ? 'Да' : 'Нет'
      else if (field.type === 'daterange') {
        const r = v as DateRange
        text = [r.from, r.to].filter(Boolean).join(' – ')
      }
      out.push({ key: field.key, text: `${field.label}: ${text}` })
    }
    return out
  }, [config.fields, state])

  const clearField = (key: string) => {
    const next = { ...state }
    delete next[key]
    setState(next)
    setActivePresetId(null)
  }

  return (
    <div className={styles.filterBar} ref={barRef}>
      {/* Единый контрол «Фильтр и поиск» (Bitrix24): название активного пресета +
          поле ввода + лупа + сброс (справа). Клик по полю раскрывает модуль поиска. */}
      <div
        className={styles.filterSearch}
        data-active={String(open || count > 0)}
        onMouseDown={() => setOpen(true)}
      >
        {/* Активный пресет → его название; иначе — чипы применённых условий полей. */}
        {activePreset ? (
          <span className={[styles.filterApplied, styles.filterAppliedPreset].join(' ')}>
            <span className={styles.filterAppliedLabel}>{activePreset.name}</span>
            <span
              className={styles.chipX}
              role="button"
              aria-label={`Сбросить фильтр «${activePreset.name}»`}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                setState({})
                setFields([])
                setActivePresetId(null)
              }}
            >
              <Icon name="close" size={12} />
            </span>
          </span>
        ) : (
          conditionChips.map((chip) => (
            <span key={chip.key} className={styles.filterApplied}>
              <span className={styles.filterAppliedLabel}>{chip.text}</span>
              <span
                className={styles.chipX}
                role="button"
                aria-label={`Сбросить условие «${chip.text}»`}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  clearField(chip.key)
                }}
              >
                <Icon name="close" size={12} />
              </span>
            </span>
          ))
        )}

        <input
          className={styles.filterSearchInput}
          placeholder={config.search?.placeholder ?? 'Фильтр и поиск'}
          value={typeof state.q === 'string' ? state.q : ''}
          spellCheck={false}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setState({ ...state, q: e.target.value })
            setActivePresetId(null)
          }}
        />

        <span className={styles.filterSearchIcon}>
          <Icon name="search" size={15} />
        </span>

        {hasAny && (
          <button
            type="button"
            className={styles.filterSearchClear}
            aria-label="Сбросить фильтр"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              setState({})
              setFields([])
              setActivePresetId(null)
            }}
          >
            <Icon name="close" size={14} />
          </button>
        )}
      </div>

      {open && (
        <SearchModule
          config={config}
          state={state}
          setState={setState}
          fields={fields}
          setFields={setFields}
          canEditFields={canEditFields}
          globalPresets={globalPresets}
          // Без провайдера настроек общих пресетов не существует: не отдаём
          // колбэки вовсе, чтобы окно не показывало «Для всех» и булавку —
          // раньше они рисовались, срабатывали в пределах сессии и молча
          // терялись при перезагрузке.
          onGlobalPresetsChange={settings ? persistGlobalPresets : undefined}
          defaultPresetId={defaultPresetId}
          onSetDefaultPreset={settings ? persistDefaultPreset : undefined}
          activePresetId={activePresetId}
          setActivePresetId={setActivePresetId}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

export default FilterBar
