import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Combobox, FieldRow, type ComboboxOption } from '@wowhaus-24/ui-react'

import { BrainApiError } from '../api.js'
import { BrainConfirm, BrainDialog } from '../fields/Dialog.js'
import { brainErrorText } from '../fields/errors.js'
import type { AdminApi, ModelsApi } from './client.js'
import { PROVIDER_LABEL, coverageOf, coveragePercent, formatCount } from './format.js'
import type { BrainModel, EmbeddingProvider, EmbeddingsCheck, EmbeddingsState } from './types.js'
import styles from './models.module.css'

export interface ModelSettingsDialogProps {
  api: { models: Pick<ModelsApi, 'list'>; admin: AdminApi }
  open: boolean
  onClose: () => void
  /** Модель по умолчанию сменилась — хост обновляет `ModelSelect`. */
  onChanged?: (info: { defaultModel: string }) => void
  /** Период опроса покрытия во время переиндексации, мс (5000; в тестах меньше). */
  pollMs?: number
}

type Load = { phase: 'loading' } | { phase: 'error'; message: string } | { phase: 'ready' }

type Pending = { kind: 'provider'; provider: EmbeddingProvider } | { kind: 'activate' } | { kind: 'reindex' } | null

/**
 * «Настроить модели…» — только для управляющего (роль `manage`): модель по умолчанию,
 * провайдер эмбеддингов (локальная модель или OpenAI через релей) с предупреждением
 * о переиндексации, индикатор покрытия, «Проверить провайдера», «Переиндексировать».
 * Пока идёт смена провайдера, покрытие обновляется само.
 */
export function ModelSettingsDialog({ api, open, onClose, onChanged, pollMs = 5000 }: ModelSettingsDialogProps) {
  const [load, setLoad] = useState<Load>({ phase: 'loading' })
  const [models, setModels] = useState<BrainModel[]>([])
  const [defaultModel, setDefaultModel] = useState('')
  const [emb, setEmb] = useState<EmbeddingsState | null>(null)
  const [modelState, setModelState] = useState<{ state: 'idle' | 'saving' | 'saved' | 'error'; message?: string }>({ state: 'idle' })
  const [providerError, setProviderError] = useState('')
  const [check, setCheck] = useState<{ state: 'idle' | 'running' | 'ok' | 'error'; result?: EmbeddingsCheck; message?: string }>({ state: 'idle' })
  const [action, setAction] = useState<{ busy: boolean; message?: string; error?: string }>({ busy: false })
  const [pending, setPending] = useState<Pending>(null)
  const uid = useId()
  const run = useRef(0)

  const fetchAll = useCallback(async () => {
    const my = ++run.current
    setLoad({ phase: 'loading' })
    try {
      const [list, state] = await Promise.all([api.models.list(), api.admin.embeddings.get()])
      if (my !== run.current) return
      setModels(list.models)
      setDefaultModel(list.default_model)
      setEmb(state)
      setLoad({ phase: 'ready' })
    } catch (e) {
      if (my === run.current) setLoad({ phase: 'error', message: brainErrorText(e, 'Не удалось загрузить настройки.') })
    }
  }, [api])

  useEffect(() => {
    if (!open) return
    setModelState({ state: 'idle' })
    setProviderError('')
    setCheck({ state: 'idle' })
    setAction({ busy: false })
    setPending(null)
    void fetchAll()
    return () => void run.current++
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Идёт смена провайдера — покрытие обновляется само, пока вкладка видна.
  const switching = emb?.switching === true
  useEffect(() => {
    if (!open || !switching) return
    let alive = true
    let timer: number | undefined
    const tick = async () => {
      if (!alive) return
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
        try {
          const s = await api.admin.embeddings.get()
          if (alive) setEmb(s)
        } catch {
          /* следующая попытка — через период */
        }
      }
      if (alive) timer = window.setTimeout(() => void tick(), pollMs)
    }
    timer = window.setTimeout(() => void tick(), pollMs)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [open, switching, api, pollMs])

  const modelOptions: ComboboxOption[] = models.map((m) => ({ value: m.id, label: m.label || m.id }))
  const providerOptions: ComboboxOption[] = (['local', 'relay'] as EmbeddingProvider[]).map((p) => ({
    value: p,
    label: PROVIDER_LABEL[p].title,
    hint: emb && !emb.available[p] ? 'не настроен в окружении сервиса' : PROVIDER_LABEL[p].hint,
  }))

  const saveDefault = async (id: string) => {
    if (!id || id === defaultModel) return
    setModelState({ state: 'saving' })
    try {
      const saved = await api.admin.setDefaultModel(id)
      setDefaultModel(saved)
      setModelState({ state: 'saved' })
      onChanged?.({ defaultModel: saved })
    } catch (e) {
      setModelState({ state: 'error', message: brainErrorText(e, 'Не удалось сменить модель.') })
    }
  }

  const chooseProvider = (p: string) => {
    const provider = p as EmbeddingProvider
    if (!emb || provider === emb.provider) return
    setProviderError('')
    if (!emb.available[provider]) {
      setProviderError('Этот провайдер не настроен в окружении сервиса — выбрать его нельзя.')
      return
    }
    setPending({ kind: 'provider', provider })
  }

  const runCheck = async () => {
    setCheck({ state: 'running' })
    try {
      setCheck({ state: 'ok', result: await api.admin.embeddings.check() })
    } catch (e) {
      setCheck({ state: 'error', message: e instanceof BrainApiError && e.status === 502 ? 'Провайдер не ответил или вернул вектор неверной формы.' : brainErrorText(e, 'Не удалось проверить провайдера.') })
    }
  }

  const confirmPending = async () => {
    if (!pending) return
    setAction({ busy: true })
    try {
      if (pending.kind === 'provider') {
        setEmb(await api.admin.embeddings.put(pending.provider))
        setAction({ busy: false, message: 'Провайдер выбран. Переиндексация идёт в фоне — поиск работает на прежней модели, пока новая не досчитается.' })
      } else if (pending.kind === 'activate') {
        setEmb(await api.admin.embeddings.activate())
        setAction({ busy: false, message: 'Поиск переключён на новую модель.' })
      } else {
        await api.admin.index.reindex()
        setAction({ busy: false, message: 'Переиндексация поставлена в очередь: следующий проход перечитает все источники.' })
      }
      setPending(null)
    } catch (e) {
      setAction({ busy: false, error: brainErrorText(e, 'Не получилось выполнить действие.') })
      setPending(null)
    }
  }

  const target = emb ? coverageOf(emb, emb.target_model) : undefined
  const active = emb ? coverageOf(emb, emb.active_model) : undefined
  const shown = switching ? target : (active ?? target)
  const pct = coveragePercent(shown)
  const targetPct = coveragePercent(target)

  const pendingTitle =
    pending?.kind === 'provider'
      ? `Сменить провайдера на «${PROVIDER_LABEL[pending.provider].title}»?`
      : pending?.kind === 'activate'
        ? 'Переключить поиск на новую модель?'
        : 'Переиндексировать все источники?'
  const pendingText =
    pending?.kind === 'provider'
      ? 'Запустится переиндексация: каждый фрагмент получит вектор новой модели. Поиск продолжит работать на прежней модели, пока новая не досчитается; на больших объёмах это занимает часы.'
      : pending?.kind === 'activate'
        ? targetPct < 99
          ? `Новая модель посчитана только на ${targetPct}% фрагментов — остальные перестанут находиться по смыслу. Лучше дождаться ≥ 99%.`
          : 'Поиск начнёт использовать векторы новой модели. Прежние удалятся позже.'
        : 'Сервис перечитает все источники. Неизменившиеся документы не трогаются, векторы неизменных фрагментов сохраняются.'

  return (
    <>
      <BrainDialog open={open} onClose={onClose} title="Модели и поиск" description="Настройки для всех сотрудников. Доступны управляющему модулем ИИ." size="lg" busy={action.busy}
        footer={
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Готово
          </button>
        }
      >
        {load.phase === 'loading' && (
          <p className={styles.state} role="status">
            <span className={styles.spinner} aria-hidden="true" />
            Загружаю настройки…
          </p>
        )}
        {load.phase === 'error' && (
          <div className={styles.errorBox} role="alert">
            <p>{load.message}</p>
            <button type="button" className="btn btn-secondary" onClick={() => void fetchAll()}>
              Повторить
            </button>
          </div>
        )}
        {load.phase === 'ready' && emb && (
          <div className={styles.sections}>
            <section className={styles.section} aria-labelledby={`${uid}-m`}>
              <h3 id={`${uid}-m`} className={styles.sectionTitle}>
                Модель ответов
              </h3>
              <FieldRow label="Модель по умолчанию" htmlFor={`${uid}-model`} span={12} hint="Её используют «Спросить ИИ» и агенты, если человек не выбрал другую.">
                <Combobox
                  id={`${uid}-model`}
                  options={modelOptions}
                  value={defaultModel}
                  ariaLabel="Модель по умолчанию"
                  clearable={false}
                  searchable={false}
                  disabled={modelOptions.length === 0 || modelState.state === 'saving'}
                  onChange={(v) => void saveDefault(v)}
                />
              </FieldRow>
              <p className={styles.status} role="status" data-tone={modelState.state === 'error' ? 'bad' : undefined}>
                {modelState.state === 'saving' ? 'Сохраняю…' : modelState.state === 'saved' ? 'Сохранено' : (modelState.message ?? '')}
              </p>
            </section>

            <section className={styles.section} aria-labelledby={`${uid}-e`}>
              <h3 id={`${uid}-e`} className={styles.sectionTitle}>
                Поиск по данным портала
              </h3>
              <FieldRow label="Провайдер эмбеддингов" htmlFor={`${uid}-prov`} span={12} error={providerError ? <span role="alert">{providerError}</span> : undefined}
                hint="Эмбеддинги нужны для поиска по смыслу. Сменить провайдера можно в любой момент."
              >
                <Combobox
                  id={`${uid}-prov`}
                  options={providerOptions}
                  value={emb.provider}
                  ariaLabel="Провайдер эмбеддингов"
                  clearable={false}
                  searchable={false}
                  disabled={action.busy}
                  onChange={chooseProvider}
                />
              </FieldRow>
              <p className={styles.warn}>
                Смена провайдера запускает переиндексацию — поиск продолжит работать на прежней модели, пока новая не досчитается.
              </p>

              <div className={styles.coverage}>
                <div className={styles.coverageHead}>
                  <span>
                    {emb.coverage.length === 0
                      ? 'Индекс пока пуст.'
                      : switching
                        ? `Новая модель: ${pct}% проиндексировано`
                        : `${pct}% проиндексировано`}
                    {shown && shown.pending > 0 ? `, считается: ${formatCount(shown.pending)}` : ''}
                    {shown && shown.failed > 0 ? `, ошибок: ${formatCount(shown.failed)}` : ''}
                  </span>
                  <span className={styles.coverageModel}>{switching ? emb.target_model : emb.active_model}</span>
                </div>
                <div className={styles.bar} role="progressbar" aria-label="Покрытие индекса векторами" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                  <span className={styles.barFill} style={{ width: `${pct}%` }} data-complete={pct >= 99 || undefined} />
                </div>
                {shown && <p className={styles.hint}>Фрагментов: {formatCount(shown.embedded)} из {formatCount(shown.total)}.</p>}
              </div>

              {switching && (
                <div className={styles.switching} role="status">
                  <p>
                    Идёт переиндексация на модель <b>{emb.target_model}</b>. Поиск пока работает на <b>{emb.active_model}</b>.
                  </p>
                  <button type="button" className="btn btn-secondary" disabled={action.busy} onClick={() => setPending({ kind: 'activate' })}>
                    Переключить поиск на новую модель
                  </button>
                </div>
              )}

              <div className={styles.actions}>
                <button type="button" className="btn btn-secondary" onClick={() => void runCheck()} disabled={check.state === 'running' || action.busy}>
                  {check.state === 'running' ? 'Проверяю…' : 'Проверить провайдера'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setPending({ kind: 'reindex' })} disabled={action.busy}>
                  Переиндексировать
                </button>
              </div>
              <div aria-live="polite">
                {check.state === 'ok' && check.result && (
                  <p className={styles.ok}>
                    Провайдер отвечает: модель {check.result.model}, размерность {check.result.dims}, {check.result.ms} мс.
                  </p>
                )}
                {check.state === 'error' && (
                  <p className={styles.bad} role="alert">
                    {check.message}
                  </p>
                )}
                {action.message && <p className={styles.ok}>{action.message}</p>}
                {action.error && (
                  <p className={styles.bad} role="alert">
                    {action.error}
                  </p>
                )}
              </div>
            </section>
          </div>
        )}

      </BrainDialog>
    <BrainConfirm
      open={Boolean(pending)}
      title={pendingTitle}
      message={pendingText}
      confirmLabel={pending?.kind === 'provider' ? 'Сменить' : pending?.kind === 'activate' ? 'Переключить' : 'Переиндексировать'}
      danger={pending?.kind === 'activate' && targetPct < 99}
      busy={action.busy}
      onConfirm={() => void confirmPending()}
      onCancel={() => setPending(null)}
    />
    </>
  )
}
