import {
  forwardRef,
  type ForwardedRef,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

import { Avatar } from '../Avatar/Avatar.js'
import { Icon, type IconName } from '../list/Icon.js'
import { revealOption } from '../list/popover.js'
import { useFocusTrap, useScrollLock } from '../overlay/useFocusTrap.js'
import { cx } from '../popup/popup.js'

import styles from './CommandPalette.module.css'

export interface CommandItem {
  id: string
  label: string
  /** Заголовок группы; подряд идущие пункты одной группы собираются под ним. */
  group?: string
  /** Значок слева. */
  icon?: IconName | ReactNode
  /** Вместо значка — аватар человека. */
  avatar?: { name: string; src?: string | null }
  /** Вторая, тихая подпись справа (должность, заказчик). */
  subtitle?: string
  /** Сочетание клавиш справа («Ctrl N»). */
  shortcut?: string
  /** Слова, по которым пункт тоже находится, но которые не показываются. */
  keywords?: string
  disabled?: boolean
  /** Действие пункта. Зовётся после закрытия палитры. */
  onSelect?: () => void
}

export interface CommandPaletteProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  open: boolean
  onClose: () => void
  items: CommandItem[]
  /** Выбран пункт (в дополнение к его собственному `onSelect`). */
  onSelect?: (item: CommandItem) => void
  /**
   * Задан — поиском занимается хозяин (запрос на сервер, свой порядок):
   * палитра показывает `items` как есть. Не задан — встроенный поиск по
   * вхождению в подпись, вторую подпись и `keywords`.
   */
  onQueryChange?: (query: string) => void
  placeholder?: string
  /** Имя окна и поля для читалки. */
  label?: string
  emptyText?: string
  /** Подсказки внизу; `null` — без подвала. */
  footer?: ReactNode | null
}

interface Group {
  name: string
  rows: Array<{ item: CommandItem; index: number }>
}

function matches(item: CommandItem, q: string): boolean {
  if (!q) return true
  return `${item.label} ${item.subtitle ?? ''} ${item.keywords ?? ''}`.toLocaleLowerCase().includes(q)
}

/**
 * Палитра команд (Ctrl/Cmd+K): поиск по разделам, людям, записям и действиям.
 *
 * Открывается БЕЗ анимации: ею пользуются десятки раз в день с клавиатуры, и
 * любая задержка между нажатием и полем ввода ощущается как медленный
 * интерфейс. Фокус держится внутри (общая ловушка окон), Esc и щелчок мимо
 * закрывают, ↑/↓ ходят по кругу, Enter выполняет.
 */
export const CommandPalette = forwardRef<HTMLDivElement, CommandPaletteProps>(function CommandPalette(props, ref) {
  if (!props.open) return null
  return createPortal(<PaletteCard {...props} forwardedRef={ref} />, document.body)
})

const DEFAULT_FOOTER = (
  <>
    <span>
      <kbd>↑</kbd>
      <kbd>↓</kbd> выбрать
    </span>
    <span>
      <kbd>Enter</kbd> открыть
    </span>
  </>
)

function PaletteCard({
  open,
  onClose,
  items,
  onSelect,
  onQueryChange,
  placeholder = 'Сотрудник, проект, раздел или действие',
  label = 'Поиск и команды',
  emptyText = 'Ничего не найдено',
  footer = DEFAULT_FOOTER,
  className,
  forwardedRef,
  ...rest
}: CommandPaletteProps & { forwardedRef: ForwardedRef<HTMLDivElement> }) {
  const uid = useId()
  const cardRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const q = query.trim().toLocaleLowerCase()
  const shown = useMemo(
    () => (onQueryChange ? items : items.filter((it) => matches(it, q))),
    // onQueryChange меняет только режим — сама функция в расчёте не участвует.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, q, Boolean(onQueryChange)],
  )
  const groups = useMemo(() => {
    const out: Group[] = []
    shown.forEach((item, index) => {
      const name = item.group ?? ''
      let g = out.find((x) => x.name === name)
      if (!g) {
        g = { name, rows: [] }
        out.push(g)
      }
      g.rows.push({ item, index })
    })
    return out
  }, [shown])
  // Порядок обхода стрелками — как на экране (по группам).
  const flat = useMemo(() => groups.flatMap((g) => g.rows.map((r) => r.item)), [groups])
  const enabled = flat.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0)
  const cur = enabled.includes(active) ? active : (enabled[0] ?? -1)
  const optionId = (i: number) => `${uid}-o-${i}`

  useFocusTrap({ open, containerRef: cardRef, onEscape: onClose })
  useScrollLock(open)
  // Фокус в поле — после ловушки: она сначала запоминает, откуда палитру
  // открыли (туда фокус вернётся при закрытии).
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (cur >= 0) revealOption(optionId(cur))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur])

  const run = (item: CommandItem | undefined) => {
    if (!item || item.disabled) return
    onClose()
    item.onSelect?.()
    onSelect?.(item)
  }

  const move = (step: 1 | -1) => {
    if (!enabled.length) return
    const at = enabled.indexOf(cur)
    setActive(enabled[(at + step + enabled.length) % enabled.length]!)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      move(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      move(-1)
    } else if (e.key === 'Home' && enabled.length) {
      e.preventDefault()
      setActive(enabled[0]!)
    } else if (e.key === 'End' && enabled.length) {
      e.preventDefault()
      setActive(enabled[enabled.length - 1]!)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      run(flat[cur])
    }
  }

  let counter = -1
  return (
    <div
      className={styles.scrim}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        {...rest}
        ref={(el) => {
          cardRef.current = el
          if (typeof forwardedRef === 'function') forwardedRef(el)
          else if (forwardedRef) forwardedRef.current = el
        }}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={cx(styles.cmdk, className)}
      >
        <div className={styles.inputRow}>
          <Icon name="search" size={16} />
          <input
            ref={inputRef}
            className={styles.input}
            role="combobox"
            aria-expanded="true"
            aria-controls={`${uid}-list`}
            aria-activedescendant={cur >= 0 ? optionId(cur) : undefined}
            aria-autocomplete="list"
            aria-label={label}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
              onQueryChange?.(e.target.value)
            }}
            onKeyDown={onKeyDown}
          />
          <kbd className={styles.kbd}>Esc</kbd>
        </div>

        <div id={`${uid}-list`} role="listbox" aria-label={label} className={styles.list}>
          {flat.length === 0 && (
            <div className={styles.empty} role="status">
              {emptyText}
            </div>
          )}
          {groups.map((g) => (
            <div key={g.name || '—'} role="group" aria-label={g.name || undefined}>
              {g.name && (
                <div className={styles.group} aria-hidden="true">
                  {g.name}
                </div>
              )}
              {g.rows.map(({ item }) => {
                counter++
                const i = counter
                return (
                  <div
                    key={item.id}
                    id={optionId(i)}
                    role="option"
                    aria-selected={i === cur}
                    aria-disabled={item.disabled || undefined}
                    className={styles.opt}
                    data-active={i === cur || undefined}
                    // Движение, а не вход курсора: список, прокрутившийся под
                    // неподвижной мышью, не должен перехватывать выбор стрелками.
                    onMouseMove={() => {
                      if (!item.disabled && i !== cur) setActive(i)
                    }}
                    // Фокус остаётся в поле ввода.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => run(item)}
                  >
                    <span className={styles.lead} aria-hidden="true">
                      {item.avatar ? (
                        <Avatar name={item.avatar.name} src={item.avatar.src} size={20} aria-hidden="true" />
                      ) : typeof item.icon === 'string' ? (
                        <Icon name={item.icon as IconName} size={16} />
                      ) : (
                        (item.icon ?? null)
                      )}
                    </span>
                    <span className={styles.label}>{item.label}</span>
                    {item.subtitle && <span className={styles.sub}>{item.subtitle}</span>}
                    {item.shortcut && <kbd className={styles.kbd}>{item.shortcut}</kbd>}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {footer != null && (
          <div className={styles.footer} aria-hidden="true">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Ctrl+K / Cmd+K открывает палитру. Работает и в русской раскладке (та же
 * клавиша печатает «л») и в любой другой — по физической клавише.
 */
export function useCommandPaletteShortcut(onOpen: () => void, enabled = true): void {
  const cb = useRef(onOpen)
  cb.current = onOpen
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return
      const key = (e.key ?? '').toLowerCase()
      if (key !== 'k' && key !== 'л' && e.code !== 'KeyK') return
      e.preventDefault()
      cb.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [enabled])
}
