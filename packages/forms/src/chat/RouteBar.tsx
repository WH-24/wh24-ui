/**
 * Маршрут записи над лентой: этапы по порядку, согласующие и их решения.
 * Администратор формы настраивает этапы здесь же («Настроить»): правка в
 * рабочем интерфейсе, а не на отдельной странице настроек.
 */
import { useState } from 'react'
import { Icon, Input, MultiCombobox } from '@wowhaus-24/ui-react'

import type { FormsApi } from '../api.js'
import { FormsApiError } from '../api.js'
import type { OrgOption, RecordRoute } from '../types.js'
import { CHOICE_LABEL, STEP_STATE_LABEL, staffIndex } from './logic.js'
import styles from './chat.module.css'

interface EditStep {
  key: string
  id?: string
  name: string
  approvers: string[]
}

let seq = 0
const nextKey = () => `n${++seq}`

export function RouteBar({
  api,
  formId,
  route,
  staff,
  canManage,
  onSaved,
  onError,
}: {
  api: FormsApi
  formId: string
  route: RecordRoute
  staff: OrgOption[]
  canManage: boolean
  onSaved: () => void
  onError?: (message: string) => void
}) {
  const [edit, setEdit] = useState<EditStep[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const people = staffIndex(staff)
  const options = staff.map((s) => ({ value: s.id, label: s.label, hint: s.hint }))

  const start = () => {
    setError(null)
    setEdit(
      route.steps.map((s) => ({ key: s.id, id: s.id, name: s.name, approvers: s.approvers.map((a) => a.staff_id) })),
    )
  }

  const save = async () => {
    if (!edit) return
    const bad = edit.find((s) => !s.name.trim() || s.approvers.length === 0)
    if (bad) {
      setError('У каждого этапа должны быть название и хотя бы один согласующий')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await api.route.put(
        formId,
        edit.map((s) => ({ id: s.id, name: s.name.trim(), approvers: s.approvers })),
      )
      setEdit(null)
      onSaved()
    } catch (e) {
      const msg = e instanceof FormsApiError ? e.message : 'Не удалось сохранить маршрут'
      setError(msg)
      onError?.(msg)
    } finally {
      setSaving(false)
    }
  }

  if (edit) {
    const patch = (key: string, p: Partial<EditStep>) =>
      setEdit((list) => list?.map((s) => (s.key === key ? { ...s, ...p } : s)) ?? null)
    const move = (i: number, d: -1 | 1) =>
      setEdit((list) => {
        if (!list) return list
        const next = [...list]
        const [it] = next.splice(i, 1)
        if (it) next.splice(i + d, 0, it)
        return next
      })
    return (
      <div className={styles.route} aria-label="Настройка маршрута">
        <div className={styles.routeHead}>
          <b>Маршрут согласования</b>
          <span className={styles.muted}>Этап пройден, когда его утвердили все согласующие</span>
        </div>
        <ol className={styles.routeEdit}>
          {edit.map((s, i) => (
            <li key={s.key} className={styles.routeEditRow}>
              <span className={styles.stepNo}>{i + 1}</span>
              <Input
                aria-label={`Название этапа ${i + 1}`}
                value={s.name}
                placeholder="Название этапа"
                onChange={(e) => patch(s.key, { name: e.target.value })}
              />
              <MultiCombobox
                ariaLabel={`Согласующие этапа ${i + 1}`}
                options={options}
                values={s.approvers}
                onChange={(v) => patch(s.key, { approvers: v })}
                placeholder="Согласующие"
              />
              <span className={styles.rowBtns}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  aria-label="Выше"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  aria-label="Ниже"
                  disabled={i === edit.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  aria-label={`Удалить этап ${i + 1}`}
                  onClick={() => setEdit((list) => list?.filter((x) => x.key !== s.key) ?? null)}
                >
                  <Icon name="trash" size={14} />
                </button>
              </span>
            </li>
          ))}
        </ol>
        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}
        <div className={styles.routeActions}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setEdit((list) => [...(list ?? []), { key: nextKey(), name: '', approvers: [] }])}
          >
            <Icon name="plus" size={14} /> Этап
          </button>
          <span className={styles.grow} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit(null)} disabled={saving}>
            Отмена
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void save()} disabled={saving}>
            {saving ? 'Сохраняем…' : 'Готово'}
          </button>
        </div>
      </div>
    )
  }

  if (route.steps.length === 0) {
    return canManage ? (
      <div className={styles.routeEmpty}>
        <span className={styles.muted}>Маршрута согласования нет</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={start}>
          <Icon name="settings" size={14} /> Настроить маршрут
        </button>
      </div>
    ) : null
  }

  return (
    <div className={styles.route} aria-label="Маршрут согласования">
      <ol className={styles.steps}>
        {route.steps.map((s) => (
          <li key={s.id} className={[styles.step, styles[`st_${s.state}`]].join(' ')}>
            <div className={styles.stepName}>
              {s.state === 'passed' && <Icon name="check" size={13} />}
              {s.name}
              <span className={styles.stepState}>{STEP_STATE_LABEL[s.state]}</span>
            </div>
            <div className={styles.approvers}>
              {s.approvers.map((a) => (
                <span
                  key={a.staff_id}
                  className={[styles.approver, a.choice ? styles[`ch_${a.choice}`] : ''].join(' ')}
                  title={a.choice ? CHOICE_LABEL[a.choice] : 'Ещё не решал(а)'}
                >
                  {people.name(a.staff_id)}
                  {a.choice && ` · ${CHOICE_LABEL[a.choice]}`}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <div className={styles.routeFoot}>
        {route.finished && <span className={styles.finished}>Согласование завершено</span>}
        {canManage && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={start}>
            <Icon name="settings" size={14} /> Настроить
          </button>
        )}
      </div>
    </div>
  )
}
