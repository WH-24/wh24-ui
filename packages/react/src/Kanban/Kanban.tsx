import { Fragment, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from 'react'

import { Icon } from '../list/Icon.js'
import { IconButton } from '../IconButton/IconButton.js'
import { Menu, MenuItem, MenuLabel } from '../Menu/Menu.js'
import { useFlip } from '../motion/useFlip.js'
import { keyboardInitiated } from '../overlay/motion.js'

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
  /** Строка под названием колонки — сумма, срок, что угодно по её карточкам. */
  columnSummary?: (column: KanbanColumn, items: T[]) => ReactNode
  /**
   * Колонки сворачиваются в узкую полосу (название вертикально и счётчик);
   * свёрнутая колонка по-прежнему принимает карточки.
   */
  collapsible?: boolean
  /** Свёрнутые колонки (управляемо); без него доска ведёт их сама. */
  collapsed?: ReadonlyArray<string>
  defaultCollapsed?: ReadonlyArray<string>
  onCollapsedChange?: (columnIds: string[]) => void
  /**
   * Быстрое добавление: «+ Добавить» внизу колонки превращается в поле;
   * Enter добавляет, Esc отменяет. Вернули Promise — поле занято, пока идёт.
   */
  onQuickAdd?: (columnId: string, title: string) => void | Promise<void>
  /**
   * При переносе показывать место, куда встанет карточка, — пунктирной
   * заготовкой её высоты (вместо тонкой черты). В чужой колонке место — в
   * конце: порядок там задаёт потребитель.
   */
  dropPlaceholder?: boolean
  /** Перенесённые, удалённые карточки и их соседи плавно доезжают до места. */
  animateChanges?: boolean
  labels?: Partial<KanbanLabels>
}

/** Подписи доски; любую можно заменить через `labels`. */
export interface KanbanLabels {
  collapse: (columnTitle: string) => string
  expand: (columnTitle: string) => string
  quickAdd: string
  quickAddPlaceholder: string
  quickAddField: (columnTitle: string) => string
}

const LABELS: KanbanLabels = {
  collapse: (t) => `Свернуть колонку «${t}»`,
  expand: (t) => `Развернуть колонку «${t}»`,
  quickAdd: 'Добавить',
  quickAddPlaceholder: 'Название',
  quickAddField: (t) => `Новая карточка в колонке «${t}»`,
}

const NO_COLLAPSED: ReadonlyArray<string> = []

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
/** Пустая колонка — один и тот же массив, без нового на каждый рендер. */
const NO_CARDS: never[] = []

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
  columnSummary,
  collapsible = false,
  collapsed: collapsedProp,
  defaultCollapsed = NO_COLLAPSED,
  onCollapsedChange,
  onQuickAdd,
  dropPlaceholder = false,
  animateChanges = false,
  labels,
}: KanbanProps<T>) {
  const l = { ...LABELS, ...labels }
  const [ownCollapsed, setOwnCollapsed] = useState<ReadonlyArray<string>>(defaultCollapsed)
  const collapsedList = collapsible ? (collapsedProp ?? ownCollapsed) : NO_COLLAPSED
  // Свернули или развернули колонку — её кнопка сменилась другой: фокус на новую.
  const focusCol = useRef<string | null>(null)
  const toggleCollapsed = (id: string) => {
    const next = collapsedList.includes(id) ? collapsedList.filter((c) => c !== id) : [...collapsedList, id]
    if (collapsedProp === undefined) setOwnCollapsed(next)
    onCollapsedChange?.(next)
    focusCol.current = id
  }
  // Высота переносимой карточки — для заготовки места.
  const [dragHeight, setDragHeight] = useState(0)
  const [dragId, setDragId] = useState('')
  const [overCol, setOverCol] = useState('')
  // Куда встанет карточку при переносе внутри колонки: перед этой карточкой
  // ('' — в конец колонки, null — не над своей колонкой).
  const [insertBefore, setInsertBefore] = useState<string | null>(null)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  // После переноса из меню карточка переезжает в другую колонку (другой
  // <section>) и фокус падал на <body>. Возвращаем его на «⋯» этой же
  // карточки и говорим вслух, что случилось.
  const boardRef = useRef<HTMLDivElement>(null)
  const refocus = useRef<string | null>(null)
  const [announce, setAnnounce] = useState('')
  useEffect(() => {
    const id = refocus.current
    if (!id || busy[id]) return
    const li = boardRef.current?.querySelector<HTMLElement>(`[data-kanban-card="${CSS.escape(id)}"]`)
    const btn = li?.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]') ?? li?.querySelector('button')
    if (btn) {
      refocus.current = null
      btn.focus()
    }
  })
  useEffect(() => {
    const id = focusCol.current
    if (id === null) return
    focusCol.current = null
    boardRef.current?.querySelector<HTMLElement>(`[data-kanban-col="${CSS.escape(id)}"] [data-kanban-toggle]`)?.focus()
  })
  // Переезд карточек и колонок: повод — сменился порядок карточек по
  // колонкам или набор свёрнутых. Пока карточку тащат — без движения.
  const flipTrigger = animateChanges
    ? `${items.map((it) => `${getId(it)}@${getColumn(it)}`).join('|')}#${collapsedList.join(',')}`
    : ''
  useFlip(boardRef, flipTrigger, { disabled: !animateChanges || dragId !== '' })
  // Карточки по колонкам — одним проходом, а не `items.filter` на каждую
  // колонку при каждом рендере (перенос мышью рендерит доску на каждый dragover).
  const byColumn = useMemo(() => {
    const map = new Map<string, T[]>()
    for (const it of items) {
      const col = getColumn(it)
      const list = map.get(col)
      if (list) list.push(it)
      else map.set(col, [it])
    }
    return map
  }, [items, getColumn])
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
  const reorder = (item: T, beforeId: string | null, say?: string) => {
    if (!onReorder || beforeId === getId(item)) return
    void run(item, async () => {
      await onReorder(item, beforeId)
      if (say) setAnnounce(say)
    })
  }

  const move = async (item: T, col: string, fromMenu = false) => {
    if (!onMove || !allowed(item, col)) return
    const id = getId(item)
    if (fromMenu) refocus.current = id
    setBusy((b) => ({ ...b, [id]: true }))
    try {
      await onMove(item, col)
      const title = columns.find((c) => c.id === col)?.title ?? col
      setAnnounce(`«${getLabel(item)}» — в колонке «${title}»`)
    } finally {
      setBusy(({ [id]: _, ...rest }) => rest)
    }
  }

  return (
    <>
      {/* Вне role="list": внутри списка допустимы только его элементы. */}
      <div className={styles.srOnly} aria-live="polite" role="status">
        {announce}
      </div>
      <div ref={boardRef} className={styles.board} role="list" aria-label={ariaLabel}>
        {columns.map((col) => {
          const cards = byColumn.get(col.id) ?? NO_CARDS
          const mini = collapsedList.includes(col.id)
          const droppable = !!dragged && allowed(dragged, col.id)
          // Своя колонка — перестановка (если потребитель её поддерживает).
          const sorting = !mini && !!dragged && !!onReorder && getColumn(dragged) === col.id
          const placeholder = (key: string) => (
            <li key={key} className={styles.placeholder} style={{ height: dragHeight || undefined }} aria-hidden="true" />
          )
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
          const summary = columnSummary && !mini ? columnSummary(col, cards) : null
          if (mini) {
            return (
              <section
                key={col.id}
                className={`${cls} ${styles.colMini}`}
                role="listitem"
                aria-label={`${col.title}: ${col.count ?? cards.length}`}
                style={{ '--kanban-tone': toneVar[col.tone ?? 'neutral'] } as CSSProperties}
                data-kanban-col={col.id}
                data-flip-id={animateChanges ? `col:${col.id}` : undefined}
                {...dropProps}
              >
                <button
                  type="button"
                  className={styles.miniBtn}
                  data-kanban-toggle=""
                  aria-expanded={false}
                  aria-label={l.expand(col.title)}
                  title={l.expand(col.title)}
                  onClick={() => toggleCollapsed(col.id)}
                >
                  <span className={styles.dot} aria-hidden="true" />
                  <span className={styles.count}>{col.count ?? cards.length}</span>
                  <span className={styles.miniTitle}>{col.title}</span>
                </button>
              </section>
            )
          }
          return (
            <section
              key={col.id}
              className={cls}
              role="listitem"
              aria-label={`${col.title}: ${col.count ?? cards.length}`}
              style={{ '--kanban-tone': toneVar[col.tone ?? 'neutral'] } as CSSProperties}
              data-kanban-col={collapsible ? col.id : undefined}
              data-flip-id={animateChanges ? `col:${col.id}` : undefined}
              {...dropProps}
            >
              <header className={styles.head}>
                <span className={styles.dot} aria-hidden="true" />
                <span className={styles.title} title={col.title}>
                  {col.title}
                </span>
                <span className={styles.count}>{col.count ?? cards.length}</span>
                {collapsible && (
                  <IconButton
                    size={24}
                    className={styles.collapseBtn}
                    ariaLabel={l.collapse(col.title)}
                    title={l.collapse(col.title)}
                    ariaExpanded
                    data-kanban-toggle=""
                    onClick={() => toggleCollapsed(col.id)}
                  >
                    <Icon name="chevleft" size={14} />
                  </IconButton>
                )}
              </header>
              {summary != null && summary !== false && <div className={styles.summary}>{summary}</div>}
              <ul className={styles.cards}>
                {cards.length === 0 && !(dropPlaceholder && overCol === col.id) && (
                  <li className={styles.empty}>{emptyText}</li>
                )}
                {cards.map((it, i) => {
                  const id = getId(it)
                  const targets = onMove ? columns.filter((c) => allowed(it, c.id)) : []
                  const prev = cards[i - 1]
                  const next = cards[i + 1]
                  const after = cards[i + 2]
                  return (
                    <Fragment key={id}>
                    {dropPlaceholder && sorting && insertBefore === id && dragId !== id && placeholder(`ph:${id}`)}
                    <KanbanCard
                      cardId={id}
                      flipId={animateChanges ? `card:${id}` : undefined}
                      label={getLabel(it)}
                      busy={!!busy[id]}
                      dragging={dragId === id}
                      draggable={(targets.length > 0 || (!!onReorder && cards.length > 1)) && !busy[id]}
                      insertMark={!dropPlaceholder && sorting && insertBefore === id && dragId !== id}
                      onDragStart={(height) => {
                        setDragHeight(height)
                        setDragId(id)
                      }}
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
                      onMove={(colId) => void move(it, colId, true)}
                      onUp={
                        onReorder && prev
                          ? () => {
                              refocus.current = id
                              reorder(it, getId(prev), `«${getLabel(it)}» — выше`)
                            }
                          : undefined
                      }
                      onDown={
                        onReorder && next
                          ? () => {
                              refocus.current = id
                              reorder(it, after ? getId(after) : null, `«${getLabel(it)}» — ниже`)
                            }
                          : undefined
                      }
                    >
                      {renderCard(it)}
                    </KanbanCard>
                    </Fragment>
                  )
                })}
                {sorting && insertBefore === '' &&
                  (dropPlaceholder ? placeholder('ph:end') : <li className={styles.insertMark} aria-hidden="true" />)}
                {dropPlaceholder && !sorting && droppable && overCol === col.id && placeholder('ph:move')}
              </ul>
              {onQuickAdd && (
                <QuickAdd
                  label={l.quickAdd}
                  placeholder={l.quickAddPlaceholder}
                  fieldLabel={l.quickAddField(col.title)}
                  onAdd={(title) => onQuickAdd(col.id, title)}
                />
              )}
              {col.footer && <div className={styles.footer}>{col.footer}</div>}
            </section>
          )
        })}
      </div>
    </>
  )
}

/** «+ Добавить» внизу колонки: кнопка превращается в поле названия. */
function QuickAdd({
  label,
  placeholder,
  fieldLabel,
  onAdd,
}: {
  label: string
  placeholder: string
  fieldLabel: string
  onAdd: (title: string) => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const done = useRef(false)
  const refocus = useRef(false)
  useEffect(() => {
    if (!open && refocus.current) {
      refocus.current = false
      btnRef.current?.focus()
    }
  }, [open])
  const finish = async (save: boolean) => {
    // Enter закрывает поле, следом приходит blur — добавляем один раз.
    if (done.current) return
    done.current = true
    const title = value.trim()
    const byKeyboard = keyboardInitiated()
    if (save && title) {
      setBusy(true)
      try {
        await onAdd(title)
      } catch {
        // Не добавилось (об ошибке скажет хост): поле с текстом остаётся,
        // пока в нём стоят, — можно повторить.
        setBusy(false)
        if (document.activeElement === inputRef.current) {
          done.current = false
          return
        }
      }
      setBusy(false)
    }
    refocus.current = byKeyboard
    setOpen(false)
    setValue('')
  }
  if (!open) {
    return (
      <button
        ref={btnRef}
        type="button"
        className={styles.quickAdd}
        onClick={() => {
          done.current = false
          setOpen(true)
        }}
      >
        <Icon name="plus" size={14} />
        {label}
      </button>
    )
  }
  return (
    <input
      ref={inputRef}
      className={styles.quickAddInput}
      autoFocus
      aria-label={fieldLabel}
      aria-busy={busy || undefined}
      placeholder={placeholder}
      value={value}
      readOnly={busy}
      maxLength={200}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          void finish(true)
        } else if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          void finish(false)
        }
      }}
      onBlur={() => void finish(true)}
    />
  )
}

interface CardProps {
  cardId: string
  /** Ключ плавного переезда (`animateChanges`). */
  flipId?: string
  label: string
  busy: boolean
  dragging: boolean
  draggable: boolean
  /** Перед карточкой встанет переносимая — показываем черту. */
  insertMark: boolean
  onDragStart: (height: number) => void
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
  cardId,
  flipId,
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
  const menuId = useId()
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
      data-kanban-card={cardId}
      data-flip-id={flipId}
      aria-busy={busy || undefined}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', label)
        onDragStart(e.currentTarget.offsetHeight)
      }}
      onDragEnd={onDragEnd}
      onDragOver={onDragOverCard}
    >
      {onOpen ? (
        // Имя — подпись карточки, описание — всё её содержимое (номер,
        // исполнитель, срок): один aria-label прятал остальное от читалки.
        <button
          type="button"
          className={styles.cardBody}
          onClick={onOpen}
          aria-label={label}
          aria-describedby={`${menuId}-body`}
        >
          <span id={`${menuId}-body`} className={styles.bodyText}>
            {children}
          </span>
        </button>
      ) : (
        <div className={styles.cardBody}>{children}</div>
      )}
      {hasMenu && (
        <div className={styles.moveWrap}>
          <Menu
            label={`Действия: ${label}`}
            trigger={
              <IconButton size={24} ariaLabel={`Переместить «${label}»`} title="Переместить в…" disabled={busy}>
                <Icon name="more" size={16} />
              </IconButton>
            }
          >
            {(onUp || onDown) && (
              <div role="group" aria-labelledby={`${menuId}-order`}>
                <MenuLabel id={`${menuId}-order`}>Порядок</MenuLabel>
                {onUp && (
                  <MenuItem icon={<Icon name="arrowup" size={14} />} onSelect={onUp}>
                    Выше
                  </MenuItem>
                )}
                {onDown && (
                  <MenuItem icon={<Icon name="arrowdown" size={14} />} onSelect={onDown}>
                    Ниже
                  </MenuItem>
                )}
              </div>
            )}
            {targets.length > 0 && (
              <div role="group" aria-labelledby={`${menuId}-move`}>
                <MenuLabel id={`${menuId}-move`}>Переместить в</MenuLabel>
                {targets.map((t) => (
                  <MenuItem
                    key={t.id}
                    icon={
                      <span
                        className={styles.dot}
                        style={{ '--kanban-tone': toneVar[t.tone ?? 'neutral'] } as CSSProperties}
                      />
                    }
                    onSelect={() => onMove(t.id)}
                  >
                    {t.title}
                  </MenuItem>
                ))}
              </div>
            )}
          </Menu>
        </div>
      )}
    </li>
  )
}
