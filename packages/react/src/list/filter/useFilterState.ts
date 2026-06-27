import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { FilterBarConfig, FilterState } from './types.js'
import { loadState, readShareFromUrl, saveState, type StoredFilter } from './storage.js'

/**
 * Владелец состояния фильтра для страницы. Гидратация при маунте:
 * URL-шеринг (?f_<scope>=…) → localStorage → пусто. Любое изменение
 * сохраняется в localStorage (то самое «сохранять выбор»).
 */
export function useFilterState<T>(config: FilterBarConfig<T>) {
  const { scope } = config

  const initial = useMemo<StoredFilter>(() => {
    const fallback: StoredFilter = config.defaultState
      ? { state: config.defaultState.state, fields: config.defaultState.fields ?? [] }
      : { state: {}, fields: [] }
    const resolved = readShareFromUrl(scope) ?? loadState(scope) ?? fallback
    // Пустой набор полей (свежий пользователь / старый формат) → поля по умолчанию.
    if (!resolved.fields?.length && config.defaultFields?.length) {
      resolved.fields = config.defaultFields
    }
    return resolved
    // scope стабилен на время жизни страницы.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope])

  const [state, setState] = useState<FilterState>(initial.state)
  const [fields, setFields] = useState<string[]>(initial.fields)

  // Персист — после первого рендера (маунт уже гидратирован из initial).
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    saveState(scope, { state, fields })
  }, [scope, state, fields])

  const reset = useCallback(() => {
    setState({})
    setFields([])
  }, [])

  return { state, setState, fields, setFields, reset }
}
