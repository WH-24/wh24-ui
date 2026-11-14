import {
  cloneElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react'
import { createPortal } from 'react-dom'

import { Icon } from '../list/Icon.js'
import { usePopPresence } from '../overlay/presence.js'
import { chain, cx, useAnchoredPlace } from '../popup/popup.js'

import styles from './Menu.module.css'

/**
 * Выпадающее меню действий — одно на всю библиотеку (карточка записи, «⋯»
 * канбана, меню карточек и колонок). Образец — WAI-ARIA menu button:
 * кнопка-якорь с `aria-haspopup="menu"`, фокус уходит в первый пункт,
 * ↑/↓ ходят по кругу, Home/End — в начало и конец, буква — к пункту на эту
 * букву, Esc закрывает и возвращает фокус на кнопку, Tab закрывает и идёт
 * дальше по странице.
 *
 * Меню рисуется порталом в `body` у кнопки (место считает общий
 * `placePopover`): не обрезается прокручиваемой колонкой и окном. Движение —
 * как у любого всплывающего (`usePopPresence`): открыто с клавиатуры —
 * сразу, выход короче входа.
 *
 *   <Menu label="Ещё действия" trigger={<IconButton ariaLabel="Ещё действия">…</IconButton>}>
 *     <MenuItem onSelect={edit}>Изменить</MenuItem>
 *     <MenuSeparator />
 *     <MenuItem danger onSelect={remove}>Удалить</MenuItem>
 *   </Menu>
 */
export interface MenuProps {
  /** Кнопка-якорь: элемент, принимающий `ref` (`<button>`, `IconButton`). */
  trigger: ReactElement
  /** Название меню для читалки. */
  label: string
  children: ReactNode
  /** Край якоря, по которому выровнено меню (по умолчанию правый). */
  align?: 'start' | 'end'
  /** Управляемое состояние; без него меню ведёт его само. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Свой класс всплывающего (ширина). */
  className?: string
  style?: CSSProperties
}

interface MenuContextValue {
  close: (returnFocus?: boolean) => void
}
const MenuContext = createContext<MenuContextValue | null>(null)

const ITEM = '[role^="menuitem"]:not(:disabled)'

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === 'function') ref(value)
  else if (ref) (ref as { current: T | null }).current = value
}

export function Menu({
  trigger,
  label,
  children,
  align = 'end',
  open: openProp,
  onOpenChange,
  className,
  style,
}: MenuProps) {
  const [own, setOwn] = useState(false)
  const open = openProp ?? own
  const setOpen = useCallback(
    (next: boolean) => {
      if (openProp === undefined) setOwn(next)
      onOpenChange?.(next)
    },
    [openProp, onOpenChange],
  )
  const btnRef = useRef<HTMLElement | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const pop = usePopPresence(open, menuRef)
  const place = useAnchoredPlace(pop.mounted, () => btnRef.current, menuRef, align)
  const typed = useRef({ text: '', at: 0 })

  const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>(ITEM) ?? [])
  const focusAt = (i: number) => {
    const els = items()
    if (els.length) els[(i + els.length) % els.length]!.focus()
  }

  const close = useCallback(
    (returnFocus = true) => {
      setOpen(false)
      if (returnFocus) btnRef.current?.focus()
    },
    [setOpen],
  )

  useEffect(() => {
    if (!open) return
    focusAt(0)
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
    // setOpen меняется вместе с onOpenChange хоста — подписку не пересоздаём.
  }, [open])

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const els = items()
    const i = els.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Tab') {
      // Фокус — на кнопку, дальше Tab ведёт браузер: порядок обхода страницы
      // не рвётся, хотя меню лежит в конце body.
      close()
      return
    }
    if (e.key === 'ArrowDown') focusAt(i + 1)
    else if (e.key === 'ArrowUp') focusAt(i < 0 ? -1 : i - 1)
    else if (e.key === 'Home') focusAt(0)
    else if (e.key === 'End') focusAt(-1)
    else if (e.key === 'Escape') close()
    else if (e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Набор по буквам: «у» — к «Удалить»; быстрый набор копится в слово.
      const now = Date.now()
      const t = typed.current
      t.text = now - t.at > 600 ? e.key.toLowerCase() : t.text + e.key.toLowerCase()
      t.at = now
      const order = [...els.slice(i + 1), ...els.slice(0, i + 1)]
      const hit = order.find((el) => (el.dataset.menuText ?? el.textContent ?? '').trim().toLowerCase().startsWith(t.text))
      if (!hit) return
      hit.focus()
    } else return
    e.preventDefault()
    e.stopPropagation()
  }

  const p = trigger.props as {
    onClick?: (e: ReactMouseEvent<HTMLElement>) => void
    onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void
  }
  const anchor = cloneElement(trigger as ReactElement<Record<string, unknown>>, {
    ref: (el: HTMLElement | null) => {
      btnRef.current = el
      assignRef((trigger as unknown as { ref?: Ref<HTMLElement> }).ref, el)
    },
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? menuId : undefined,
    onClick: chain(p.onClick, () => setOpen(!open)),
    onKeyDown: chain(p.onKeyDown, (e: KeyboardEvent<HTMLElement>) => {
      if (open || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return
      e.preventDefault()
      setOpen(true)
    }),
  })

  return (
    <MenuContext.Provider value={{ close }}>
      {anchor}
      {pop.mounted &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={label}
            className={cx(styles.menu, className)}
            data-align={align}
            data-flipped={place?.flipped || undefined}
            data-instant={pop.instant || undefined}
            style={{
              ...style,
              top: place?.top ?? 0,
              left: place?.left ?? 0,
              maxHeight: place ? Math.min(360, place.maxHeight) : undefined,
              visibility: place ? undefined : 'hidden',
            }}
            onKeyDown={onKey}
            // Меню — в портале: клик по пункту не должен всплывать в строку
            // таблицы или карточку, внутри которой стоит кнопка.
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onBlur={(e) => {
              const to = e.relatedTarget as Node | null
              if (!to || menuRef.current?.contains(to) || btnRef.current?.contains(to)) return
              setOpen(false)
            }}
          >
            {children}
          </div>,
          document.body,
        )}
    </MenuContext.Provider>
  )
}

export interface MenuItemProps {
  children: ReactNode
  onSelect?: () => void
  /** Значок слева (16px). */
  icon?: ReactNode
  /** Пояснение справа от названия (серым). */
  hint?: ReactNode
  /** Сочетание клавиш справа. */
  shortcut?: string
  /** Разрушающее действие. */
  danger?: boolean
  disabled?: boolean
  /** Пункт-флажок: `true`/`false` — отмечен или нет (галочка справа). */
  checked?: boolean
  /** Не закрывать меню после выбора (пункты-флажки подряд). */
  keepOpen?: boolean
  className?: string
  style?: CSSProperties
}

export function MenuItem({
  children,
  onSelect,
  icon,
  hint,
  shortcut,
  danger,
  disabled,
  checked,
  keepOpen,
  className,
  style,
}: MenuItemProps) {
  const ctx = useContext(MenuContext)
  return (
    <button
      type="button"
      role={checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
      aria-checked={checked}
      tabIndex={-1}
      disabled={disabled}
      className={cx(styles.item, danger && styles.danger, className)}
      style={style}
      onClick={() => {
        if (!keepOpen) ctx?.close()
        onSelect?.()
      }}
    >
      {checked !== undefined && (
        <span className={styles.check} aria-hidden="true">
          {checked && <Icon name="check" size={14} />}
        </span>
      )}
      {icon != null && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      <span className={styles.label}>{children}</span>
      {hint != null && <span className={styles.hint}>{hint}</span>}
      {shortcut && <kbd className={styles.shortcut}>{shortcut}</kbd>}
    </button>
  )
}

/** Черта между группами пунктов. */
export function MenuSeparator() {
  return <div role="separator" className={styles.sep} />
}

/** Подпись группы пунктов («Порядок», «Переместить в»). */
export function MenuLabel({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <div id={id} className={styles.groupLabel} role="presentation">
      {children}
    </div>
  )
}
