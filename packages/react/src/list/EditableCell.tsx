import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import { Menu, MenuItem } from '../Menu/Menu.js'
import { keyboardInitiated } from '../overlay/motion.js'
import styles from './ListPage.module.css'

/** Правка значения прямо в ячейке таблицы (`ListColumn.edit`). */
export interface ListCellEdit<T> {
  /** `text` — поле ввода в ячейке; `select` — список значений (общий `Menu`). */
  type: 'text' | 'select'
  /** Варианты для `select`. */
  options?: ReadonlyArray<{ value: string; label: string }>
  /**
   * Исходное значение для редактора. Не задано — берётся `sortValue` колонки
   * (у текстовой колонки это обычно тот же текст).
   */
  getValue?: (row: T) => string
  /**
   * Сохранить. Вернули Promise — ячейка «занята», пока он не завершится;
   * отклонён — значение откатывается, ошибка уходит в `onEditError` списка.
   */
  onCommit: (row: T, value: string) => void | Promise<void>
  /** Строка, которую править нельзя (нет прав, архив). */
  canEdit?: (row: T) => boolean
  /** Имя поля для читалки; по умолчанию — заголовок колонки. */
  ariaLabel?: string
  placeholder?: string
}

interface EditableCellProps {
  type: 'text' | 'select'
  options: ReadonlyArray<{ value: string; label: string }>
  value: string
  label: string
  placeholder?: string
  children: ReactNode
  onCommit: (value: string) => void | Promise<void>
  onError?: (error: unknown, value: string) => void
}

/**
 * Содержимое правимой ячейки (`.ed`/`.cellin` принятого макета). В покое —
 * кнопка с обычным содержимым ячейки: щелчок, Enter, пробел или F2 начинают
 * правку. Текст: Enter и уход из поля сохраняют, Esc отменяет. Список: меню
 * значений с отметкой текущего. Пока сохранение идёт, показано новое значение
 * и ячейка помечена `aria-busy`; не сохранилось — возвращается прежнее.
 */
export function EditableCell({ type, options, value, label, placeholder, children, onCommit, onError }: EditableCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  // Значение, которое сейчас сохраняется: показываем его, а не старое.
  const [pending, setPending] = useState<string | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const alive = useRef(true)
  useEffect(
    () => () => {
      alive.current = false
    },
    [],
  )
  // Фокус после правки с клавиатуры — обратно на ячейку.
  const refocus = useRef(false)
  const finished = useRef(false)
  useEffect(() => {
    if (!editing && refocus.current) {
      refocus.current = false
      btnRef.current?.focus()
    }
  }, [editing])

  const commit = (next: string) => {
    if (next === value) return
    let result: void | Promise<void>
    try {
      result = onCommit(next)
    } catch (e) {
      onError?.(e, next)
      return
    }
    if (!result || typeof result.then !== 'function') return
    setPending(next)
    result.then(
      () => alive.current && setPending(null),
      (e: unknown) => {
        if (alive.current) setPending(null)
        onError?.(e, next)
      },
    )
  }

  const busy = pending !== null
  const shown =
    pending === null ? children : type === 'select' ? (options.find((o) => o.value === pending)?.label ?? pending) : pending

  if (type === 'text' && editing) {
    const finish = (save: boolean) => {
      // Enter закрывает поле, а следом приходит blur снятого поля — один раз.
      if (finished.current) return
      finished.current = true
      refocus.current = keyboardInitiated()
      setEditing(false)
      const next = draft.trim()
      if (save) commit(next)
    }
    return (
      <input
        ref={inputRef}
        className={styles.cellInput}
        aria-label={label}
        placeholder={placeholder}
        value={draft}
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setDraft(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') {
            e.preventDefault()
            finish(true)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            finish(false)
          }
        }}
        onBlur={() => finish(true)}
      />
    )
  }

  const start = () => {
    if (busy) return
    finished.current = false
    setDraft(value)
    setEditing(true)
  }
  const button = (
    <button
      ref={btnRef}
      type="button"
      className={styles.cellEdit}
      data-busy={busy || undefined}
      aria-busy={busy || undefined}
      disabled={busy && type === 'select'}
      onClick={
        type === 'text'
          ? (e) => {
              e.stopPropagation()
              start()
            }
          : (e) => e.stopPropagation()
      }
      onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
        // Enter и пробел кнопка нажимает сама; F2 — привычная «правка» таблиц.
        if (e.key !== 'F2') return
        e.preventDefault()
        e.currentTarget.click()
      }}
    >
      <span className={styles.cellEditHint}>{label}: </span>
      <span className={styles.cellEditText}>{shown}</span>
    </button>
  )
  if (type === 'text') return button
  return (
    <Menu label={label} align="start" trigger={button}>
      {options.map((o) => (
        <MenuItem key={o.value} checked={o.value === (pending ?? value)} onSelect={() => commit(o.value)}>
          {o.label}
        </MenuItem>
      ))}
    </Menu>
  )
}
