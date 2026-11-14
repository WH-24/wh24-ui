import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { Icon, type IconName } from '../list/Icon.js'
import { Menu, MenuItem } from '../Menu/Menu.js'
import { keyboardInitiated } from '../overlay/motion.js'
import { cx } from '../popup/popup.js'

import styles from './BulkActionBar.module.css'

/** Действие над выбранными строками. */
export interface BulkAction {
  /** Стабильный ключ; по умолчанию — подпись. */
  id?: string
  label: string
  /** Значок: имя из набора или свой элемент. */
  icon?: IconName | ReactNode
  /** `danger` — разрушающее действие (удаление). */
  tone?: 'default' | 'danger'
  /**
   * Варианты действия («Изменить отдел» → список отделов): кнопка открывает
   * меню, выбранное значение приходит вторым аргументом `onRun`.
   */
  choices?: ReadonlyArray<{ value: string; label: string }>
  /**
   * Выполнить. Вернули Promise — панель занята, пока он не завершится. После
   * успеха выбор снимается (кроме `keepSelection`); при ошибке — остаётся.
   */
  onRun: (selectedIds: string[], choice?: string) => void | Promise<void>
  /** Не снимать выбор после действия (выгрузка, печать). */
  keepSelection?: boolean
  disabled?: boolean
}

export interface BulkActionBarProps {
  /** Идентификаторы выбранных строк; пусто — панель спрятана. */
  selectedIds: string[]
  actions: ReadonlyArray<BulkAction>
  /** Снять выбор («×» и Esc внутри панели). */
  onClear: () => void
  /** Подпись счётчика. */
  countLabel?: (count: number) => string
  clearLabel?: string
  ariaLabel?: string
  /** Действие завершилось ошибкой (Promise отклонён): выбор не снят. */
  onError?: (error: unknown, action: BulkAction) => void
  className?: string
}

/**
 * Панель массовых действий (`.bulk` принятого макета): выезжает снизу по
 * центру, когда выбраны строки, — «Выбрано: N», действия, «Снять выбор».
 * Рисуется порталом в `body` и стоит в разметке всегда, чтобы выезд и уход
 * шли переходом (перебиваются на полпути), а не появлением.
 *
 * С клавиатуры: панель — `toolbar`, до кнопок доходит Tab, Esc снимает выбор.
 * Выбор, сделанный с клавиатуры, движения не даёт. На телефоне панель встаёт
 * над нижней навигацией модуля и «чёлкой».
 */
export function BulkActionBar({
  selectedIds,
  actions,
  onClear,
  countLabel = (n) => `Выбрано: ${n}`,
  clearLabel = 'Снять выбор',
  ariaLabel = 'Действия с выбранными',
  onError,
  className,
}: BulkActionBarProps) {
  const count = selectedIds.length
  const open = count > 0
  const [busy, setBusy] = useState(false)
  // Число не обнуляем на уходе: панель уезжает с тем, что на ней было.
  const lastCount = useRef(count)
  if (open) lastCount.current = count
  const wasOpen = useRef(open)
  const instant = useRef(false)
  if (wasOpen.current !== open) {
    wasOpen.current = open
    instant.current = keyboardInitiated()
  }

  // Спрятанная панель не ловит фокус и щелчки. `inert` ставим сами: в типах
  // и в обработке атрибутов React 18 его ещё нет.
  const barRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    barRef.current?.toggleAttribute('inert', !open)
  }, [open])

  const run = (a: BulkAction, choice?: string) => {
    if (busy) return
    const done = () => {
      if (!a.keepSelection) onClear()
    }
    const result = a.onRun(selectedIds, choice)
    if (result && typeof result.then === 'function') {
      setBusy(true)
      // Не удалось — выбор остаётся: действие можно повторить.
      result.then(done, (e: unknown) => onError?.(e, a)).finally(() => setBusy(false))
    } else done()
  }

  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      role="toolbar"
      aria-label={ariaLabel}
      aria-hidden={open ? undefined : true}
      aria-busy={busy || undefined}
      ref={barRef}
      className={cx(styles.bar, className)}
      data-open={open ? '' : undefined}
      data-instant={instant.current || undefined}
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || e.defaultPrevented) return
        e.preventDefault()
        onClear()
      }}
    >
      <span className={styles.count} role="status">
        {open ? countLabel(count) : countLabel(lastCount.current)}
      </span>
      {actions.map((a) => {
        const btn = (
          <button
            key={a.id ?? a.label}
            type="button"
            className={cx('btn btn-sm', styles.action, a.tone === 'danger' && styles.danger)}
            disabled={busy || a.disabled}
            onClick={a.choices ? undefined : () => run(a)}
          >
            {a.icon != null && (typeof a.icon === 'string' ? <Icon name={a.icon as IconName} size={14} /> : a.icon)}
            <span className={styles.actionLabel}>{a.label}</span>
            {a.choices && <Icon name="chevdown" size={12} />}
          </button>
        )
        return a.choices ? (
          <Menu key={a.id ?? a.label} label={a.label} align="start" trigger={btn}>
            {a.choices.map((c) => (
              <MenuItem key={c.value} onSelect={() => run(a, c.value)}>
                {c.label}
              </MenuItem>
            ))}
          </Menu>
        ) : (
          btn
        )
      })}
      <button type="button" className={styles.clear} aria-label={clearLabel} title={clearLabel} disabled={busy} onClick={onClear}>
        <Icon name="close" size={14} />
      </button>
    </div>,
    document.body,
  )
}
