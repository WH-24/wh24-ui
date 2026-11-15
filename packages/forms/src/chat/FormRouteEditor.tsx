/**
 * FormRouteEditor — маршрут согласования формы в редакторе формы (вкладка
 * «Маршрут»): те же этапы и та же правка, что «Настроить» в ленте записи
 * (`RouteBar`), но без записи — состояния этапов и решений здесь нет.
 * «Инициализации» в списке нет: она есть у каждой записи сама.
 */
import { useCallback, useEffect, useState } from 'react'

import type { FormsApi } from '../api.js'
import { FormsApiError } from '../api.js'
import type { FormRouteStep, OrgOption, RecordRoute } from '../types.js'
import { RouteBar } from './RouteBar.js'
import styles from './chat.module.css'

export interface FormRouteEditorProps {
  api: FormsApi
  formId: string
  /** Справочник сотрудников: имена согласующих и выбор. */
  staff: OrgOption[]
  /** Может менять маршрут (роль «Управление» в модуле формы). */
  canManage: boolean
  /** Маршрут загружен или сохранён — хосту (сводка «Согласующие» и т.п.). */
  onSteps?: (steps: FormRouteStep[]) => void
  onError?: (message: string) => void
}

type Load = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; steps: FormRouteStep[] }

export function FormRouteEditor({ api, formId, staff, canManage, onSteps, onError }: FormRouteEditorProps) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const reload = useCallback(async () => {
    try {
      const steps = await api.route.get(formId)
      setLoad({ kind: 'ready', steps })
      onSteps?.(steps)
    } catch (e) {
      setLoad({
        kind: 'error',
        message: e instanceof FormsApiError ? e.message : 'Не удалось загрузить маршрут',
      })
    }
    // onSteps хост может пересоздавать каждый рендер — в зависимости не входит.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, formId])
  useEffect(() => {
    setLoad({ kind: 'loading' })
    void reload()
  }, [reload])

  if (load.kind === 'loading') return <div className={styles.muted}>Загружаем маршрут…</div>
  if (load.kind === 'error')
    return (
      <div className={styles.error} role="alert">
        {load.message}{' '}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void reload()}>
          Повторить
        </button>
      </div>
    )
  const route: RecordRoute = {
    steps: load.steps.map((s) => ({
      id: s.id,
      name: s.name,
      state: 'pending',
      approvers: s.approvers.map((id) => ({ staff_id: id, choice: '', decided_at: null, mine: false })),
    })),
    current_step_id: null,
    finished: false,
  }
  return (
    <RouteBar
      api={api}
      formId={formId}
      route={route}
      staff={staff}
      canManage={canManage}
      onSaved={() => void reload()}
      onError={onError}
      plain
    />
  )
}
