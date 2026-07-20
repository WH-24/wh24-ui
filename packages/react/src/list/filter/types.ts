import type { ComboboxOption } from '../Combobox.js'

/**
 * Универсальный фильтр в стиле Bitrix24. Поля декларативны (FilterFieldDef),
 * фильтрация — универсальна (matchItem), персист — по scope в localStorage.
 * Компонент generic по типу строки данных T (Staff, Contractor, …).
 */

export type FieldType = 'text' | 'select' | 'multiselect' | 'daterange' | 'boolean'

/** Диапазон дат (ISO yyyy-mm-dd, любая граница может быть пустой). */
export interface DateRange {
  from: string
  to: string
}

/** Значение одного поля фильтра. null/""/[] — поле не задано. */
export type FilterValue = string | string[] | DateRange | boolean | null

/** Состояние фильтра: ключ поля → значение. Ключ `q` зарезервирован под поиск. */
export type FilterState = Record<string, FilterValue>

export interface FilterFieldDef<T> {
  /** Стабильный ключ (совпадает с ключом в FilterState). */
  key: string
  label: string
  type: FieldType
  /** Варианты для select/multiselect. */
  options?: ComboboxOption[]
  placeholder?: string
  /** Необязательное поле: скрыто, пока не добавлено через «Добавить поле». */
  optional?: boolean
  /**
   * Аксессор для matchItem: что у строки сравнивать с выбранным значением.
   * text/select → string | null; multiselect → значение (или массив значений);
   * daterange → ISO-дата | null; boolean → boolean.
   */
  get: (item: T) => string | string[] | number | boolean | null | undefined
}

/** Именованный пресет: системный (встроенный) или пользовательский. */
export interface FilterPreset {
  id: string
  name: string
  state: FilterState
  /** Какие необязательные поля видимы при применении пресета. */
  fields?: string[]
  /** Системный пресет: нельзя удалить/переименовать. */
  system?: boolean
  /** Глобальный пресет «для всех» (хранится в бэкенде, виден всем пользователям). */
  global?: boolean
}

export interface FilterSearchDef<T> {
  placeholder?: string
  /** Строка, по которой ищет свободный текст (через includes, lowercased). */
  get: (item: T) => string
}

export interface FilterBarConfig<T> {
  /** Пространство имён в localStorage и URL (например `employees`). */
  scope: string
  search?: FilterSearchDef<T>
  fields: FilterFieldDef<T>[]
  /** Системные пресеты (всегда первыми, неудаляемые). */
  presets?: FilterPreset[]
  /** Поля, видимые по умолчанию (и для «Вернуть поля по умолчанию»). */
  defaultFields?: string[]
  /** Стартовый фильтр, когда ни URL, ни localStorage ничего не дали. */
  defaultState?: { state: FilterState; fields?: string[] }
}

/**
 * Глобальные настройки фильтра одного scope (пресеты «для всех», доступные поля,
 * пресет по умолчанию). Хранятся в бэкенде модуля — форма не зависит от модуля.
 */
export interface FilterSettings {
  presets: FilterPreset[]
  fields: string[]
  /**
   * Ключи колонок, скрытых «для всех». Применяются пользователю, у которого нет
   * своей настройки колонок. Сохраняется админом модуля из окна настройки.
   */
  columns?: string[]
  /** Id пресета по умолчанию (pin). Пусто = нет. */
  defaultPresetId: string
}

/**
 * Провайдер глобальных настроек — его реализует конкретный модуль под свой
 * бэкенд/базу и передаёт в `FilterBar` пропом `settings`. Без провайдера фильтр
 * работает только на локальных (localStorage) пресетах. Это и делает компонент
 * переносимым: ни URL, ни бэкенд внутри компонента не зашиты.
 */
export interface FilterSettingsProvider {
  load: (scope: string) => Promise<FilterSettings>
  save: (scope: string, settings: FilterSettings) => Promise<FilterSettings>
}

/** Зарезервированный ключ свободного поиска внутри FilterState. */
export const SEARCH_KEY = 'q'
