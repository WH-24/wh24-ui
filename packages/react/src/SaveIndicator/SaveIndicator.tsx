import { Icon } from '../list/Icon.js'
import { cx } from '../popup/popup.js'
import { Spinner } from '../Spinner/Spinner.js'

import styles from './SaveIndicator.module.css'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface SaveIndicatorProps {
  /** `idle` — ничего не показано (живая область остаётся в разметке). */
  state: SaveState
  /** Свои подписи состояний. */
  labels?: Partial<Record<Exclude<SaveState, 'idle'>, string>>
  className?: string
}

const LABELS = { saving: 'Сохраняем', saved: 'Сохранено', error: 'Не сохранено' } as const

/**
 * Тихая отметка сохранения без кнопки «Сохранить»: рядом с заголовком
 * карточки или страницы, где поля меняются на месте. Живая область —
 * читалка объявляет «Сохранено» и «Не сохранено» сама.
 */
export function SaveIndicator({ state, labels, className }: SaveIndicatorProps) {
  const text = state === 'idle' ? '' : (labels?.[state] ?? LABELS[state])
  return (
    <span className={cx(styles.root, className)} data-state={state} role="status" aria-live="polite">
      {state === 'saving' && <Spinner size={12} />}
      {state === 'saved' && <Icon name="check" size={14} />}
      {state === 'error' && <Icon name="alert" size={14} />}
      {text}
    </span>
  )
}
