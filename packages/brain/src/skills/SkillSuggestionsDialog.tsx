import { useCallback, useEffect, useRef, useState } from 'react'

import { BrainApiError } from '../api.js'
import { BrainDialog } from '../fields/Dialog.js'
import { brainErrorText } from '../fields/errors.js'
import type { SkillsApi } from './client.js'
import type { SkillSuggestion, SkillSuggestions } from './types.js'
import styles from './skills.module.css'

export interface SkillSuggestionsDialogProps {
  api: { skills: Pick<SkillsApi, 'suggest'> }
  open: boolean
  onClose: () => void
  /** «Создать навык» у предложения: хост открывает `SkillDialog` с этой заготовкой. Окно закрывается. */
  onPick: (suggestion: SkillSuggestion) => void
}

type State =
  | { phase: 'loading' }
  | { phase: 'done'; data: SkillSuggestions }
  | { phase: 'error'; message: string }

const MAX_SUGGESTIONS = 3

/**
 * «Найти в чатах» (Skills Miner): модель читает ваши последние вопросы и
 * предлагает до трёх навыков для повторяющихся задач. Запрос стартует при
 * открытии окна и стоит денег (квота ИИ) — поэтому повторно только по кнопке.
 * Ничего не сохраняется, пока человек сам не нажмёт «Создать навык».
 */
export function SkillSuggestionsDialog({ api, open, onClose, onPick }: SkillSuggestionsDialogProps) {
  const [state, setState] = useState<State>({ phase: 'loading' })
  const run = useRef(0)

  const load = useCallback(async () => {
    const my = ++run.current
    setState({ phase: 'loading' })
    try {
      const data = await api.skills.suggest()
      if (my === run.current) setState({ phase: 'done', data })
    } catch (e) {
      if (my !== run.current) return
      // Не чаще раза в минуту на человека: 429 с кодом `too_many` — это не квота ИИ, показываем фразу сервера как есть.
      const message =
        e instanceof BrainApiError && e.code === 'too_many'
          ? e.message.trim() && !/^HTTP \d{3}$/.test(e.message.trim())
            ? e.message
            : 'Поиск навыков уже запускали — подождите минуту.'
          : brainErrorText(e, 'Не получилось проанализировать вопросы. Попробуйте ещё раз.')
      setState({ phase: 'error', message })
    }
  }, [api])

  useEffect(() => {
    if (!open) return
    void load()
    return () => void run.current++
    // Запрос — один раз на открытие, а не на каждую смену `api`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const list = state.phase === 'done' ? state.data.suggestions.slice(0, MAX_SUGGESTIONS) : []

  return (
    <BrainDialog
      open={open}
      onClose={onClose}
      title="Навыки из ваших вопросов"
      description="ИИ прочитает ваши последние вопросы и предложит навыки для того, что вы спрашиваете снова и снова. Читаются только ваши вопросы."
      size="lg"
      footer={
        <>
          {state.phase !== 'loading' && (
            <button type="button" className="btn btn-secondary" onClick={() => void load()}>
              Искать заново
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Закрыть
          </button>
        </>
      }
    >
      <div aria-live="polite">
        {state.phase === 'loading' && (
          <p className={styles.state} role="status">
            <span className={styles.spinner} aria-hidden="true" />
            Читаю ваши вопросы…
          </p>
        )}
        {state.phase === 'error' && (
          <p className={styles.formError} role="alert">
            {state.message}
          </p>
        )}
        {state.phase === 'done' && list.length === 0 && (
          <p className={styles.stateText}>
            {state.data.reason || 'Повторяющихся задач пока не нашлось. Задайте ИИ ещё несколько вопросов — и попробуйте снова.'}
            {state.data.analyzed > 0 && <span className={styles.muted}> Прочитано вопросов: {state.data.analyzed}.</span>}
          </p>
        )}
      </div>
      {list.length > 0 && (
        <ul className={styles.suggestions} aria-label="Предложенные навыки">
          {list.map((sg) => (
            <li key={sg.slash} className={styles.suggestion}>
              <div className={styles.suggestionHead}>
                <h3 className={styles.title}>{sg.name}</h3>
                <code className={styles.slash}>/{sg.slash}</code>
              </div>
              {sg.description && <p className={styles.desc}>{sg.description}</p>}
              <p className={styles.suggestionInstr}>{sg.instructions}</p>
              {sg.evidence.length > 0 && (
                <div className={styles.evidence}>
                  <span className={styles.evidenceLabel}>Из ваших вопросов:</span>
                  <ul>
                    {sg.evidence.slice(0, 3).map((e, i) => (
                      <li key={i}>«{e}»</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className={styles.suggestionActions}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    onPick(sg)
                    onClose()
                  }}
                >
                  Создать навык
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </BrainDialog>
  )
}
