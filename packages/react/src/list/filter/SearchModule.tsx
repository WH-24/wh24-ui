import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { Icon } from '../Icon.js'
import { FieldEditor } from './FieldEditor.js'
import { activeCount, isEmptyValue } from './matchItem.js'
import { loadPresets, savePresets, type StoredFilter } from './storage.js'
import type {
  FilterBarConfig,
  FilterFieldDef,
  FilterPreset,
  FilterState,
  FilterValue,
} from './types.js'
import styles from './filter.module.css'

/** Объединить classNames (отбрасывает falsy). */
const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ')

interface SearchModuleProps<T> {
  config: FilterBarConfig<T>
  state: FilterState
  setState: (s: FilterState) => void
  fields: string[]
  setFields: (f: string[]) => void
  /** Админ модуля: может менять набор полей и управлять глобальными пресетами. */
  canEditFields?: boolean
  /** Глобальные пресеты «для всех» (из бэкенда). */
  globalPresets?: FilterPreset[]
  /** Сохранить изменённый список глобальных пресетов в бэкенд. */
  onGlobalPresetsChange?: (presets: FilterPreset[]) => void
  /** Явно выбранный пресет (id) — подсветка именно его при одинаковом state. */
  activePresetId?: string | null
  setActivePresetId?: (id: string | null) => void
  /** Id пресета по умолчанию (pin) и его переключение (только админ). */
  defaultPresetId?: string
  onSetDefaultPreset?: (id: string) => void
  onClose: () => void
}

/** Сравнение текущего фильтра с пресетом (для подсветки активного). */
function sameFilter(a: StoredFilter, b: StoredFilter): boolean {
  const clean = (s: FilterState) =>
    JSON.stringify(
      Object.fromEntries(Object.entries(s).filter(([, v]) => !isEmptyValue(v as FilterValue))),
    )
  return clean(a.state) === clean(b.state)
}

/**
 * Модуль поиска — всплывающая панель (Bitrix24-style), открывается по клику
 * на поле поиска в строке FilterBar. Слева — пресеты (глобальные «для всех» +
 * личные) с режимом редактирования (✎/✕/pin) и сохранением фильтра; справа —
 * поля фильтра с «Добавить поле», drag-реордером и действиями Найти / Сбросить.
 */
export function SearchModule<T>({
  config,
  state,
  setState,
  fields,
  setFields,
  canEditFields = true,
  globalPresets = [],
  onGlobalPresetsChange,
  activePresetId = null,
  setActivePresetId,
  defaultPresetId = '',
  onSetDefaultPreset,
  onClose,
}: SearchModuleProps<T>) {
  const [userPresets, setUserPresets] = useState<FilterPreset[]>(() => loadPresets(config.scope))
  const [saving, setSaving] = useState(false)
  const [saveForAll, setSaveForAll] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  // Режим редактирования пресетов (включается шестерёнкой у «Сохранить фильтр»).
  const [editMode, setEditMode] = useState(false)
  // Какой пресет редактируется в режиме шестерёнки (по нему «Сохранить» пишет
  // текущие значения полей). Не сбрасывается при изменении значений (в отличие
  // от activePresetId), иначе нечего было бы сохранять.
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const dragKey = useRef<string | null>(null)
  const addGridRef = useRef<HTMLDivElement>(null)
  const addBtnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  // Поповер шире фильтр-бара (760px), и на узком окне он вылезал за правый край:
  // left: 0 отсчитывается от бара, а бар смещён вправо сайдбаром — offset в CSS
  // не известен, max-width во vw этого не лечит. Держим поповер в границах
  // контейнера бара (не окна: за краем окна начинается сайдбар, под который
  // поповер уезжал бы точно так же) — сначала сужаем, потом сдвигаем влево.
  useLayoutEffect(() => {
    const el = popRef.current
    if (!el) return
    const GAP = 12
    const MIN_WIDTH = 560 // уже — ломается сетка «пресеты + поля»
    const fit = () => {
      // Границы — первый предок бара, который шире его самого (у потребителя это
      // тулбар списка). offsetParent тут не годится: позиционированных предков в
      // разметке может не быть вовсе, и он вернёт <body> со шириной окна.
      const bar = el.parentElement
      const barWidth = bar?.getBoundingClientRect().width ?? 0
      let host = bar?.parentElement ?? null
      for (let i = 0; host && i < 6; i++) {
        if (host.getBoundingClientRect().width > barWidth) break
        host = host.parentElement
      }
      const b = host?.getBoundingClientRect()
      const left = b && b.width > 0 ? b.left : 0
      const right = b && b.width > 0 ? b.right : window.innerWidth

      el.style.left = '0px'
      el.style.maxWidth = `${Math.max(MIN_WIDTH, right - left - GAP * 2)}px`
      const r = el.getBoundingClientRect()
      const over = r.right - (right - GAP)
      if (over > 0) el.style.left = `${-Math.min(over, Math.max(r.left - (left + GAP), 0))}px`
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  // Закрытие сетки «Добавить поле» по клику вне неё. Capture-фаза — потому что
  // .filterPop делает stopPropagation на mousedown (обычный листенер не сработал бы).
  useEffect(() => {
    if (!addOpen) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (addGridRef.current?.contains(t) || addBtnRef.current?.contains(t)) return
      setAddOpen(false)
    }
    document.addEventListener('mousedown', onDown, true)
    return () => document.removeEventListener('mousedown', onDown, true)
  }, [addOpen])

  const allPresets = useMemo<FilterPreset[]>(
    () => [...(config.presets ?? []), ...globalPresets, ...userPresets],
    [config.presets, globalPresets, userPresets],
  )

  // Видимый набор полей задаётся списком `fields` (чекбоксы «Добавить поле»).
  const fieldByKey = useMemo(() => {
    const m = new Map<string, FilterFieldDef<T>>()
    config.fields.forEach((f) => m.set(f.key, f))
    return m
  }, [config.fields])

  const visibleFields = useMemo<FilterFieldDef<T>[]>(
    () => fields.map((k) => fieldByKey.get(k)).filter(Boolean) as FilterFieldDef<T>[],
    [fields, fieldByKey],
  )

  // Хранилище личных пресетов: стейт + localStorage одним вызовом.
  const writeUserPresets = (next: FilterPreset[]) => {
    setUserPresets(next)
    savePresets(config.scope, next)
  }

  // Изменить пресет по id, автоматически выбирая хранилище (глобальное/личное).
  const mutatePreset = (id: string, fn: (p: FilterPreset) => FilterPreset) => {
    if (globalPresets.some((p) => p.id === id)) {
      onGlobalPresetsChange?.(globalPresets.map((p) => (p.id === id ? fn(p) : p)))
    } else {
      writeUserPresets(userPresets.map((p) => (p.id === id ? fn(p) : p)))
    }
  }

  const setValue = (key: string, v: FilterValue) => {
    setState({ ...state, [key]: v })
    setActivePresetId?.(null) // ручное изменение значения снимает выбор пресета
  }

  const applyPreset = (p: FilterPreset) => {
    setState({ ...p.state })
    setFields(p.fields ?? config.defaultFields ?? [])
    setActivePresetId?.(p.id) // подсвечиваем именно выбранный
    if (editMode) {
      setEditingPresetId(p.id) // в режиме шестерёнки — цель сохранения
      setSaveForAll(!!p.global) // галочка «Для всех» отражает область пресета
    }
  }

  // Сохранить редактируемый пресет (режим шестерёнки): пишем текущие значения и
  // учитываем галочку «Для всех» — при смене области переносим между хранилищами.
  const saveEditedPreset = (id: string) => {
    const preset = allPresets.find((p) => p.id === id)
    if (!preset || preset.system) return
    const forAll = saveForAll && canEditFields && !!onGlobalPresetsChange
    const next: FilterPreset = {
      ...preset,
      state: { ...state },
      fields: [...fields],
      global: forAll,
    }
    if (forAll === !!preset.global) {
      // Область не меняется — обновляем на месте (id сохраняется).
      mutatePreset(id, () => next)
    } else if (forAll) {
      // Личный → «для всех»: переносим в глобальные настройки.
      writeUserPresets(userPresets.filter((p) => p.id !== id))
      onGlobalPresetsChange!([...globalPresets.filter((p) => p.id !== id), next])
    } else {
      // «Для всех» → личный: возвращаем в localStorage.
      onGlobalPresetsChange!(globalPresets.filter((p) => p.id !== id))
      writeUserPresets([...userPresets.filter((p) => p.id !== id), next])
    }
  }

  // Первый пресет, совпадающий по содержимому (fallback, когда явного выбора нет).
  // Берём ОДИН — иначе при одинаковом state подсвечивались бы несколько.
  const firstMatchId = useMemo(() => {
    const m = allPresets.find((p) =>
      sameFilter({ state, fields }, { state: p.state, fields: p.fields ?? [] }),
    )
    return m?.id ?? null
  }, [allPresets, state, fields])

  const isActivePreset = (p: FilterPreset) => {
    // В режиме редактирования держим подсветку на редактируемом пресете,
    // даже когда значения уже изменены (activePresetId к этому моменту сброшен).
    if (editMode && editingPresetId) return p.id === editingPresetId
    return activePresetId != null ? p.id === activePresetId : p.id === firstMatchId
  }

  const removeField = (key: string) => {
    setFields(fields.filter((k) => k !== key))
    setActivePresetId?.(null)
    if (key in state) {
      const next = { ...state }
      delete next[key]
      setState(next)
    }
  }

  // Чекбокс в «Добавить поле»: вкл — показать поле, выкл — скрыть (и очистить).
  const toggleField = (key: string) => {
    if (fields.includes(key)) {
      removeField(key)
    } else {
      setFields([...fields, key])
      setActivePresetId?.(null)
    }
  }

  const resetFields = () => setFields(config.defaultFields ?? [])

  const reorder = (from: string, to: string) => {
    if (from === to) return
    const next = [...fields]
    const fi = next.indexOf(from)
    const ti = next.indexOf(to)
    if (fi < 0 || ti < 0) return
    const [moved] = next.splice(fi, 1)
    if (moved !== undefined) next.splice(ti, 0, moved)
    setFields(next)
  }

  const saveCurrentPreset = () => {
    const name = presetName.trim()
    if (!name) return
    const forAll = saveForAll && canEditFields && !!onGlobalPresetsChange
    const prefix = forAll ? 'g' : 'u'
    const id = `${prefix}_${name.toLowerCase().replace(/\s+/g, '_')}_${fields.join('-')}`
    const preset: FilterPreset = { id, name, state: { ...state }, fields: [...fields] }
    if (forAll) {
      // «для всех» — пишем в глобальные настройки (видят все пользователи).
      onGlobalPresetsChange!([
        ...globalPresets.filter((p) => p.id !== id),
        { ...preset, global: true },
      ])
    } else {
      writeUserPresets([...userPresets.filter((p) => p.id !== id), preset])
    }
    setActivePresetId?.(id) // подсветить только что сохранённый
    setSaving(false)
    setPresetName('')
    setSaveForAll(false)
  }

  // Удаление/переименование: глобальные пресеты → бэкенд, личные → localStorage.
  const deletePreset = (p: FilterPreset) => {
    if (p.global) onGlobalPresetsChange?.(globalPresets.filter((g) => g.id !== p.id))
    else writeUserPresets(userPresets.filter((u) => u.id !== p.id))
  }

  const startRename = (p: FilterPreset) => {
    setRenamingId(p.id)
    setRenameValue(p.name)
  }

  const commitRename = (id: string) => {
    const name = renameValue.trim()
    if (name) mutatePreset(id, (p) => ({ ...p, name }))
    setRenamingId(null)
  }

  const count = activeCount(state)

  // Набор полей отличается от дефолтного (пользователь добавил/убрал поля).
  const fieldsCustomized = useMemo(() => {
    const def = [...(config.defaultFields ?? [])].sort().join(',')
    return [...fields].sort().join(',') !== def
  }, [fields, config.defaultFields])

  // Сохранять пресет можно, если есть активные значения ИЛИ изменён набор полей —
  // пресет хранит и поля, и их значения на момент сохранения.
  const canSave = count > 0 || fieldsCustomized

  return (
    <div ref={popRef} className={styles.filterPop} onMouseDown={(e) => e.stopPropagation()}>
      {/* Левая колонка — пресеты. */}
      <div className={styles.filterPresets}>
        <div className={styles.filterPresetsTitle}>
          <span>Фильтры</span>
          {/* Шестерёнка прячется в режиме редактирования (выход — «Сохранить/Отмена»). */}
          {!editMode && (
            <button
              type="button"
              className={styles.filterGear}
              aria-label="Режим редактирования фильтров"
              title="Режим редактирования"
              onClick={() => {
                setEditMode(true)
                setRenamingId(null)
                setEditingPresetId(activePresetId) // текущий пресет — цель правки
                // Галочка «Для всех» отражает область текущего пресета.
                setSaveForAll(!!allPresets.find((p) => p.id === activePresetId)?.global)
              }}
            >
              <Icon name="settings" size={15} />
            </button>
          )}
        </div>
        {allPresets.map((p) => {
          // Системные — не редактируются; глобальные — только админ модуля.
          const editable = editMode && !p.system && (!p.global || canEditFields)
          return (
            <div
              key={p.id}
              className={styles.filterPreset}
              data-active={String(isActivePreset(p))}
            >
              {renamingId === p.id ? (
                <input
                  className={cx(styles.formInput, styles.filterPresetRename)}
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(p.id)
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                  onBlur={() => commitRename(p.id)}
                />
              ) : (
                <button
                  type="button"
                  className={styles.filterPresetName}
                  onClick={() => applyPreset(p)}
                >
                  {p.name}
                </button>
              )}
              {/* Индикатор «по умолчанию» (read-only) вне режима редактирования. */}
              {!editMode && defaultPresetId === p.id && (
                <span
                  className={styles.filterPresetDefault}
                  title="Фильтр по умолчанию"
                  aria-label="Фильтр по умолчанию"
                >
                  <Icon name="pin" size={12} />
                </span>
              )}
              {editMode && renamingId !== p.id && (editable || canEditFields) && (
                <span className={styles.filterPresetActions}>
                  {editable && (
                    <>
                      <span role="button" aria-label="Переименовать" onClick={() => startRename(p)}>
                        <Icon name="pen" size={13} />
                      </span>
                      <span
                        role="button"
                        aria-label="Удалить пресет"
                        onClick={() => deletePreset(p)}
                      >
                        <Icon name="close" size={13} />
                      </span>
                    </>
                  )}
                  {/* pin — сделать пресет фильтром по умолчанию (любой пресет, только админ). */}
                  {canEditFields && (
                    <span
                      role="button"
                      className={styles.filterPresetPin}
                      data-pinned={String(defaultPresetId === p.id)}
                      aria-label={
                        defaultPresetId === p.id ? 'Убрать по умолчанию' : 'Сделать по умолчанию'
                      }
                      title={
                        defaultPresetId === p.id ? 'Убрать по умолчанию' : 'Сделать по умолчанию'
                      }
                      onClick={() => onSetDefaultPreset?.(defaultPresetId === p.id ? '' : p.id)}
                    >
                      <Icon name="pin" size={13} />
                    </span>
                  )}
                </span>
              )}
            </div>
          )
        })}

        {/* При сохранении — поле названия появляется СЛЕДУЮЩИМ в списке (как новый пресет). */}
        {saving && (
          <div className={cx(styles.filterPreset, styles.filterPresetSaving)}>
            <input
              className={styles.filterPresetNameInput}
              autoFocus
              placeholder="Название фильтра"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveCurrentPreset()
                if (e.key === 'Escape') {
                  setSaving(false)
                  setPresetName('')
                  setSaveForAll(false)
                }
              }}
            />
          </div>
        )}

        <div style={{ flex: 1 }} />
        {/* В режиме редактирования выход — кнопки «Сохранить/Отмена» в правом футере. */}
        {!editMode && !saving && (
          <div className={styles.filterPresetsFoot}>
            <button
              type="button"
              className={cx(styles.filterPreset, styles.filterPresetSave)}
              disabled={!canSave}
              onClick={() => setSaving(true)}
              style={!canSave ? { opacity: 0.5 } : undefined}
            >
              <Icon name="save" size={13} />
              <span className={styles.filterPresetName}>Сохранить фильтр</span>
            </button>
          </div>
        )}
      </div>

      {/* Правая колонка — поля. Свободный поиск живёт в строке FilterBar
          (она же открывает модуль), поэтому здесь поле поиска не дублируем. */}
      <div className={styles.filterBody}>
        <div className={styles.filterFields}>
          {visibleFields.map((f) => (
            <div
              key={f.key}
              className={styles.filterField}
              data-dragging={String(dragKey.current === f.key)}
              draggable={canEditFields}
              onDragStart={canEditFields ? () => (dragKey.current = f.key) : undefined}
              onDragOver={canEditFields ? (e) => e.preventDefault() : undefined}
              onDrop={
                canEditFields
                  ? () => {
                      if (dragKey.current) reorder(dragKey.current, f.key)
                      dragKey.current = null
                    }
                  : undefined
              }
            >
              <span className={styles.filterFieldLabel}>
                {canEditFields && <span className={styles.filterFieldGrip}>⋮⋮</span>}
                {f.label}
              </span>
              <FieldEditor
                type={f.type}
                value={state[f.key] ?? null}
                onChange={(v) => setValue(f.key, v)}
                options={f.options}
                placeholder={f.placeholder}
              />
              {canEditFields && (
                <button
                  type="button"
                  className={styles.filterFieldRemove}
                  aria-label="Убрать поле"
                  onClick={() => removeField(f.key)}
                >
                  <Icon name="close" size={13} />
                </button>
              )}
            </div>
          ))}

          {visibleFields.length === 0 && (
            <div className={styles.filterFieldsEmpty}>
              Поля не выбраны — добавьте через «Добавить поле».
            </div>
          )}

          {/* Управление набором полей (как в Bitrix, снизу): добавить / вернуть по умолчанию.
              Доступно только администратору модуля. */}
          {canEditFields && (
            <div className={styles.filterFieldsActions}>
              <button
                ref={addBtnRef}
                type="button"
                className={styles.filterAddfield}
                data-active={String(addOpen)}
                onClick={() => setAddOpen((v) => !v)}
              >
                <Icon name="plus" size={13} />
                Добавить поле
              </button>
              <button type="button" className={styles.filterResetfields} onClick={resetFields}>
                Вернуть поля по умолчанию
              </button>
            </div>
          )}
        </div>

        {/* Сетка всех полей модели: отметка = поле показано в фильтре. */}
        {addOpen && (
          <div className={styles.filterAddgrid} ref={addGridRef}>
            {config.fields.map((f) => {
              const on = fields.includes(f.key)
              return (
                <button
                  key={f.key}
                  type="button"
                  className={styles.filterAddgridItem}
                  onClick={() => toggleField(f.key)}
                  // На узком окне колонка сжимается и длинное название режется
                  // многоточием — подсказка возвращает его целиком.
                  title={f.label}
                >
                  <span className={styles.filterMsCheck} data-on={String(on)}>
                    {on && <Icon name="check" size={12} />}
                  </span>
                  <span className={styles.filterAddgridLabel}>{f.label}</span>
                </button>
              )
            })}
          </div>
        )}

        <div className={styles.filterFoot}>
          {saving ? (
            <>
              {/* «Для всех» — пресет уйдёт в глобальные настройки (видят все). Только админ. */}
              {canEditFields && (
                <label className={styles.filterSaveall}>
                  <input
                    type="checkbox"
                    checked={saveForAll}
                    onChange={(e) => setSaveForAll(e.target.checked)}
                  />
                  <span>Для всех</span>
                </label>
              )}
              <button
                className={cx(styles.btn, styles.btnPrimary, styles.btnSm)}
                disabled={!presetName.trim()}
                onClick={saveCurrentPreset}
              >
                <Icon name="save" size={14} />
                Сохранить
              </button>
              <button
                className={cx(styles.btn, styles.btnGhost, styles.btnSm)}
                onClick={() => {
                  setSaving(false)
                  setPresetName('')
                }}
              >
                Отменить
              </button>
            </>
          ) : editMode ? (
            // Режим редактирования: «Сохранить» пишет текущие значения в пресет.
            <>
              {/* «Для всех» — область редактируемого пресета (личный ↔ глобальный). */}
              {canEditFields && !!onGlobalPresetsChange && (
                <label className={styles.filterSaveall}>
                  <input
                    type="checkbox"
                    checked={saveForAll}
                    onChange={(e) => setSaveForAll(e.target.checked)}
                  />
                  <span>Для всех</span>
                </label>
              )}
              <button
                className={cx(styles.btn, styles.btnPrimary, styles.btnSm)}
                onClick={() => {
                  if (editingPresetId) saveEditedPreset(editingPresetId)
                  setEditMode(false)
                  setRenamingId(null)
                  setEditingPresetId(null)
                  setSaveForAll(false)
                }}
              >
                <Icon name="save" size={14} />
                Сохранить
              </button>
              <button
                className={cx(styles.btn, styles.btnGhost, styles.btnSm)}
                onClick={() => {
                  setEditMode(false)
                  setRenamingId(null)
                  setEditingPresetId(null)
                  setSaveForAll(false)
                }}
              >
                Отмена
              </button>
            </>
          ) : (
            <>
              <button className={cx(styles.btn, styles.btnPrimary, styles.btnSm)} onClick={onClose}>
                <Icon name="search" size={14} />
                Найти
              </button>
              <button
                className={cx(styles.btn, styles.btnGhost, styles.btnSm, styles.filterFootReset)}
                onClick={() => {
                  setState({})
                  setFields([])
                  setActivePresetId?.(null)
                }}
              >
                Сбросить
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default SearchModule
