/**
 * FormRecordsPage — экран B: список записей ОДНОЙ формы как обычная страница
 * модуля-владельца. Без роутинга и chrome (панель раздела, топбар) — это даёт
 * хост; здесь шапка страницы, тулбар, таблица и серверный пейджер.
 *
 * Данные — серверные: поиск, страница, размер, сортировка уходят в
 * GET /forms/:id/records. Фильтры по значению поля бэкенд в HTTP не проводит
 * (Этап 2+) — плашки фильтра (`filterVariant="chips"`) несут только поиск и
 * «На контроле», а не «сделаны на клиенте по
 * текущей странице»: такой фильтр врал бы про остальные 25 страниц.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Avatar,
  BulkActionBar,
  Checkbox,
  FilterBar,
  Icon,
  Input,
  Menu,
  MenuItem,
  Tabs,
  type BulkAction,
  type FilterBarConfig,
  type FilterState,
  type ListBulkLabels,
  type ListColumn,
  type ListSavedView,
} from '@wowhaus-24/ui-react'

import { FormsApiError, type FormsApi, type ListRecordsQuery } from '../api.js'
import type { Field, Form, FormRecord, SchemaDocument } from '../types.js'
import { isComputedField, sectionColorHex } from '../types.js'
import { systemValue } from '../render/system.js'
import {
  formatDateTime,
  formatValue,
  isBlank,
  isNumericType,
  optionLabel,
  plural,
  type FormatContext,
} from '../render/format.js'
import { Pager } from './Pager.js'
import { DEFAULT_RECORD_STATUSES, StatusPill, statusLabel, type StatusLabel } from './StatusPill.js'
import { Banner, Skeleton, StateBox } from './states.js'
import styles from './pages.module.css'

export interface FormRecordsPageProps {
  form: Form
  /** Схема текущей опубликованной версии — из неё колонки (show_in_list). */
  schema: SchemaDocument
  api: FormsApi
  ctx?: FormatContext
  /** Право писать в модуле-владельце — показывает «Создать». */
  canCreate?: boolean
  onOpen?: (record: FormRecord) => void
  onCreate?: () => void
  /** Ссылка на CSV. По умолчанию — api.records.exportCsvUrl(form.id); null — не показывать. */
  exportHref?: string | null
  pageSize?: number
  statusLabels?: Record<string, StatusLabel>
  /** Заголовок; по умолчанию page_title формы, иначе name. */
  title?: string
  /** Дополнительные кнопки шапки. */
  actions?: ReactNode
  /** Ключ настроек колонок в localStorage; по умолчанию id формы. */
  storageKey?: string
  /** Индикатор первой загрузки (например, лоадер портала); по умолчанию — скелет строк. */
  loader?: ReactNode
  /**
   * Дополнительные колонки хоста (например, «Поля ИИ»): рисуются после колонок
   * схемы, перед «Статус» и «Обновлено», и участвуют в меню «Колонки». Берутся
   * `key`, `label`, `render`, `width` (иначе `minWidth`, иначе 220), `className` и
   * `headerActions`; сортировка в них не поддерживается — сортирует сервер.
   * Ключ не должен совпадать со служебными (`number`, `title`, `status`,
   * `updated_at`) и схемными (`f:<id>`): колонка с чужим ключом пропускается.
   * Клик по кнопке или ссылке внутри ячейки не открывает запись.
   */
  extraColumns?: ListColumn<FormRecord>[]
  /**
   * Набор строк текущей страницы поменялся: после загрузки, смены страницы,
   * поиска или фильтра «На контроле». Зовётся только при изменении набора
   * (сравнение по `id`), а не на каждый рендер, — по строкам хост запрашивает
   * данные для своих колонок. Пустая страница — пустой массив. При ошибке
   * загрузки не вызывается.
   */
  onRowsChange?: (rows: FormRecord[]) => void

  // ── Виды, фильтр-плашки, массовые действия (всё по желанию; без них — как раньше) ──
  /**
   * Виды — вкладки над тулбаром. Сервер записей понимает только поиск и «На
   * контроле», поэтому из условий вида берутся `q` (строка) и `watching`
   * (любое непустое значение — «да»). Счётчик — только у выбранной вкладки:
   * число остальных знает лишь сервер.
   */
  views?: ReadonlyArray<ListSavedView>
  /** Выбранный вид (управляемо). Без него список ведёт выбор сам. */
  viewId?: string | null
  onViewChange?: (id: string) => void
  /**
   * `chips` — поиск и «На контроле» плашкой (общий `FilterBar variant="chips"`)
   * вместо поля поиска и кнопки «На контроле».
   */
  filterVariant?: 'panel' | 'chips'
  /** Флажки у строк текущей страницы (нужен для `bulkActions`). */
  selectable?: boolean
  /** Панель массовых действий снизу (общий `BulkActionBar`). */
  bulkActions?: ReadonlyArray<BulkAction>
  bulkLabels?: ListBulkLabels
  onBulkError?: (error: unknown, action: BulkAction) => void
  /** Сменился — список перечитывается с сервера (после массового действия хоста). */
  reloadKey?: number
}

/** Ключ «На контроле» в условиях вида и плашек. */
const WATCH_KEY = 'watching'
const watchOf = (state: FilterState | undefined) => {
  const v = state?.[WATCH_KEY]
  return v != null && v !== false && v !== '' && !(Array.isArray(v) && v.length === 0)
}
const NO_FIELDS: string[] = []
const noop = () => undefined

type Sort = NonNullable<ListRecordsQuery['sort']>

interface Column {
  key: string
  label: string
  field?: Field
  align?: 'left' | 'right'
  width?: number | string
  /** Скрываемая через меню «Колонки». */
  toggleable: boolean
  /** Колонка хоста (`extraColumns`): ячейку и действия заголовка рисует хост. */
  extra?: ListColumn<FormRecord>
}

type Load =
  | { kind: 'loading' }
  | { kind: 'ready'; rows: FormRecord[]; total: number }
  | { kind: 'error'; error: FormsApiError | Error }

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return v
}

function readHidden(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    const arr = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function writeHidden(key: string, hidden: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(hidden))
  } catch {
    /* приватный режим / нет места — настройка просто не переживёт перезагрузку */
  }
}

function Cell({ field, value, ctx }: { field: Field; value: unknown; ctx: FormatContext }) {
  if (isBlank(value)) return <span className={styles.muted}>—</span>
  switch (field.type) {
    case 'user': {
      const label = optionLabel(field, String(value), ctx)
      return (
        <span className={styles.cellUser}>
          <Avatar size={24} name={label} aria-hidden="true" />
          <span className={styles.name} style={{ fontWeight: 400 }}>
            {label}
          </span>
        </span>
      )
    }
    case 'multiselect':
    case 'tags': {
      const items = Array.isArray(value) ? value.map(String) : []
      const shown = items.slice(0, 2)
      const text = (v: string) => (field.type === 'tags' ? v : optionLabel(field, v, ctx))
      return (
        <span className={styles.cellChips}>
          {shown.map((v) => (
            <span key={v} className={styles.chip}>
              {text(v)}
            </span>
          ))}
          {items.length > shown.length && (
            <span className={styles.more}>+{items.length - shown.length}</span>
          )}
        </span>
      )
    }
    case 'percent': {
      const n = typeof value === 'number' ? Math.max(0, Math.min(100, value)) : null
      if (n == null) return <>{formatValue(field, value, ctx)}</>
      return (
        <span className={styles.cellPercent}>
          <span>{formatValue(field, value, ctx)}</span>
          <span
            className={styles.cellBar}
            role="progressbar"
            aria-label={field.label || field.key}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={n}
          >
            <span className={styles.cellBarFill} style={{ width: `${n}%` }} />
          </span>
        </span>
      )
    }
    case 'color': {
      const hex = typeof value === 'string' ? sectionColorHex(value) : undefined
      return (
        <span className={styles.cellColor}>
          {hex && <span className={styles.cellSwatch} style={{ background: hex }} aria-hidden />}
          {formatValue(field, value, ctx)}
        </span>
      )
    }
    case 'file': {
      const n = Array.isArray(value) ? value.length : 0
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Icon name="folder" size={13} />
          {plural(n, 'файл', 'файла', 'файлов')}
        </span>
      )
    }
    case 'link': {
      const v = String(value)
      // Ссылкой — только http(s); остальное текстом (валидатор такое не пускает,
      // но данные могли прийти из импорта).
      return /^https?:\/\//i.test(v) ? (
        <a href={v} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
          {v}
        </a>
      ) : (
        <>{v}</>
      )
    }
    default:
      return <>{formatValue(field, value, ctx)}</>
  }
}

export function FormRecordsPage({
  form,
  schema,
  api,
  ctx = {},
  canCreate = false,
  onOpen,
  onCreate,
  exportHref,
  loader,
  pageSize: initialPageSize = 50,
  statusLabels = DEFAULT_RECORD_STATUSES,
  title,
  actions,
  storageKey,
  extraColumns,
  onRowsChange,
  views,
  viewId: viewIdProp,
  onViewChange,
  filterVariant = 'panel',
  selectable = false,
  bulkActions,
  bulkLabels,
  onBulkError,
  reloadKey = 0,
}: FormRecordsPageProps) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)
  // Стартовые условия — из выбранного вида (если он задан).
  const startView = views?.find((v) => v.id === viewIdProp) ?? views?.[0]
  const [searchText, setSearchText] = useState(() =>
    typeof startView?.state.q === 'string' ? startView.state.q : '',
  )
  const search = useDebounced(searchText.trim(), 300)
  const [sort, setSort] = useState<Sort>('created_at_desc')
  // «На контроле» — записи, отмеченные флажком в ленте записи.
  const [watching, setWatching] = useState(() => watchOf(startView?.state))
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [reloadTick, setReloadTick] = useState(0)

  // Поиск и сортировка возвращают на первую страницу: страница 7 нового
  // результата — это не «то же место», а случайный срез.
  useEffect(() => setPage(1), [search, sort, pageSize, watching])

  const abortRef = useRef(0)
  useEffect(() => {
    const ticket = ++abortRef.current
    setLoad((prev) => (prev.kind === 'ready' ? prev : { kind: 'loading' }))
    api.records
      .list(form.id, { search: search || undefined, page, limit: pageSize, sort, watching: watching || undefined })
      .then((res) => {
        if (ticket !== abortRef.current) return
        setLoad({ kind: 'ready', rows: res.data, total: res.total })
      })
      .catch((error: unknown) => {
        if (ticket !== abortRef.current) return
        setLoad({ kind: 'error', error: error instanceof Error ? error : new Error(String(error)) })
      })
  }, [api, form.id, search, page, pageSize, sort, watching, reloadTick, reloadKey])

  // ─── Виды ───
  const [ownView, setOwnView] = useState<string | null>(startView?.id ?? null)
  const viewId = viewIdProp !== undefined ? viewIdProp : ownView
  const selectView = (id: string) => {
    const v = views?.find((x) => x.id === id)
    if (!v) return
    if (viewIdProp === undefined) setOwnView(id)
    onViewChange?.(id)
    setWatching(watchOf(v.state))
    // Поиск — не часть вида, если вид его не задаёт: набранный текст остаётся.
    if (typeof v.state.q === 'string') setSearchText(v.state.q)
  }

  // ─── Выбор строк ───
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const pageIds = useMemo(() => (load.kind === 'ready' ? load.rows.map((r) => r.id) : []), [load])
  // Выбор живёт в пределах страницы: ушедшие строки (другая страница, поиск, удаление) снимаются.
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev
      const keep = new Set(pageIds.filter((id) => prev.has(id)))
      return keep.size === prev.size ? prev : keep
    })
  }, [pageIds])
  const selectedIds = useMemo(() => pageIds.filter((id) => selected.has(id)), [pageIds, selected])
  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const allOnPage = pageIds.length > 0 && selectedIds.length === pageIds.length
  const toggleAll = () => setSelected(allOnPage ? new Set() : new Set(pageIds))
  const clearSelection = useCallback(() => setSelected(new Set()), [])

  // ─── Фильтр плашками ───
  const chipsConfig = useMemo<FilterBarConfig<FormRecord>>(
    () => ({
      scope: `wh24-forms:records:${storageKey ?? form.id}`,
      search: { placeholder: 'Поиск по названию', get: (r) => r.title },
      fields: [
        {
          key: WATCH_KEY,
          label: 'На контроле',
          type: 'select',
          options: [{ value: 'yes', label: 'Да' }],
          get: () => null,
        },
      ],
    }),
    [storageKey, form.id],
  )
  const chipsState = useMemo<FilterState>(
    () => ({ q: searchText, [WATCH_KEY]: watching ? 'yes' : null }),
    [searchText, watching],
  )
  const setChipsState = useCallback((st: FilterState) => {
    setSearchText(typeof st.q === 'string' ? st.q : '')
    setWatching(watchOf(st))
  }, [])

  const retry = useCallback(() => {
    setLoad({ kind: 'loading' })
    setReloadTick((t) => t + 1)
  }, [])

  // Хосту — набор строк, только когда он изменился (по id), а не на каждый рендер.
  const rowsCb = useRef(onRowsChange)
  rowsCb.current = onRowsChange
  const lastRowsKey = useRef<string | null>(null)
  useEffect(() => {
    if (load.kind !== 'ready') return
    const key = load.rows.map((r) => r.id).join('\u0001')
    if (key === lastRowsKey.current) return
    lastRowsKey.current = key
    rowsCb.current?.(load.rows)
  }, [load])

  // ─── Колонки ───
  const columns = useMemo<Column[]>(() => {
    const cols: Column[] = [
      { key: 'number', label: '№', width: 72, toggleable: false },
      { key: 'title', label: 'Название', toggleable: false },
    ]
    for (const f of schema.fields) {
      if (f.archived || !f.show_in_list || f.type === 'section' || f.type === 'note') continue
      cols.push({
        key: `f:${f.id}`,
        label: f.label || f.key,
        field: f,
        align: isNumericType(f.type) ? 'right' : 'left',
        toggleable: true,
      })
    }
    // Колонки хоста — после схемных. Чужой ключ (схемный или служебный) пропускаем: иначе
    // два столбца делили бы одну настройку видимости.
    const taken = new Set([...cols.map((c) => c.key), 'status', 'updated_at'])
    for (const x of extraColumns ?? []) {
      if (!x.key || taken.has(x.key)) continue
      taken.add(x.key)
      cols.push({
        key: x.key,
        label: x.label,
        width: x.width ?? x.minWidth ?? 220,
        toggleable: true,
        extra: x,
      })
    }
    cols.push({ key: 'status', label: 'Статус', width: 150, toggleable: true })
    cols.push({ key: 'updated_at', label: 'Обновлено', width: 150, toggleable: true })
    return cols
  }, [schema.fields, extraColumns])

  const colsKey = `wh24-forms:cols:${storageKey ?? form.id}`
  const [hidden, setHidden] = useState<string[]>(() => readHidden(colsKey))
  const toggleCol = (key: string) => {
    const next = hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key]
    setHidden(next)
    writeHidden(colsKey, next)
  }
  const visibleCols = columns.filter((c) => !hidden.includes(c.key))
  const withSelect = selectable && Boolean(bulkActions?.length)

  const toggleSort = () => setSort((s) => (s === 'number_desc' ? 'number_asc' : 'number_desc'))

  const csv = exportHref === undefined ? api.records.exportCsvUrl(form.id) : exportHref
  const published = form.status === 'published'
  const heading = title ?? (form.page_title || form.name)
  const total = load.kind === 'ready' ? load.total : null

  const renderBody = () => {
    if (load.kind === 'loading') return loader ?? <Skeleton />
    if (load.kind === 'error') {
      const e = load.error
      if (e instanceof FormsApiError && e.forbidden) {
        return (
          <StateBox
            icon="users"
            tone="warn"
            title="Нет доступа к записям"
            text="Права на записи дают ролью в модуле-владельце формы. Обратитесь к администратору модуля."
          />
        )
      }
      if (e instanceof FormsApiError && e.notFound) {
        return (
          <StateBox
            icon="search"
            title="Форма не найдена"
            text="Возможно, она удалена или перенесена."
          />
        )
      }
      if (e instanceof FormsApiError && e.unavailable) {
        return (
          <StateBox
            icon="bolt"
            tone="bad"
            title="Сервис временно недоступен"
            text="Не удалось проверить права: модуль-владелец не отвечает. Это не отказ в доступе — повторите позже."
            action={
              <button type="button" className="btn btn-secondary btn-sm" onClick={retry}>
                Повторить
              </button>
            }
          />
        )
      }
      return (
        <StateBox
          icon="bolt"
          tone="bad"
          title="Не удалось загрузить записи"
          text="Проверьте соединение. Поиск и страница сохранены — повтор вернёт вас на то же место."
          action={
            <button type="button" className="btn btn-secondary btn-sm" onClick={retry}>
              Повторить
            </button>
          }
        />
      )
    }
    if (load.total === 0 && watching) {
      return (
        <StateBox
          icon="list"
          title="На контроле ничего нет"
          text="Отметьте запись флажком в её ленте — она появится здесь."
          action={
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                const all = views?.find((v) => !watchOf(v.state))
                if (all) selectView(all.id)
                else setWatching(false)
              }}
            >
              Все записи
            </button>
          }
        />
      )
    }
    if (load.total === 0 && !search) {
      return (
        <StateBox
          icon="list"
          title="Пока нет записей"
          text={published ? 'Создайте первую — она появится в этом списке.' : undefined}
          action={
            canCreate && published && onCreate ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={onCreate}>
                Создать
              </button>
            ) : undefined
          }
        />
      )
    }
    if (load.total === 0) {
      return (
        <StateBox
          icon="search"
          title="Ничего не найдено"
          text="Попробуйте другую формулировку."
          action={
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSearchText('')}
            >
              Сбросить
            </button>
          }
        />
      )
    }
    return (
      <>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <colgroup>
              {withSelect && <col style={{ width: 40 }} />}
              {visibleCols.map((c) => (
                <col key={c.key} style={c.width ? { width: c.width } : undefined} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {withSelect && (
                  <th className={styles.selectCol}>
                    <Checkbox
                      checked={allOnPage}
                      indeterminate={selectedIds.length > 0 && !allOnPage}
                      onChange={toggleAll}
                      aria-label="Выбрать все записи страницы"
                    />
                  </th>
                )}
                {visibleCols.map((c) =>
                  c.key === 'number' ? (
                    <th
                      key={c.key}
                      className={[styles.sortable, styles.numCol].join(' ')}
                      aria-sort={
                        sort === 'number_asc'
                          ? 'ascending'
                          : sort === 'number_desc'
                            ? 'descending'
                            : 'none'
                      }
                      onClick={toggleSort}
                    >
                      {c.label}
                      {sort.startsWith('number') && (
                        <span className={styles.sortIcon}>
                          <Icon name={sort === 'number_asc' ? 'sortup' : 'sortdown'} size={11} />
                        </span>
                      )}
                    </th>
                  ) : c.extra ? (
                    <th key={c.key} className={c.extra.className}>
                      {c.extra.headerActions ? (
                        <span className={styles.thRow}>
                          <span className={styles.thLabel}>{c.label}</span>
                          <span
                            className={styles.thActions}
                            data-testid={`th-actions-${c.key}`}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            {c.extra.headerActions}
                          </span>
                        </span>
                      ) : (
                        c.label
                      )}
                    </th>
                  ) : (
                    <th key={c.key} className={c.align === 'right' ? styles.right : undefined}>
                      {c.label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {load.rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={onOpen ? () => onOpen(r) : undefined}
                  data-selected={withSelect ? String(selected.has(r.id)) : undefined}
                >
                  {withSelect && (
                    <td className={styles.selectCol} onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(r.id)}
                        onChange={() => toggleRow(r.id)}
                        aria-label={`Выбрать запись №${r.number}`}
                      />
                    </td>
                  )}
                  {visibleCols.map((c) => {
                    if (c.key === 'number')
                      return (
                        <td key={c.key} className={styles.num}>
                          {r.number}
                        </td>
                      )
                    if (c.key === 'title')
                      return (
                        <td key={c.key} className={styles.name} title={r.title}>
                          {r.title || <span className={styles.muted}>Без названия</span>}
                        </td>
                      )
                    if (c.key === 'status') {
                      const s = statusLabel(r.status, statusLabels)
                      return (
                        <td key={c.key}>
                          <StatusPill tone={s.tone}>{s.label}</StatusPill>
                        </td>
                      )
                    }
                    if (c.key === 'updated_at')
                      return (
                        <td key={c.key} className={styles.muted}>
                          {formatDateTime(r.updated_at)}
                        </td>
                      )
                    if (c.extra)
                      return (
                        <td
                          key={c.key}
                          className={c.extra.className}
                          // Кнопка или ссылка в ячейке хоста («Повторить», раскрыть текст) — не открытие записи.
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest('button, a')) e.stopPropagation()
                          }}
                        >
                          {c.extra.render(r)}
                        </td>
                      )
                    return (
                      <td key={c.key} className={c.align === 'right' ? styles.right : undefined}>
                        <Cell
                          field={c.field!}
                          value={
                            c.field!.type === 'lookup'
                              ? r.lookups?.[c.field!.id]
                              : isComputedField(c.field!)
                                ? systemValue(c.field!, { record: r, formName: form.name, staff: ctx.staff })
                                : r.data?.[c.field!.id]
                          }
                          ctx={ctx}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager
          page={page}
          pageSize={pageSize}
          total={load.total}
          onPage={setPage}
          onPageSize={setPageSize}
        />
      </>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headText}>
          <h1 className={styles.title}>
            {heading}
            {total != null && (
              <span className={styles.count}>{plural(total, 'запись', 'записи', 'записей')}</span>
            )}
          </h1>
          {form.description && <p className={styles.subtitle}>{form.description}</p>}
        </div>
        <div className={styles.actions}>
          {actions}
          {csv && total != null && total > 0 && (
            <a className="btn btn-secondary btn-sm" href={csv} download>
              <Icon name="download" size={14} /> CSV
            </a>
          )}
          {canCreate && published && onCreate && (
            <button type="button" className="btn btn-primary btn-sm" onClick={onCreate}>
              <Icon name="plus" size={14} /> Создать
            </button>
          )}
        </div>
      </div>

      {form.status === 'archived' && (
        <Banner tone="warn">Форма в архиве — записи доступны только для чтения.</Banner>
      )}
      {form.status === 'draft' && (
        <Banner tone="warn">Форма ещё не опубликована — записей в ней быть не может.</Banner>
      )}

      {views && views.length > 0 && (
        <Tabs
          tabs={views.map((v) => ({
            id: v.id,
            label: v.label,
            count: v.id === viewId && total != null ? total : undefined,
          }))}
          value={viewId ?? ''}
          onChange={selectView}
          ariaLabel="Виды списка"
          idPrefix={`wh24-forms-views-${form.id}`}
          className={styles.viewTabs}
        />
      )}

      <div className={styles.toolbar}>
        {filterVariant === 'chips' ? (
          <FilterBar<FormRecord>
            variant="chips"
            config={chipsConfig}
            state={chipsState}
            setState={setChipsState}
            fields={NO_FIELDS}
            setFields={noop}
          />
        ) : (
          <>
            <div className={styles.search}>
              <span className={styles.searchIcon}>
                <Icon name="search" size={14} />
              </span>
              <Input
                aria-label="Поиск по названию"
                placeholder="Поиск по названию"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
            <button
              type="button"
              className={['btn', 'btn-sm', watching ? 'btn-secondary' : 'btn-ghost'].join(' ')}
              aria-pressed={watching}
              onClick={() => setWatching((v) => !v)}
            >
              <Icon name="flag" size={14} /> На контроле
            </button>
          </>
        )}
        <span className={styles.spacer} />
        <Menu
          label="Колонки"
          trigger={
            <button type="button" className="btn btn-ghost btn-sm" aria-label="Колонки">
              <Icon name="settings" size={14} /> Колонки
            </button>
          }
        >
          {columns.map((c) => (
            <MenuItem
              key={c.key}
              checked={!hidden.includes(c.key)}
              disabled={!c.toggleable}
              keepOpen
              onSelect={() => toggleCol(c.key)}
            >
              {c.label}
            </MenuItem>
          ))}
        </Menu>
      </div>

      {renderBody()}

      {withSelect && (
        <BulkActionBar
          selectedIds={selectedIds}
          actions={bulkActions!}
          onClear={clearSelection}
          onError={onBulkError}
          countLabel={bulkLabels?.count}
          clearLabel={bulkLabels?.clear}
          ariaLabel={bulkLabels?.toolbar}
        />
      )}
    </div>
  )
}
