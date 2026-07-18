import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { Icon, type IconName } from './Icon.js'
import { FilterBar } from './filter/FilterBar.js'
import { useFilterState } from './filter/useFilterState.js'
import { matchItem } from './filter/matchItem.js'
import type { FilterBarConfig, FilterSettingsProvider } from './filter/types.js'
import styles from './ListPage.module.css'

/** Описание колонки списка: что в заголовке, как рендерить ячейку, как сортировать. */
export interface ListColumn<T> {
  /** Уникальный ключ (он же ключ сортировки). */
  key: string
  label: string
  /** Ширина в colgroup (число = px, строка = как есть, напр. "28%"). */
  width?: string | number
  /** Класс для <td> (например "mono"). */
  className?: string
  /** Содержимое ячейки. */
  render: (row: T) => ReactNode
  /** Значение для сортировки. Есть → колонка сортируемая. */
  sortValue?: (row: T) => string
}

interface SortState {
  key: string
  dir: 'asc' | 'desc'
}

export interface ListPageProps<T> {
  // Шапка.
  title: string
  subtitle?: string
  /** Число в бейдже у заголовка. По умолчанию — общее число строк (data.length). */
  count?: number

  // Данные.
  data: T[]
  getId: (row: T) => string
  columns: ListColumn<T>[]

  // Универсальный фильтр (Bitrix24-style) — обязателен (ядро страницы-списка).
  filterConfig: FilterBarConfig<T>
  /** Источник глобальных пресетов (бэкенд модуля). */
  filterSettings?: FilterSettingsProvider
  /** Админ модуля — может править набор полей и глобальные пресеты. */
  canEditFields?: boolean
  /** Внешний поиск (например из топбара). */
  externalSearch?: string

  // Поведение.
  onRowClick?: (row: T) => void
  selectable?: boolean
  pageSize?: number
  defaultSort?: SortState

  // Карточный вид (если задан — появляется переключатель список/карточки).
  renderCard?: (row: T) => ReactNode

  // Пустое состояние.
  emptyTitle?: string
  emptyIcon?: IconName

  // Слоты тулбара.
  /** Кнопки слева от фильтра (Добавить, Экспорт…). Получает отфильтрованные строки. */
  toolbarStart?: (ctx: { filtered: T[] }) => ReactNode
  /** Действия при выделении строк (массовое удаление…). */
  selectionActions?: (ctx: { selected: T[]; clear: () => void }) => ReactNode
}

/**
 * Универсальная страница-список: шапка со счётчиком, тулбар (фильтр + слоты),
 * сортируемая таблица с выбором, карточный вид, пагинация. Config-driven и
 * generic по T — модуль задаёт только колонки, конфиг фильтра и слоты.
 */
export function ListPage<T>({
  title,
  subtitle,
  count,
  data,
  getId,
  columns,
  filterConfig,
  filterSettings,
  canEditFields,
  externalSearch = '',
  onRowClick,
  selectable = false,
  pageSize = 20,
  defaultSort,
  renderCard,
  emptyTitle = 'Ничего не найдено',
  emptyIcon = 'search',
  toolbarStart,
  selectionActions,
}: ListPageProps<T>) {
  const {
    state: filter,
    setState: setFilter,
    fields: filterFields,
    setFields: setFilterFields,
  } = useFilterState(filterConfig)
  const [sort, setSort] = useState<SortState>(
    defaultSort ?? { key: columns[0]?.key ?? '', dir: 'asc' },
  )
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list')
  const [page, setPage] = useState(1)

  // ── Настройка колонок (шестерёнка в конце шапки) ──────────────────────────
  // Скрытые колонки запоминаются per-user в localStorage по scope фильтра.
  const colsKey = `wh24:list-cols:${filterConfig.scope}`
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(colsKey)
      return new Set(raw ? (JSON.parse(raw) as string[]) : [])
    } catch {
      return new Set()
    }
  })
  const [colsOpen, setColsOpen] = useState(false)
  const [colsPos, setColsPos] = useState<{ top: number; right: number } | null>(null)
  const gearRef = useRef<HTMLButtonElement>(null)

  // Переключать можно только именованные колонки (у служебных, напр. аватара,
  // label пустой — они всегда видимы).
  const toggleableCols = useMemo(() => columns.filter((c) => c.label.trim() !== ''), [columns])
  const visibleColumns = useMemo(
    () => columns.filter((c) => !hiddenCols.has(c.key)),
    [columns, hiddenCols],
  )
  const visibleToggleableCount = toggleableCols.filter((c) => !hiddenCols.has(c.key)).length

  const toggleCol = (key: string) =>
    setHiddenCols((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      try {
        localStorage.setItem(colsKey, JSON.stringify([...next]))
      } catch {
        /* приватный режим — настройка не сохранится, но UI работает */
      }
      return next
    })

  const openCols = () => {
    const r = gearRef.current?.getBoundingClientRect()
    // position:fixed — панель не режется overflow-прокруткой таблицы.
    if (r) setColsPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) })
    setColsOpen((v) => !v)
  }

  const colByKey = useMemo(() => new Map(columns.map((c) => [c.key, c])), [columns])

  // Любое изменение фильтра/поиска возвращает на первую страницу.
  useEffect(() => {
    setPage(1)
  }, [filter, externalSearch])

  const filtered = useMemo(() => {
    let list = data.filter((r) => matchItem(r, filter, filterConfig))
    const ext = externalSearch.trim().toLowerCase()
    if (ext && filterConfig.search) {
      list = list.filter((r) => filterConfig.search!.get(r).toLowerCase().includes(ext))
    }
    const col = colByKey.get(sort.key)
    if (col?.sortValue) {
      list = [...list].sort((a, b) => {
        const av = col.sortValue!(a)
        const bv = col.sortValue!(b)
        return (av > bv ? 1 : av < bv ? -1 : 0) * (sort.dir === 'asc' ? 1 : -1)
      })
    }
    return list
  }, [data, filter, filterConfig, externalSearch, sort, colByKey])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const toggleSort = (k: string) => {
    setSort((s) =>
      s.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'asc' },
    )
    setPage(1)
  }

  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const clearSelection = () => setSelected(new Set())
  const selectedRows = useMemo(
    () => filtered.filter((r) => selected.has(getId(r))),
    [filtered, selected, getId],
  )

  // +1 — служебная колонка с шестерёнкой в конце шапки.
  const colSpan = visibleColumns.length + 1 + (selectable ? 1 : 0)

  const empty = (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>
        <Icon name={emptyIcon} size={20} />
      </div>
      <div className={styles.emptyTitle}>{emptyTitle}</div>
      <div className={styles.emptyDesc}>Попробуйте изменить фильтры.</div>
    </div>
  )

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageTitle}>
            {title}
            <span className={styles.pageTitleCount}>{count ?? data.length}</span>
          </div>
          {subtitle && <div className={styles.pageSubtitle}>{subtitle}</div>}
        </div>
      </div>

      <div className={styles.toolbar}>
        {toolbarStart?.({ filtered })}

        {toolbarStart && <div className={styles.dividerV} />}

        <FilterBar
          config={filterConfig}
          state={filter}
          setState={setFilter}
          fields={filterFields}
          setFields={setFilterFields}
          canEditFields={canEditFields}
          settings={filterSettings}
        />

        <div style={{ flex: 1 }} />

        {selectable && selected.size > 0 && (
          <>
            <span className={styles.selectionCount}>{selected.size} выбрано</span>
            {selectionActions?.({ selected: selectedRows, clear: clearSelection })}
            <div className={styles.dividerV} />
          </>
        )}

        {renderCard && (
          <div className={styles.viewSwitch}>
            <button
              data-active={String(viewMode === 'list')}
              title="Таблица"
              onClick={() => setViewMode('list')}
            >
              <Icon name="list" size={14} />
            </button>
            <button
              data-active={String(viewMode === 'cards')}
              title="Карточки"
              onClick={() => setViewMode('cards')}
            >
              <Icon name="cards" size={14} />
            </button>
          </div>
        )}
      </div>

      {viewMode === 'list' && (
        <div className={styles.tableWrap}>
          <table className={styles.tbl}>
            <colgroup>
              {visibleColumns.map((c) => (
                <col key={c.key} style={{ width: c.width }} />
              ))}
              <col style={{ width: 44 }} />
            </colgroup>
            <thead>
              <tr>
                {visibleColumns.map((c, i) => {
                  // Первая колонка резервирует место под чекбокс-по-наведению.
                  const hostCls = selectable && i === 0 ? styles.colSelectHost : undefined
                  return c.sortValue ? (
                    <th
                      key={c.key}
                      className={hostCls}
                      data-sortable=""
                      data-sort={sort.key === c.key ? sort.dir : undefined}
                      onClick={() => toggleSort(c.key)}
                    >
                      {c.label}
                      <span className={styles.sortArrow}>
                        <Icon name={sort.dir === 'asc' ? 'sortup' : 'sortdown'} size={11} />
                      </span>
                    </th>
                  ) : (
                    <th key={c.key} className={hostCls}>
                      {c.label}
                    </th>
                  )
                })}
                <th className={styles.colGear}>
                  <button
                    ref={gearRef}
                    type="button"
                    className={styles.gearBtn}
                    title="Настроить колонки"
                    aria-label="Настроить колонки"
                    aria-expanded={colsOpen}
                    onClick={openCols}
                  >
                    <Icon name="settings" size={14} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={colSpan}>{empty}</td>
                </tr>
              ) : (
                paginated.map((row) => {
                  const id = getId(row)
                  return (
                    <tr
                      key={id}
                      data-selected={selectable ? String(selected.has(id)) : undefined}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                    >
                      {visibleColumns.map((c, i) => {
                        // В первой ячейке — чекбокс выбора (виден при наведении/выборе),
                        // отдельной колонки чекбоксов нет.
                        const host = selectable && i === 0
                        return (
                          <td
                            key={c.key}
                            className={[c.className, host ? styles.colSelectHost : '']
                              .filter(Boolean)
                              .join(' ')}
                          >
                            {host && (
                              <span
                                className={styles.cellSelectBox}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={selected.has(id)}
                                  onChange={() => toggleSelect(id)}
                                  aria-label="Выбрать строку"
                                />
                              </span>
                            )}
                            {c.render(row)}
                          </td>
                        )
                      })}
                      <td className={styles.colGear} />
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {colsOpen && colsPos && (
        <>
          <div className={styles.colsBackdrop} onClick={() => setColsOpen(false)} />
          <div
            className={styles.colsMenu}
            style={{ position: 'fixed', top: colsPos.top, right: colsPos.right }}
            role="dialog"
            aria-label="Настройка колонок"
          >
            <div className={styles.colsMenuTitle}>Колонки</div>
            {toggleableCols.map((c) => {
              const on = !hiddenCols.has(c.key)
              // Последнюю видимую колонку скрыть нельзя — иначе пустая таблица.
              const lockLast = on && visibleToggleableCount === 1
              return (
                <label key={c.key} className={styles.colsMenuItem}>
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={lockLast}
                    onChange={() => toggleCol(c.key)}
                  />
                  <span>{c.label}</span>
                </label>
              )
            })}
          </div>
        </>
      )}

      {viewMode === 'cards' &&
        renderCard &&
        (paginated.length === 0 ? (
          empty
        ) : (
          <div className={styles.listCardsGrid}>
            {paginated.map((row) => (
              <Fragment key={getId(row)}>{renderCard(row)}</Fragment>
            ))}
          </div>
        ))}

      <div className={styles.pager}>
        <div>
          Показано {paginated.length} из {filtered.length}
        </div>
        <div className={styles.pagerNav}>
          <button
            className={[styles.btn, styles.btnGhost, styles.btnSm].join(' ')}
            disabled={currentPage === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Назад
          </button>
          <span>
            Стр. {currentPage} из {totalPages}
          </span>
          <button
            className={[styles.btn, styles.btnGhost, styles.btnSm].join(' ')}
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Далее →
          </button>
        </div>
      </div>
    </div>
  )
}

export default ListPage
