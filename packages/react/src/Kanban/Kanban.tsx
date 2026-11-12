import { useEffect, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from 'react'

import { Icon } from '../list/Icon.js'

import styles from './Kanban.module.css'

/** Оттенок шапки колонки — из семантических токенов, не произвольный цвет. */
export type KanbanTone = 'neutral' | 'info' | 'terra' | 'good' | 'bad'

export interface KanbanColumn {
  id: string
  title: string
  tone?: KanbanTone
  /** Число в шапке; по умолчанию — сколько карточек в колонке. */
  count?: number
  /** Под карточками: «Ещё», кнопка «+ задача» и т. п. */
  footer?: ReactNode
}

export interface KanbanProps<T> {
  columns: KanbanColumn[]
  items: T[]
  getId: (item: T) => string
  getColumn: (item: T) => string
  /** Содержимое карточки. Сама карточка (рамка, фокус, перенос) — за компонентом. */
  renderCard: (item: T) => ReactNode
  /** Подпись карточки для экранных дикторов и меню переноса. */
  getLabel: (item: T) => string
  /**
   * Можно ли перенести карточку в колонку. Нет функции — можно в любую.
   * Запрещённые колонки не подсвечиваются при переносе и не попадают в меню.
   */
  canMove?: (item: T, toColumn: string) => boolean
  /** Без onMove доска только для чтения: ни переноса, ни меню. */
  onMove?: (item: T, toColumn: string) => void | Promise<void>
  /**
   * Порядок внутри колонки: карточку бросили перед карточкой beforeId (null —
   * в конец своей колонки). Без onReorder порядок задаёт потребитель через
   * `items`, и переставлять карточки нельзя. В меню карточки — «Выше»/«Ниже»
   * (альтернатива перетаскиванию с клавиатуры).
   */
  onReorder?: (item: T, beforeId: string | null) => void | Promise<void>
  onOpen?: (item: T) => void
  emptyText?: string
  ariaLabel?: string
}

const toneVar: Record<KanbanTone, string> = {
  neutral: 'var(--ink-4)',
  info: 'var(--info)',
  terra: 'var(--terra)',
  good: 'var(--good)',
  bad: 'var(--bad)',
}

/**
 * Канбан: колонки-статусы и карточки, перенос мышью и — как обязательная
 * альтернатива (WCAG 2.2, «Dragging Movements») — меню «Переместить в…» у
 * каждой карточки, доступное с клавиатуры. Компонент не знает, что такое
 * статус: куда можно перенести, решает потребитель (`canMove`), а сам перенос
 * — `onMove` (обычно запрос в API; пока он идёт, карточка помечена занятой).
 */
export function Kanban<T>({
  columns,
  items,
  getId,
  getColumn,
  renderCard,
  getLabel,
  canMove,
  onMove,
  onReorder,
  onOpen,
  emptyText = 'Пусто',
  ariaLabel = 'Канбан',
}: KanbanProps<T>) {
  const [dragId, setDragId] = useState('')
  const [overCol, setOverCol] = useState('')
  // Куда встанет карточку при переносе внутри колонки: перед этой карточкой
  // ('' — в конец колонки, null — не над своей колонкой).
  const [insertBefore, setInsertBefore] = useState<string | null>(null)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const byId = new Map(items.map((it) => [getId(it), it]))
  const dragged = dragId ? byId.get(dragId) : undefined
  const allowed = (item: T, col: string) => getColumn(item) !== col && (canMove ? canMove(item, col) : true)

  const run = async (item: T, act: () => void | Promise<void>) => {
    const id = getId(item)
    setBusy((b) => ({ ...b, [id]: true }))
    try {
      await act()
    } finally {
      setBusy(({ [id]: _, ...rest }) => rest)
    }
  }
  const reorder = (item: T, beforeId: string | null) => {
    if (!onReorder || beforeId === getId(item)) return
    void run(item, () => onReorder(item, beforeId))
  }

  const move = async (item: T, col: string) => {
    if (!onMove || !allowed(item, col)) return
    const id = getId(item)
    setBusy((b) => ({ ...b, [id]: true }))
    try {
      await onMove(item, col)
    } finally {
      setBusy(({ [id]: _, ...rest }) => rest)
    }
  }

  return (
    <div className={styles.board} role="list" aria-label={ariaLabel}>
      {columns.map((col) => {
        const cards = items.filter((it) => getColumn(it) === col.id)
        const droppable = !!dragged && allowed(dragged, col.id)
        // Своя колонка — перестановка (если потребитель её поддерживает).
        const sorting = !!dragged && !!onReorder && getColumn(dragged) === col.id
        const dropProps =
          onMove || onReorder
            ? {
                onDragOver: (e: DragEvent) => {
                  if (!droppable && !sorting) return
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  if (droppable && overCol !== col.id) setOverCol(col.id)
                  // Пустое место колонки под карточками — в конец.
                  if (sorting && e.target === e.currentTarget) setInsertBefore('')
                },
                onDragLeave: (e: DragEvent) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setOverCol('')
                    setInsertBefore(null)
                  }
                },
                onDrop: (e: DragEvent) => {
                  e.preventDefault()
                  setOverCol('')
                  if (dragged && droppable) void move(dragged, col.id)
                  else if (dragged && sorting && insertBefore !== null) reorder(dragged, insertBefore || null)
                  setInsertBefore(null)
                  setDragId('')
                },
              }
            : {}
        const cls = [
          styles.col,
          dragged && !droppable && getColumn(dragged) !== col.id ? styles.colBlocked : '',
          overCol === col.id ? styles.colOver : '',
        ]
          .filter(Boolean)
          .join(' ')
        return (
          <section
            key={col.id}
            className={cls}
            role="listitem"
            aria-label={`${col.title}: ${col.count ?? cards.length}`}
            style={{ '--kanban-tone': toneVar[col.tone ?? 'neutral'] } as CSSProperties}
            {...dropProps}
          >
            <header className={styles.head}>
              <span className={styles.title}>{col.title}</span>
              <span className={styles.count}>{col.count ?? cards.length}</span>
            </header>
            <ul className={styles.cards}>
              {cards.length === 0 && <li className={styles.empty}>{emptyText}</li>}
              {cards.map((it, i) => {
                const id = getId(it)
                const targets = onMove ? columns.filter((c) => allowed(it, c.id)) : []
                const prev = cards[i - 1]
                const next = cards[i + 1]
                const after = cards[i + 2]
                return (
                  <KanbanCard
                    key={id}
                    label={getLabel(it)}
                    busy={!!busy[id]}
                    dragging={dragId === id}
                    draggable={(targets.length > 0 || (!!onReorder && cards.length > 1)) && !busy[id]}
                    insertMark={sorting && insertBefore === id && dragId !== id}
                    onDragStart={() => setDragId(id)}
                    onDragEnd={() => {
                      setDragId('')
                      setOverCol('')
                      setInsertBefore(null)
                    }}
                    onDragOverCard={
                      sorting
                        ? (e) => {
                            // Верхняя половина карточки — встаём перед ней, нижняя — после.
                            const r = e.currentTarget.getBoundingClientRect()
                            const before = e.clientY < r.top + r.height / 2
                            setInsertBefore(before ? id : next ? getId(next) : '')
                          }
                        : undefined
                    }
                    onOpen={onOpen ? () => onOpen(it) : undefined}
                    targets={targets}
                    onMove={(colId) => void move(it, colId)}
                    onUp={onReorder && prev ? () => reorder(it, getId(prev)) : undefined}
                    onDown={onReorder && next ? () => reorder(it, after ? getId(after) : null) : undefined}
                  >
                    {renderCard(it)}
                  </KanbanCard>
                )
              })}
              {sorting && insertBefore === '' && <li className={styles.insertMark} aria-hidden="true" />}
            </ul>
            {col.footer && <div className={styles.footer}>{col.footer}</div>}
          </section>
        )
      })}
    </div>
  )
}

interface CardProps {
  label: string
  busy: boolean
  dragging: boolean
  draggable: boolean
  /** Перед карточкой встанет переносимая — показываем черту. */
  insertMark: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onDragOverCard?: (e: DragEvent<HTMLLIElement>) => void
  onOpen?: () => void
  targets: KanbanColumn[]
  onMove: (colId: string) => void
  onUp?: () => void
  onDown?: () => void
  children: ReactNode
}

function KanbanCard({
  label,
  busy,
  dragging,
  draggable,
  insertMark,
  onDragStart,
  onDragEnd,
  onDragOverCard,
  onOpen,
  targets,
  onMove,
  onUp,
  onDown,
  children,
}: CardProps) {
  const [menu, setMenu] = useState(false)
  // Меню — position: fixed от кнопки: колонка прокручивается сама, и
  // абсолютное меню у нижней карточки обрезалось бы её краем.
  const [pos, setPos] = useState<CSSProperties>({})
  const menuRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const openMenu = () => {
    const r = btnRef.current?.getBoundingClientRect()
    if (r) {
      const right = Math.max(8, window.innerWidth - r.right)
      // Снизу места мало — раскрываемся вверх.
      setPos(
        r.bottom + 240 > window.innerHeight
          ? { bottom: window.innerHeight - r.top + 4, right }
          : { top: r.bottom + 4, right },
      )
    }
    setMenu(true)
  }

  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) setMenu(false)
    }
    // Прокрутка или ресайз уводят кнопку из-под меню — проще закрыть.
    const hide = (e: Event) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false)
    }
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    menuRef.current?.querySelector('button')?.focus()
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [menu])

  const hasMenu = targets.length > 0 || !!onUp || !!onDown
  const cls = [
    styles.card,
    onOpen ? styles.cardOpen : '',
    dragging ? styles.cardDragging : '',
    busy ? styles.cardBusy : '',
    insertMark ? styles.cardInsert : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <li
      className={cls}
      aria-busy={busy || undefined}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', label)
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onDragOver={onDragOverCard}
    >
      {onOpen ? (
        <button type="button" className={styles.cardBody} onClick={onOpen} aria-label={label}>
          {children}
        </button>
      ) : (
        <div className={styles.cardBody}>{children}</div>
      )}
      {hasMenu && (
        <div className={styles.moveWrap}>
          <button
            ref={btnRef}
            type="button"
            className={styles.moveBtn}
            aria-haspopup="menu"
            aria-expanded={menu}
            aria-label={`Переместить «${label}»`}
            title="Переместить в…"
            disabled={busy}
            onClick={() => (menu ? setMenu(false) : openMenu())}
          >
            <Icon name="more" size={16} />
          </button>
          {menu && (
            <div
              ref={menuRef}
              className={styles.menu}
              style={pos}
              role="menu"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  e.stopPropagation()
                  setMenu(false)
                  btnRef.current?.focus()
                }
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault()
                  const btns = Array.from(menuRef.current?.querySelectorAll('button') ?? [])
                  const i = btns.indexOf(document.activeElement as HTMLButtonElement)
                  const next = btns[(i + (e.key === 'ArrowDown' ? 1 : btns.length - 1)) % btns.length]
                  next?.focus()
                }
              }}
            >
              {(onUp || onDown) && (
                <>
                  <div className={styles.menuTitle}>Порядок</div>
                  {onUp && (
                    <button
                      type="button"
                      role="menuitem"
                      className={styles.menuItem}
                      onClick={() => {
                        setMenu(false)
                        onUp()
                      }}
                    >
                      ↑ Выше
                    </button>
                  )}
                  {onDown && (
                    <button
                      type="button"
                      role="menuitem"
                      className={styles.menuItem}
                      onClick={() => {
                        setMenu(false)
                        onDown()
                      }}
                    >
                      ↓ Ниже
                    </button>
                  )}
                </>
              )}
              {targets.length > 0 && <div className={styles.menuTitle}>Переместить в</div>}
              {targets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="menuitem"
                  className={styles.menuItem}
                  style={{ '--kanban-tone': toneVar[t.tone ?? 'neutral'] } as CSSProperties}
                  onClick={() => {
                    setMenu(false)
                    onMove(t.id)
                  }}
                >
                  <span className={styles.dot} aria-hidden="true" />
                  {t.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  )
}
