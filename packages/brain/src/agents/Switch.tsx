import type { ReactNode } from 'react'

import styles from './switch.module.css'

export interface BrainSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Видимая подпись справа от переключателя. */
  children: ReactNode
  disabled?: boolean
  id?: string
  /** Подпись для скринридера, если по тексту рядом непонятно, к чему переключатель. */
  ariaLabel?: string
  /** id блока с пояснением (`aria-describedby`). */
  describedBy?: string
  className?: string
}

/**
 * Переключатель «включено/выключено» для экрана агентов: `role="switch"` +
 * `aria-checked`, вся строка — цель клика (≥ 28 px). Состояние читается не
 * только цветом: бегунок смещается, во включённом стоит галочка.
 */
export function BrainSwitch({
  checked,
  onChange,
  children,
  disabled,
  id,
  ariaLabel,
  describedBy,
  className,
}: BrainSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-describedby={describedBy}
      disabled={disabled}
      className={[styles.switch, className].filter(Boolean).join(' ')}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb}>
          {checked && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
              <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      </span>
      <span className={styles.text}>{children}</span>
    </button>
  )
}
