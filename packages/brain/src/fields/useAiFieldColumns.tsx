import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Icon, type ListColumn } from '@wowhaus-24/ui-react'

import { brainErrorText } from './errors.js'
import { AiFieldCell } from './AiFieldCell.js'
import { AiFieldColumnMenu } from './AiFieldColumnMenu.js'
import { AiFieldDialog } from './AiFieldDialog.js'
import { BrainConfirm } from './Dialog.js'
import type { FieldsApi } from './client.js'
import type { AiField, AiFieldFillResult, AiFieldList, AiFieldValues } from './types.js'
import styles from './fields.module.css'

export interface ConfirmRequest {
  title: string
  message?: string
  confirmLabel?: string
  danger?: boolean
}

export interface UseAiFieldColumnsOptions<T> {
  api: { fields: Pick<FieldsApi, 'list' | 'create' | 'update' | 'remove' | 'values' | 'fill' | 'preview' | 'getPreview'> }
  /** Список, к которому подключаем колонки: `oup`/`lead`, `oup`/`project`, `tasks`/`task`, `forms`/`form_record`… */
  module: string
  entityType: string
  /**
   * Записи форм: id формы — колонки принадлежат конкретной форме (`module: 'forms'`,
   * `entityType: 'form_record'`, `scope: form.id`). Без него сервер считает такой список
   * неподдерживаемым. У лидов, проектов, задач не передаётся.
   */
  scope?: string
  /** Строки списка на экране: по ним запрашиваются значения. */
  rows: T[]
  /** id строки — то же, что `entity_id` в индексе (id лида, проекта, задачи, записи формы). */
  getId: (row: T) => string
  /** Может заводить свои колонки (роль `edit` в модуле ИИ). */
  canCreate: boolean
  /** Управляющий модулем ИИ — может делать колонки общими. */
  canManage: boolean
  /** `false` — ничего не грузить и не показывать (нет доступа к модулю ИИ, список мобильный). */
  enabled?: boolean
  /** Свой диалог подтверждения (например, `useConfirm` портала); по умолчанию — окно пакета. */
  confirm?: (req: ConfirmRequest) => Promise<boolean>
  /** Свои уведомления (тосты хоста); по умолчанию пакет показывает подсказку у нижнего края. */
  notify?: (message: string, tone: 'info' | 'warn' | 'error') => void
  /** Пауза опроса значений, мс (2500; в тестах меньше). */
  pollMs?: number
}

export interface UseAiFieldColumnsResult<T> {
  /** Колонки «Поле ИИ» — в `columns` списка (после обычных). Пусто, пока колонок нет. */
  columns: ListColumn<T>[]
  /** Кнопка «Поле ИИ» — в панель действий списка; `null`, если заводить нельзя. */
  addButton: ReactNode
  /** Диалог настройки, подтверждение и подсказки — рендерится один раз рядом со списком. */
  dialogs: ReactNode
  /** Список поддерживает поля ИИ (по ответу сервера). */
  supported: boolean
  /** Колонки ещё загружаются. */
  loading: boolean
  /** Колонки списка как пришли с сервера (включая выключенные). */
  fields: AiField[]
  /** Перечитать колонки и значения. */
  reload: () => void
}

const EMPTY_LIST: AiFieldList = { fields: [], daily_limit: 0, supported: false }
const ACTIVE = new Set(['queued', 'computing'])
const NOTICE_MS = 7000

type DialogState = { mode: 'create' } | { mode: 'edit'; field: AiField } | null

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

/** Сообщение по итогам «Заполнить»: сколько поставлено и что пропущено. */
export function fillSummary(r: AiFieldFillResult, force: boolean): { text: string; tone: 'info' | 'warn' } {
  const upToDate = r.up_to_date ?? 0
  const parts: string[] = []
  if (r.queued > 0) {
    parts.push(`Заполняю ${r.queued} ${plural(r.queued, 'ячейку', 'ячейки', 'ячеек')} — результат появится в колонке.`)
  } else if (r.no_access === 0 && r.skipped_limit === 0) {
    parts.push(force ? 'Нечего обновлять.' : 'Все ячейки уже заполнены.')
  }
  if (upToDate > 0) {
    parts.push(`${upToDate} ${plural(upToDate, 'уже актуальна', 'уже актуальны', 'уже актуальны')}.`)
  }
  if (r.no_access > 0) {
    parts.push(`Пропущено ${r.no_access} ${plural(r.no_access, 'запись', 'записи', 'записей')}: нет доступа.`)
  }
  if (r.skipped_limit > 0) {
    parts.push(`Дневной лимит колонки исчерпан: не поставлено ${r.skipped_limit}.`)
  }
  return { text: parts.join(' '), tone: r.no_access > 0 || r.skipped_limit > 0 ? 'warn' : 'info' }
}

function activeOf(values: AiFieldValues): { fieldId: string; id: string }[] {
  const out: { fieldId: string; id: string }[] = []
  for (const [fieldId, byId] of Object.entries(values)) {
    for (const [id, v] of Object.entries(byId)) if (ACTIVE.has(v.status)) out.push({ fieldId, id })
  }
  return out
}

/**
 * Колонки «Поле ИИ» для списков портала. Хук ведёт всё сам: грузит колонки
 * списка, запрашивает значения для строк на экране (порциями), раз в 2–3 секунды
 * переспрашивает ячейки в работе — пока вкладка видна, — и отдаёт готовые
 * `columns` для `ListPage`, кнопку «Поле ИИ» и диалоги.
 *
 * Право на значение проверяет сервер: чужие записи в ответ не попадают, ячейка
 * остаётся «—». Хук ничего не хранит в localStorage.
 *
 * ```tsx
 * const ai = useAiFieldColumns({ api, module: 'oup', entityType: 'lead', rows: leads,
 *   getId: (l) => l.id, canCreate: role !== 'view', canManage: role === 'manage' })
 * <ListPage columns={[...base, ...ai.columns]} actions={ai.addButton} … />
 * {ai.dialogs}
 * ```
 */
export function useAiFieldColumns<T>(opts: UseAiFieldColumnsOptions<T>): UseAiFieldColumnsResult<T> {
  const { api, module, entityType, scope, rows, getId, canCreate, canManage, confirm, notify } = opts
  const enabled = opts.enabled !== false
  const pollMs = opts.pollMs ?? 2500

  const [list, setList] = useState<AiFieldList | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [valuesKey, setValuesKey] = useState(0)
  const [values, setValues] = useState<AiFieldValues>({})
  const [limitLeft, setLimitLeft] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [dialog, setDialog] = useState<DialogState>(null)
  const [confirmReq, setConfirmReq] = useState<(ConfirmRequest & { resolve: (ok: boolean) => void }) | null>(null)
  const [notice, setNotice] = useState<{ text: string; tone: 'info' | 'warn' | 'error'; n: number } | null>(null)

  const ids = useMemo(() => rows.map(getId), [rows, getId])
  const idsKey = ids.join('\u0001')
  const idsRef = useRef(ids)
  idsRef.current = ids
  const valuesRef = useRef(values)
  valuesRef.current = values
  const kickRef = useRef<(fieldId: string, entityIds: string[]) => void>(() => {})

  const say = useCallback(
    (text: string, tone: 'info' | 'warn' | 'error' = 'info') => {
      if (!text) return
      if (notify) notify(text, tone)
      else setNotice((n) => ({ text, tone, n: (n?.n ?? 0) + 1 }))
    },
    [notify],
  )
  useEffect(() => {
    if (!notice) return
    const t = window.setTimeout(() => setNotice(null), NOTICE_MS)
    return () => window.clearTimeout(t)
  }, [notice])

  // 1. Колонки списка. Ошибка (нет доступа к модулю ИИ, сеть) — страница работает без них.
  useEffect(() => {
    if (!enabled) {
      setList(null)
      return
    }
    let cancelled = false
    api.fields
      .list(module, entityType, scope)
      .then((l) => !cancelled && setList(l))
      .catch(() => !cancelled && setList(EMPTY_LIST))
    return () => {
      cancelled = true
    }
  }, [api, module, entityType, scope, enabled, reloadKey])

  const fields = useMemo(() => list?.fields ?? [], [list])
  const active = useMemo(() => fields.filter((f) => f.enabled), [fields])
  const activeKey = active.map((f) => f.id).join(',')
  const supported = enabled && list?.supported === true
  const dailyLimit = list?.daily_limit

  // 2. Значения: полная загрузка для строк на экране, затем опрос только ячеек в работе.
  useEffect(() => {
    if (!enabled || active.length === 0 || ids.length === 0) {
      setValues((v) => (Object.keys(v).length === 0 ? v : {}))
      kickRef.current = () => {}
      return
    }
    const fieldIds = active.map((f) => f.id)
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let polling = false
    let fails = 0
    let local: AiFieldValues = {}
    const pending = new Set<string>() // `${fieldId}\u0002${id}` — только что отправленные в очередь
    const key = (f: string, id: string) => `${f}\u0002${id}`

    const visible = () =>
      typeof document === 'undefined' || document.visibilityState !== 'hidden'
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            const on = () => {
              if (document.visibilityState === 'hidden') return
              document.removeEventListener('visibilitychange', on)
              resolve()
            }
            document.addEventListener('visibilitychange', on)
          })

    const apply = (res: AiFieldValues, subset: string[] | null) => {
      if (subset === null) {
        local = res
      } else {
        const next: AiFieldValues = {}
        for (const f of fieldIds) next[f] = { ...local[f] }
        for (const f of fieldIds) {
          for (const id of subset) {
            const v = res[f]?.[id]
            if (v) next[f]![id] = v
            else delete next[f]![id]
          }
        }
        local = next
      }
      setValues(local)
    }

    const poll = async () => {
      timer = undefined
      await visible()
      if (cancelled) return
      const want = new Map<string, Set<string>>() // id → поля (для запроса достаточно набора id)
      for (const a of activeOf(local)) want.set(a.id, new Set([...(want.get(a.id) ?? []), a.fieldId]))
      for (const p of pending) {
        const [f, id] = p.split('\u0002') as [string, string]
        want.set(id, new Set([...(want.get(id) ?? []), f]))
      }
      pending.clear()
      if (want.size === 0) {
        polling = false
        return
      }
      const subset = [...want.keys()]
      try {
        const res = await api.fields.values(module, entityType, subset, scope)
        if (cancelled) return
        fails = 0
        apply(res, subset)
      } catch {
        if (cancelled) return
        if (++fails >= 3) {
          polling = false
          return
        }
      }
      if (activeOf(local).length === 0 && pending.size === 0) {
        polling = false
        return
      }
      timer = setTimeout(poll, fails > 0 ? pollMs * 2 : pollMs)
    }
    const ensurePoll = (delay: number) => {
      if (polling && timer === undefined) return // опрос уже идёт (запрос в полёте)
      polling = true
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(poll, delay)
    }

    kickRef.current = (fieldId, entityIds) => {
      for (const id of entityIds) pending.add(key(fieldId, id))
      ensurePoll(0)
    }

    api.fields
      .values(module, entityType, idsRef.current, scope)
      .then((res) => {
        if (cancelled) return
        apply(res, null)
        if (activeOf(local).length > 0) ensurePoll(pollMs)
      })
      .catch(() => {})

    return () => {
      cancelled = true
      if (timer !== undefined) clearTimeout(timer)
      kickRef.current = () => {}
    }
    // Набор строк и колонок — единственное, от чего зависит полная загрузка.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, module, entityType, scope, enabled, activeKey, idsKey, valuesKey, pollMs])

  const reload = useCallback(() => {
    setReloadKey((k) => k + 1)
    setValuesKey((k) => k + 1)
  }, [])

  const askConfirm = useCallback(
    (req: ConfirmRequest): Promise<boolean> => {
      if (confirm) return confirm(req)
      return new Promise((resolve) => setConfirmReq({ ...req, resolve }))
    },
    [confirm],
  )

  const fill = useCallback(
    async (f: AiField, entityIds: string[], force: boolean) => {
      setBusy((b) => ({ ...b, [f.id]: true }))
      try {
        const r = await api.fields.fill(f.id, { entity_ids: entityIds, force })
        setLimitLeft((m) => ({ ...m, [f.id]: r.limit_left }))
        const s = fillSummary(r, force)
        say(s.text, s.tone)
        if (r.queued > 0) kickRef.current(f.id, entityIds)
      } catch (e) {
        say(brainErrorText(e, 'Не удалось запустить заполнение. Попробуйте ещё раз.'), 'error')
      } finally {
        setBusy((b) => ({ ...b, [f.id]: false }))
      }
    },
    [api, say],
  )

  const fillEmpty = useCallback(
    (f: AiField) => {
      const mine = valuesRef.current[f.id] ?? {}
      const need = idsRef.current.filter((id) => {
        const v = mine[id]
        return !v || v.status === 'failed' || v.status === 'stale' || (v.status === 'fresh' && v.text === '')
      })
      if (idsRef.current.length === 0) return say('В списке нет записей.', 'info')
      if (need.length === 0) return say('Все ячейки уже заполнены.', 'info')
      void fill(f, need, false)
    },
    [fill, say],
  )

  const refreshAll = useCallback(
    (f: AiField) => {
      if (idsRef.current.length === 0) return say('В списке нет записей.', 'info')
      void fill(f, idsRef.current, true)
    },
    [fill, say],
  )

  const remove = useCallback(
    async (f: AiField) => {
      const ok = await askConfirm({
        title: `Удалить колонку «${f.label}»?`,
        message: 'Значения всех ячеек будут удалены. Записи списка не пострадают.',
        confirmLabel: 'Удалить',
        danger: true,
      })
      if (!ok) return
      try {
        await api.fields.remove(f.id)
        say(`Колонка «${f.label}» удалена.`, 'info')
        reload()
      } catch (e) {
        say(brainErrorText(e, 'Не удалось удалить колонку.'), 'error')
      }
    },
    [api, askConfirm, reload, say],
  )

  const columns = useMemo<ListColumn<T>[]>(
    () =>
      active.map((f) => ({
        key: `ai_${f.id}`,
        label: f.label,
        minWidth: 220,
        render: (row: T) => {
          const id = getId(row)
          return (
            <AiFieldCell
              label={f.label}
              value={values[f.id]?.[id]}
              onRetry={() => void fill(f, [id], true)}
            />
          )
        },
        sortValue: (row: T) => values[f.id]?.[getId(row)]?.text ?? '',
        headerActions: (
          <AiFieldColumnMenu
            field={f}
            dailyLimit={dailyLimit}
            limitLeft={limitLeft[f.id]}
            busy={busy[f.id]}
            onFillEmpty={() => fillEmpty(f)}
            onRefreshAll={() => refreshAll(f)}
            onConfigure={() => setDialog({ mode: 'edit', field: f })}
            onRemove={() => void remove(f)}
          />
        ),
      })),
    [active, values, getId, fill, fillEmpty, refreshAll, remove, dailyLimit, limitLeft, busy],
  )

  const addButton: ReactNode =
    enabled && canCreate && supported ? (
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDialog({ mode: 'create' })}>
        <Icon name="plus" size={13} /> Поле ИИ
      </button>
    ) : null

  const dialogs: ReactNode = enabled ? (
    <>
      {(canCreate || dialog?.mode === 'edit') && (
        <AiFieldDialog
          api={api}
          open={dialog !== null}
          onClose={() => setDialog(null)}
          module={module}
          entityType={entityType}
          scope={scope}
          field={dialog?.mode === 'edit' ? dialog.field : null}
          canManage={canManage}
          previewIds={ids.slice(0, 3)}
          onSaved={(f, info) => {
            reload()
            if (info.created) say(`Колонка «${f.label}» создана. Откройте ✨ в её заголовке и выберите «Заполнить пустые».`)
            else if (info.valuesReset) say('Колонка сохранена. Смысл ячейки изменился — прежние значения сброшены, заполните колонку заново.', 'warn')
            else say('Колонка сохранена.')
          }}
        />
      )}
      {!confirm && (
        <BrainConfirm
          open={confirmReq !== null}
          title={confirmReq?.title ?? ''}
          message={confirmReq?.message}
          confirmLabel={confirmReq?.confirmLabel}
          danger={confirmReq?.danger}
          onCancel={() => {
            confirmReq?.resolve(false)
            setConfirmReq(null)
          }}
          onConfirm={() => {
            confirmReq?.resolve(true)
            setConfirmReq(null)
          }}
        />
      )}
      {!notify && notice && (
        <div key={notice.n} className={styles.notice} data-tone={notice.tone} role="status" aria-live="polite">
          <span>{notice.text}</span>
          <button type="button" className={styles.noticeClose} aria-label="Закрыть сообщение" onClick={() => setNotice(null)}>
            <Icon name="close" size={14} />
          </button>
        </div>
      )}
    </>
  ) : null

  return {
    columns,
    addButton,
    dialogs,
    supported,
    loading: enabled && list === null,
    fields,
    reload,
  }
}
