import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Icon } from '@wowhaus-24/ui-react'

import styles from './skills.module.css'

export interface CardMenuItem {
  label: string
  danger?: boolean
  onSelect: () => void
}

/** Меню «⋯» карточки: Esc и клик мимо закрывают, стрелки двигают, фокус возвращается на кнопку. */
export function CardMenu({ label, items }: { label: string; items: CardMenuItem[] }) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const menuId = useId()

  const close = (restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) btn.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    list.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (list.current?.contains(t) || btn.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown, true)
    return () => document.removeEventListener('mousedown', onDown, true)
  }, [open])

  const onKeyDown = (e: KeyboardEvent) => {
    const els = Array.from(list.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    const i = els.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close(true)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      els[(i + 1) % els.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      els[(i - 1 + els.length) % els.length]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      els[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      els[els.length - 1]?.focus()
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div className={styles.menuWrap}>
      <button
        ref={btn}
        type="button"
        className={styles.menuBtn}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="more" size={16} />
      </button>
      {open && (
        <div ref={list} id={menuId} className={styles.menu} role="menu" aria-label={label} onKeyDown={onKeyDown}>
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              className={styles.menuItem}
              data-danger={it.danger || undefined}
              onClick={() => {
                close(false)
                it.onSelect()
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
