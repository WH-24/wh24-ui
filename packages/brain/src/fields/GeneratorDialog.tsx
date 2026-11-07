import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { DateField, FieldRow, MultiCombobox, type ComboboxOption } from '@wowhaus-24/ui-react'

import type { BrainApi } from '../api.js'
import { BrainIcon } from '../icons.js'
import { Markdown } from '../markdown/Markdown.js'
import { PrivacyNotice } from '../meta/PrivacyNotice.js'
import { SourceList } from '../sources/SourceList.js'
import type { Run } from '../types.js'
import { BrainDialog } from './Dialog.js'
import { brainErrorText } from './errors.js'
import { GENERATOR_LABEL, MAX_STANDUP_PEOPLE } from './labels.js'
import { MAX_PERIOD_DAYS, defaultPeriod, periodDays, periodLabel } from './period.js'
import type { GeneratorKind, GeneratorPerson, GeneratorRequest } from './types.js'
import styles from './fields.module.css'

export interface GeneratorDefaults {
  from?: string
  to?: string
  /** Стендап: кто выбран сразу. */
  people?: GeneratorPerson[]
  /** Дайджест проекта: id записи ОУП и её название. */
  projectId?: string
  projectTitle?: string
  /** Итог недели: как зовут нажавшего (для поиска по людям). */
  selfName?: string
}

export interface GeneratorDialogProps {
  api: Pick<BrainApi, 'generate' | 'waitForRun'>
  open: boolean
  onClose: () => void
  /** Генератор зафиксирован точкой входа («Итог недели» в отчёте). */
  kind?: GeneratorKind
  /** Несколько генераторов на выбор — сегмент «Стендап | Дайджест проекта». Нужен, если `kind` не задан. */
  kinds?: GeneratorKind[]
  defaults?: GeneratorDefaults
  /** Кого можно выбрать в стендап: `user_id` и имя. */
  peopleOptions?: GeneratorPerson[]
  /** Переход к источнику и по внутренним ссылкам ответа (`/pm/leads/…`); окно после перехода закрывается. */
  onNavigate?: (url: string) => void
  /** Составить сразу при открытии (одно нажатие «Итог недели»), если параметров хватает. */
  autoRun?: boolean
  /** Заголовок окна; по умолчанию — название генератора. */
  title?: string
}

type Phase = 'form' | 'running' | 'done' | 'error'

/**
 * Окно генераторов фиксированного формата — «Итог недели», «Стендап», «Дайджест
 * проекта», «Сводка для руководителя». Параметры (период, люди, проект) →
 * «Составить» → опрос запуска → Markdown с цитатами `[n]` и источниками.
 * Права и квота — того, кто нажал: ИИ видит только доступное ему.
 */
export function GeneratorDialog({
  api,
  open,
  onClose,
  kind,
  kinds,
  defaults,
  peopleOptions,
  onNavigate,
  autoRun,
  title,
}: GeneratorDialogProps) {
  const choices = useMemo<GeneratorKind[]>(() => (kind ? [kind] : kinds && kinds.length > 0 ? kinds : ['week_summary']), [kind, kinds])
  const [current, setCurrent] = useState<GeneratorKind>(choices[0]!)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [people, setPeople] = useState<string[]>([])
  const [phase, setPhase] = useState<Phase>('form')
  const [run, setRun] = useState<Run | null>(null)
  const [error, setError] = useState('')
  const [touched, setTouched] = useState(false)
  const [copied, setCopied] = useState<'' | 'ok' | 'fail'>('')
  const [activeCitation, setActiveCitation] = useState<number | undefined>()
  const abort = useRef<AbortController | null>(null)
  const uid = useId()
  const id = (n: string) => `${uid}-${n}`
  const autoDone = useRef(false)

  const meta = GENERATOR_LABEL[current]
  /** Ошибка проверки как узел с `role="alert"`: скринридер объявляет её сразу после «Составить». */
  const problem = (k: string): ReactNode => (touched && problems[k] ? <span role="alert">{problems[k]}</span> : undefined)

  const stop = useCallback(() => {
    abort.current?.abort()
    abort.current = null
  }, [])

  // Открытие — с параметрами по умолчанию; закрытие/размонтирование обрывает ожидание.
  useEffect(() => {
    if (!open) {
      stop()
      autoDone.current = false
      return
    }
    const first = choices.includes(current) ? current : choices[0]!
    setCurrent(first)
    const p = defaultPeriod(first)
    setFrom(defaults?.from || p.from)
    setTo(defaults?.to || p.to)
    setPeople((defaults?.people ?? []).map((x) => x.user_id))
    setPhase('form')
    setRun(null)
    setError('')
    setTouched(false)
    setCopied('')
    setActiveCitation(undefined)
    // Только открытие: правки пропсов при открытом окне не сбрасывают введённое.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  useEffect(() => stop, [stop])

  const options = useMemo<ComboboxOption[]>(() => {
    const byId = new Map<string, string>()
    for (const p of defaults?.people ?? []) byId.set(p.user_id, p.name)
    for (const p of peopleOptions ?? []) byId.set(p.user_id, p.name)
    return [...byId].map(([value, label]) => ({ value, label }))
  }, [peopleOptions, defaults?.people])
  const nameOf = (uidv: string) => options.find((o) => o.value === uidv)?.label ?? ''

  const problems = useMemo(() => {
    const p: Record<string, string> = {}
    const days = periodDays(from, to)
    if (!from || !to || Number.isNaN(days)) p.period = 'Укажите период.'
    else if (days < 1) p.period = 'Конец периода раньше начала.'
    else if (days > MAX_PERIOD_DAYS) p.period = `Период длиннее ${MAX_PERIOD_DAYS} дней.`
    if (current === 'standup') {
      if (people.length === 0) p.people = 'Выберите хотя бы одного человека.'
      else if (people.length > MAX_STANDUP_PEOPLE) p.people = `Не больше ${MAX_STANDUP_PEOPLE} человек за раз.`
    }
    if (current === 'project_update' && !defaults?.projectId) p.project = 'Не выбран проект — откройте дайджест из карточки проекта.'
    return p
  }, [from, to, people, current, defaults?.projectId])

  const start = useCallback(async () => {
    setTouched(true)
    if (Object.keys(problems).length > 0) return
    stop()
    const ctl = new AbortController()
    abort.current = ctl
    setPhase('running')
    setError('')
    setRun(null)
    setCopied('')
    const body: GeneratorRequest = { from, to }
    if (current === 'standup') body.people = people.map((u) => ({ user_id: u, name: nameOf(u) }))
    if (current === 'week_summary' && defaults?.selfName) body.self_name = defaults.selfName
    if (current === 'project_update') {
      body.project_id = defaults?.projectId
      if (defaults?.projectTitle) body.project_title = defaults.projectTitle
    }
    try {
      const { run_id } = await api.generate(current, body)
      const finished = await api.waitForRun(run_id, { signal: ctl.signal })
      if (ctl.signal.aborted) return
      if (finished.status === 'completed') {
        setRun(finished)
        setPhase('done')
      } else {
        setError(finished.error?.trim() || 'Не удалось составить. Попробуйте ещё раз.')
        setPhase('error')
      }
    } catch (e) {
      if (ctl.signal.aborted || (e as { name?: string })?.name === 'AbortError') return
      setError(brainErrorText(e))
      setPhase('error')
    }
    // nameOf берёт options из замыкания — пересоздаём вместе с ними.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, current, from, to, people, problems, defaults, options, stop])

  // «Итог недели» одним нажатием: параметров хватает — сразу составляем.
  useEffect(() => {
    if (!open || !autoRun || autoDone.current || phase !== 'form' || from === '') return
    autoDone.current = true
    if (Object.keys(problems).length === 0) void start()
  }, [open, autoRun, phase, from, problems, start])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(run?.answer_md ?? '')
      setCopied('ok')
      window.setTimeout(() => setCopied(''), 2500)
    } catch {
      setCopied('fail')
    }
  }

  const go = (url: string) => {
    if (!onNavigate) return
    onNavigate(url)
    onClose()
  }

  const pickKind = (k: GeneratorKind) => {
    if (k === current) return
    setCurrent(k)
    const p = defaultPeriod(k)
    setFrom(defaults?.from || p.from)
    setTo(defaults?.to || p.to)
    setTouched(false)
  }
  const onKindKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = choices[(i + (e.key === 'ArrowRight' ? 1 : choices.length - 1)) % choices.length]!
    pickKind(next)
    requestAnimationFrame(() => document.getElementById(id(`kind-${next}`))?.focus())
  }

  const running = phase === 'running'
  const heading = title ?? meta.title

  const footer =
    phase === 'form' ? (
      <>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Отмена
        </button>
        <button type="button" className="btn btn-primary" onClick={start}>
          {meta.action}
        </button>
      </>
    ) : running ? (
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => {
          stop()
          setPhase('form')
        }}
      >
        Остановить
      </button>
    ) : phase === 'done' ? (
      <>
        <span className={styles.copyState} role="status">
          {copied === 'ok' ? 'Скопировано' : copied === 'fail' ? 'Не удалось скопировать — выделите текст вручную' : ''}
        </span>
        <button type="button" className="btn btn-ghost" onClick={() => setPhase('form')}>
          Изменить параметры
        </button>
        <button type="button" className="btn btn-secondary" onClick={copy}>
          <BrainIcon name="copy" size={14} /> Скопировать
        </button>
        <button type="button" className="btn btn-primary" onClick={start}>
          <BrainIcon name="refresh" size={14} /> Составить заново
        </button>
      </>
    ) : (
      <>
        <button type="button" className="btn btn-ghost" onClick={() => setPhase('form')}>
          Изменить параметры
        </button>
        <button type="button" className="btn btn-primary" onClick={start}>
          Повторить
        </button>
      </>
    )

  return (
    <BrainDialog
      open={open}
      onClose={onClose}
      title={heading}
      description={phase === 'form' ? meta.hint : phase === 'running' || phase === 'done' ? periodLabel(from, to) : undefined}
      size="lg"
      footer={footer}
    >
      {phase === 'form' && (
        <>
          {choices.length > 1 && (
            <div className={styles.segment} role="radiogroup" aria-label="Что составить">
              {choices.map((k, i) => (
                <button
                  key={k}
                  id={id(`kind-${k}`)}
                  type="button"
                  role="radio"
                  aria-checked={k === current}
                  tabIndex={k === current ? 0 : -1}
                  className={styles.segmentBtn}
                  onClick={() => pickKind(k)}
                  onKeyDown={(e) => onKindKey(e, i)}
                >
                  {GENERATOR_LABEL[k].title}
                </button>
              ))}
            </div>
          )}

          {current === 'standup' && (
            <FieldRow
              label="Люди"
              htmlFor={id('people')}
              required
              error={problem('people')}
              hint={`До ${MAX_STANDUP_PEOPLE} человек. В стендапе только то, что доступно вам.`}
            >
              <MultiCombobox
                id={id('people')}
                options={options}
                values={people}
                ariaLabel="Люди для стендапа"
                placeholder="Выберите людей"
                emptyText="Никого не найдено"
                invalid={Boolean(touched && problems.people)}
                onChange={setPeople}
              />
            </FieldRow>
          )}

          {current === 'project_update' && (
            <FieldRow label="Проект" error={problem('project')}>
              <p className={styles.staticValue}>{defaults?.projectTitle || (defaults?.projectId ? `Проект ${defaults.projectId}` : '—')}</p>
            </FieldRow>
          )}

          <div className={styles.period}>
            <FieldRow label="Период с" htmlFor={id('from')} error={problem('period')}>
              <DateField id={id('from')} value={from} max={to || undefined} invalid={Boolean(touched && problems.period)} onChange={setFrom} />
            </FieldRow>
            <FieldRow label="по" htmlFor={id('to')}>
              <DateField id={id('to')} value={to} min={from || undefined} invalid={Boolean(touched && problems.period)} onChange={setTo} />
            </FieldRow>
          </div>

          <PrivacyNotice>
            ИИ собирает текст только из данных, к которым есть доступ у вас: чужие и закрытые записи в него не попадут. Ответ видите только вы.
          </PrivacyNotice>
        </>
      )}

      {running && (
        <div className={styles.genBusy} role="status" aria-live="polite" aria-busy="true">
          <span className={styles.spinnerLg} aria-hidden="true" />
          <div>
            <p className={styles.genBusyTitle}>Составляю…</p>
            <p className={styles.genBusyHint}>Обычно это занимает до минуты. Окно можно оставить открытым.</p>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {phase === 'done' && run && (
        <div className={styles.result}>
          <Markdown
            text={run.answer_md}
            citations={run.citations}
            activeCitation={activeCitation}
            onCitationClick={setActiveCitation}
            onNavigate={onNavigate ? go : undefined}
          />
          <SourceList
            sources={run.citations}
            collapsible
            defaultOpen={false}
            activeN={activeCitation}
            onOpen={onNavigate ? (url) => go(url) : undefined}
            emptyText="Ответ без ссылок на документы портала."
          />
        </div>
      )}
    </BrainDialog>
  )
}
