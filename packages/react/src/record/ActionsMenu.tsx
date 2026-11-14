import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import { Icon } from '../list/Icon.js'
import { cleanSeps, type MenuEntry } from './menuItems.js'
import s from './record.module.css'

export type { MenuEntry }

/**
 * Меню «⋯» по образцу WAI-ARIA menu button: фокус уходит в первый пункт,
 * стрелки ходят по пунктам, Esc закрывает и возвращает фокус на кнопку.
 */
export function ActionsMenu({
  items: rawItems,
  label = 'Ещё действия',
  small,
  buttonClassName,
  icon,
}: {
  items: MenuEntry[]
  label?: string
  small?: boolean
  /** Свой вид кнопки «⋯» (например, 30×30 с рамкой во вкладке «Команда»). */
  buttonClassName?: string
  /** Свой значок кнопки (по умолчанию — Icon «more»). */
  icon?: ReactNode
}) {
  const items = cleanSeps(rawItems)
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const actions = items.filter((i): i is Exclude<MenuEntry, 'sep'> => i !== 'sep')

  const focusItem = (i: number) => {
    const els = menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
    if (!els?.length) return
    els[(i + els.length) % els.length]!.focus()
  }

  useEffect(() => {
    if (!open) return
    focusItem(0)
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!menu.current?.contains(t) && !btn.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  if (actions.length === 0) return null

  const close = () => {
    setOpen(false)
    btn.current?.focus()
  }

  const onKey = (e: KeyboardEvent) => {
    const els = Array.from(
      menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
    )
    const i = els.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'ArrowDown') focusItem(i + 1)
    else if (e.key === 'ArrowUp') focusItem(i - 1)
    else if (e.key === 'Home') focusItem(0)
    else if (e.key === 'End') focusItem(els.length - 1)
    else if (e.key === 'Escape') close()
    else if (e.key === 'Tab') setOpen(false)
    else return
    if (e.key !== 'Tab') {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  return (
    <div className={s.menuWrap}>
      <button
        ref={btn}
        type="button"
        className={buttonClassName ?? (small ? s.smallBtn : `${s.btn} ${s.iconBtn}`)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {icon ?? <Icon name="more" size={16} />}
      </button>
      {open && (
        <div
          ref={menu}
          id={menuId}
          role="menu"
          aria-label={label}
          className={s.menu}
          onKeyDown={onKey}
        >
          {items.map((it, i) =>
            it === 'sep' ? (
              <div key={`sep-${i}`} role="separator" className={s.menuSep} />
            ) : (
              <button
                key={it.id}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={`${s.menuItem}${it.danger ? ` ${s.menuDanger}` : ''}`}
                onClick={() => {
                  close()
                  it.onSelect()
                }}
              >
                <span>{it.label}</span>
                {it.hint && <span className={s.menuHint}>{it.hint}</span>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}
