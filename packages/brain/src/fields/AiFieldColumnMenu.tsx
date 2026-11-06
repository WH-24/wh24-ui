import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'

import { BrainIcon } from '../icons.js'
import type { AiField } from './types.js'
import styles from './fields.module.css'

export interface AiFieldColumnMenuProps {
  field: AiField
  /** Расчётов колонки в сутки (`daily_limit` из `fields.list`). */
  dailyLimit?: number
  /** Сколько осталось на сегодня, если известно (после «Заполнить»). */
  limitLeft?: number
  /** Идёт постановка в очередь — пункты заполнения недоступны. */
  busy?: boolean
  onFillEmpty: () => void
  onRefreshAll: () => void
  /** «Настроить…» — только при `field.can.edit`. */
  onConfigure?: () => void
  /** «Удалить…» — только при `field.can.edit`; подтверждение показывает хост/хук. */
  onRemove?: () => void
}

interface Item {
  key: string
  label: string
  danger?: boolean
  disabled?: boolean
  run: () => void
}

const MENU_W = 248

/**
 * Меню в заголовке колонки «Поле ИИ» (кладётся в `ListColumn.headerActions`):
 * «Заполнить пустые», «Обновить все», «Настроить…», «Удалить…». Список рисуется
 * порталом в `<body>` с `position: fixed` — таблица с горизонтальной прокруткой
 * его не обрежет; закрывается по Esc, клику мимо, прокрутке и смене размера окна.
 */
export function AiFieldColumnMenu({
  field,
  dailyLimit,
  limitLeft,
  busy,
  onFillEmpty,
  onRefreshAll,
  onConfigure,
  onRemove,
}: AiFieldColumnMenuProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const menuId = useId()

  const items: Item[] = [
    { key: 'fill', label: 'Заполнить пустые', disabled: busy, run: onFillEmpty },
    { key: 'refresh', label: 'Обновить все', disabled: busy, run: onRefreshAll },
  ]
  if (field.can.edit && onConfigure) items.push({ key: 'configure', label: 'Настроить…', run: onConfigure })
  if (field.can.edit && onRemove) items.push({ key: 'remove', label: 'Удалить…', danger: true, run: onRemove })

  const close = (restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) btn.current?.focus()
  }

  // Координаты — от кнопки, правый край меню по правому краю кнопки, но не за пределы окна.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const r = btn.current?.getBoundingClientRect()
      if (!r) return
      const left = Math.max(8, Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8))
      setPos({ top: r.bottom + 4, left })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    list.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus()
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (list.current?.contains(t) || btn.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown, true)
    return () => document.removeEventListener('mousedown', onDown, true)
  }, [open, pos !== null])

  const onKeyDown = (e: KeyboardEvent) => {
    const els = Array.from(list.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])
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

  const limitText =
    limitLeft != null && dailyLimit
      ? `Сегодня осталось ${limitLeft} из ${dailyLimit} расчётов`
      : dailyLimit
        ? `Лимит колонки: ${dailyLimit} расчётов в сутки`
        : ''

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={styles.colBtn}
        aria-label={`Колонка «${field.label}»: действия`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title="Поле ИИ"
        onClick={() => setOpen((v) => !v)}
      >
        <BrainIcon name="sparkle" size={14} />
      </button>
      {open &&
        pos &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={list}
            id={menuId}
            className={styles.colMenu}
            role="menu"
            aria-label={`Колонка «${field.label}»`}
            style={{ top: pos.top, left: pos.left, width: MENU_W }}
            onKeyDown={onKeyDown}
          >
            {items.map((it, idx) => (
              <div key={it.key} role="none">
                {it.key === 'configure' && idx > 0 && <div className={styles.colSep} role="separator" />}
                <button
                  type="button"
                  role="menuitem"
                  className={styles.colItem}
                  data-danger={it.danger || undefined}
                  disabled={it.disabled}
                  onClick={() => {
                    close(false)
                    it.run()
                  }}
                >
                  {it.label}
                </button>
              </div>
            ))}
            {limitText && <div className={styles.colLimit}>{limitText}</div>}
          </div>,
          document.body,
        )}
    </>
  )
}
