import { useEffect, useRef, type ReactNode } from 'react'

import styles from './MegaDropdown.module.css'

export interface MegaDropdownProps {
  /** Whether the panel is currently visible. */
  open: boolean
  /** Called when user presses Escape (consumer should set open=false). */
  onClose: () => void
  /** Accessible name for the panel (typically the filter category). */
  ariaLabel: string
  children: ReactNode
  /** Optional bottom row — typically an «Apply» button. */
  footer?: ReactNode
}

/**
 * Wide horizontal dropdown panel — used in the browser filter-bar
 * for multi-column option lists. Renders absolutely positioned
 * below its trigger (consumer is responsible for the trigger button).
 *
 * Behaviour:
 * - Returns null when `open` is false (no DOM presence)
 * - Auto-focuses the first interactive element on open
 * - Closes on Escape (calls `onClose`)
 *
 * NOTE: Click-outside detection is intentionally not implemented here —
 * consumers handle it via the trigger's controlled state. For richer
 * a11y semantics (full focus-trap, ARIA Combobox role) consider
 * migrating to Radix Popover in a future revision.
 */
export function MegaDropdown({ open, onClose, ariaLabel, children, footer }: MegaDropdownProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') onClose()
    }
    document.addEventListener('keydown', onKey)
    const focusable = panelRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    focusable?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={ariaLabel}
      aria-modal="false"
      className={styles.panel}
    >
      <div className={styles.cols}>{children}</div>
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </div>
  )
}
