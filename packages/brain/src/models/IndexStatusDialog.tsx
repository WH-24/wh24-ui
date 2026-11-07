import { useCallback, useEffect, useRef, useState } from 'react'

import { BrainIcon } from '../icons.js'
import { BrainConfirm, BrainDialog } from '../fields/Dialog.js'
import { brainErrorText } from '../fields/errors.js'
import { moduleMeta, type ModuleMetaMap } from '../sources/modules.js'
import type { AdminApi } from './client.js'
import { formatCount, relativeTime } from './format.js'
import type { IndexStatus } from './types.js'
import styles from './models.module.css'

export interface IndexStatusDialogProps {
  api: { admin: Pick<AdminApi, 'index'> }
  open: boolean
  onClose: () => void
  /** «Синхронизировать» и «Переиндексировать» — управляющему. По умолчанию да (сам статус тоже только для управляющего). */
  canManage?: boolean
  /** Свои подписи модулей (как у `SourceCard`). */
  modules?: ModuleMetaMap
}

type State = { phase: 'loading' } | { phase: 'error'; message: string } | { phase: 'ready'; data: IndexStatus }

/**
 * Статус индекса: что и сколько проиндексировано по модулям, когда последний раз
 * удачно синхронизировался каждый источник и на чём споткнулся. Для управляющего:
 * «Синхронизировать» (проход сейчас) и «Переиндексировать» (перечитать всё).
 */
export function IndexStatusDialog({ api, open, onClose, canManage = true, modules }: IndexStatusDialogProps) {
  const [state, setState] = useState<State>({ phase: 'loading' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)
  const run = useRef(0)

  const load = useCallback(
    async (quiet = false) => {
      const my = ++run.current
      if (!quiet) setState({ phase: 'loading' })
      try {
        const data = await api.admin.index.status()
        if (my === run.current) setState({ phase: 'ready', data })
      } catch (e) {
        if (my === run.current) setState({ phase: 'error', message: brainErrorText(e, 'Не удалось загрузить состояние индекса.') })
      }
    },
    [api],
  )

  useEffect(() => {
    if (!open) return
    setMessage('')
    setError('')
    setConfirm(false)
    void load()
    return () => void run.current++
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const act = async (kind: 'sync' | 'reindex') => {
    setBusy(true)
    setMessage('')
    setError('')
    try {
      if (kind === 'sync') await api.admin.index.sync()
      else await api.admin.index.reindex()
      setMessage(kind === 'sync' ? 'Синхронизация запущена — состояние обновится через минуту.' : 'Переиндексация поставлена в очередь: следующий проход перечитает все источники.')
      setConfirm(false)
      void load(true)
    } catch (e) {
      setError(brainErrorText(e, 'Не получилось выполнить действие.'))
      setConfirm(false)
    } finally {
      setBusy(false)
    }
  }

  const data = state.phase === 'ready' ? state.data : null
  const totalDocs = data?.modules.reduce((n, m) => n + m.documents, 0) ?? 0
  const totalChunks = data?.modules.reduce((n, m) => n + m.chunks, 0) ?? 0

  return (
    <>
      <BrainDialog
        open={open}
        onClose={onClose}
        title="Источники и индекс"
        description="Какие данные портала доступны для поиска ИИ и насколько они свежие."
        size="lg"
        busy={busy}
        footer={
          <>
            {canManage && (
              <>
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void act('sync')}>
                  <BrainIcon name="refresh" size={14} />
                  Синхронизировать
                </button>
                <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setConfirm(true)}>
                  Переиндексировать
                </button>
              </>
            )}
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Закрыть
            </button>
          </>
        }
      >
        {state.phase === 'loading' && (
          <p className={styles.state} role="status">
            <span className={styles.spinner} aria-hidden="true" />
            Загружаю состояние индекса…
          </p>
        )}
        {state.phase === 'error' && (
          <div className={styles.errorBox} role="alert">
            <p>{state.message}</p>
            <button type="button" className="btn btn-secondary" onClick={() => void load()}>
              Повторить
            </button>
          </div>
        )}
        <div aria-live="polite">
          {message && <p className={styles.ok}>{message}</p>}
          {error && (
            <p className={styles.bad} role="alert">
              {error}
            </p>
          )}
        </div>
        {data && (
          <div className={styles.sections}>
            <section className={styles.section} aria-labelledby="idx-modules">
              <h3 id="idx-modules" className={styles.sectionTitle}>
                По модулям
              </h3>
              {data.modules.length === 0 ? (
                <p className={styles.hint}>Индекс пока пуст: источники ещё не загружались.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <caption className={styles.srOnly}>Проиндексированные данные по модулям</caption>
                    <thead>
                      <tr>
                        <th scope="col">Модуль</th>
                        <th scope="col">Тип записей</th>
                        <th scope="col" className={styles.num}>
                          Документов
                        </th>
                        <th scope="col" className={styles.num}>
                          Фрагментов
                        </th>
                        <th scope="col">Обновлялось</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.modules.map((m) => (
                        <tr key={`${m.module}/${m.entity_type}`}>
                          <th scope="row">{moduleMeta(m.module, modules).label || m.module}</th>
                          <td>{m.entity_type}</td>
                          <td className={styles.num}>{formatCount(m.documents)}</td>
                          <td className={styles.num}>{formatCount(m.chunks)}</td>
                          <td>{relativeTime(m.newest_at) ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th scope="row" colSpan={2}>
                          Всего
                        </th>
                        <td className={styles.num}>{formatCount(totalDocs)}</td>
                        <td className={styles.num}>{formatCount(totalChunks)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>

            <section className={styles.section} aria-labelledby="idx-conn">
              <h3 id="idx-conn" className={styles.sectionTitle}>
                Источники
              </h3>
              {data.connectors.length === 0 ? (
                <p className={styles.hint}>Источники не настроены (BRAIN_SOURCES пуст).</p>
              ) : (
                <ul className={styles.connectors}>
                  {data.connectors.map((c) => {
                    const ok = relativeTime(c.last_ok_at)
                    return (
                      <li key={c.connector} className={styles.connector} data-bad={c.last_error ? '' : undefined}>
                        <div className={styles.connectorHead}>
                          <span className={styles.connectorName}>{c.connector}</span>
                          <span className={styles.connectorMeta}>
                            {c.docs_total != null ? `${formatCount(c.docs_total)} документов · ` : ''}
                            {ok ? `синхронизирован ${ok}` : 'ещё не синхронизировался'}
                          </span>
                        </div>
                        {c.backfill_done === false && <p className={styles.hint}>Идёт первичная загрузка — данные появляются постепенно.</p>}
                        {c.last_error && (
                          <p className={styles.bad} role="alert">
                            Последняя ошибка: {c.last_error}
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </BrainDialog>
      <BrainConfirm
        open={confirm}
        title="Переиндексировать все источники?"
        message="Сервис перечитает все источники. Неизменившиеся документы не трогаются, векторы неизменных фрагментов сохраняются."
        confirmLabel="Переиндексировать"
        busy={busy}
        onConfirm={() => void act('reindex')}
        onCancel={() => setConfirm(false)}
      />
    </>
  )
}
