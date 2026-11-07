import { useId, useState } from 'react'

import { BrainIcon } from '../icons.js'
import { cellErrorText } from './errors.js'
import type { AiFieldValue } from './types.js'
import styles from './fields.module.css'

export interface AiFieldCellProps {
  /** Значение ячейки; нет значения — «—» (колонку ещё не заполняли для этой записи). */
  value?: AiFieldValue | null
  /** «Повторить» в ячейке с ошибкой; нет колбэка — кнопки нет. */
  onRetry?: () => void
  /** Название колонки — для подписей скринридера. */
  label?: string
  className?: string
}

/** Текст длиннее — сворачиваем до трёх строк и разворачиваем по клику. */
const LONG_TEXT = 90

/**
 * Ячейка колонки «Поле ИИ». Показывает состояние словами и значком, а не только
 * цветом: готово (текст), «запись изменилась» (текст + метка), «Считаю…»
 * (спиннер, `aria-live="polite"`), ошибка с «Повторить», пусто — «—».
 * Права на значение проверил сервер: сюда приходит только то, что вы вправе видеть.
 */
export function AiFieldCell({ value, onRetry, label, className }: AiFieldCellProps) {
  const [expanded, setExpanded] = useState(false)
  const textId = useId()
  const cls = [styles.cell, className].filter(Boolean).join(' ')

  if (!value) {
    return (
      <span className={cls} data-state="empty" aria-label={label ? `${label}: не заполнено` : 'Не заполнено'}>
        <span aria-hidden="true" className={styles.dash}>
          —
        </span>
      </span>
    )
  }

  if (value.status === 'queued' || value.status === 'computing') {
    return (
      <span className={cls} data-state="busy" aria-live="polite" aria-busy="true">
        <span className={styles.spinner} aria-hidden="true" />
        Считаю…
      </span>
    )
  }

  if (value.status === 'failed') {
    return (
      <span className={cls} data-state="failed">
        <span className={styles.failedText}>
          <BrainIcon name="alert" size={13} />
          <span>{cellErrorText(value)}</span>
        </span>
        {onRetry && (
          <button
            type="button"
            className={`btn btn-secondary btn-sm ${styles.retry}`}
            aria-label={label ? `Повторить: ${label}` : 'Повторить'}
            onClick={onRetry}
          >
            Повторить
          </button>
        )}
      </span>
    )
  }

  const text = value.text ?? ''
  if (text === '') {
    return (
      <span className={cls} data-state="empty" aria-label={label ? `${label}: пусто` : 'Пусто'}>
        <span aria-hidden="true" className={styles.dash}>
          —
        </span>
      </span>
    )
  }
  const stale = value.status === 'stale'
  const long = text.length > LONG_TEXT || text.includes('\n')
  return (
    <span className={cls} data-state={stale ? 'stale' : 'fresh'}>
      {long ? (
        <button
          type="button"
          id={textId}
          className={styles.textBtn}
          data-expanded={expanded || undefined}
          aria-expanded={expanded}
          title={expanded ? undefined : text}
          onClick={() => setExpanded((v) => !v)}
        >
          {text}
        </button>
      ) : (
        <span className={styles.text}>{text}</span>
      )}
      {stale && (
        <span className={styles.staleTag} title="Запись изменилась после расчёта — обновите колонку, чтобы значение стало актуальным.">
          <BrainIcon name="refresh" size={11} />
          запись изменилась
        </span>
      )}
    </span>
  )
}
