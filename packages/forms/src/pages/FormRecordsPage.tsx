/**
 * FormRecordsPage — экран B: список записей ОДНОЙ формы как обычная страница
 * модуля-владельца. Без роутинга и chrome (панель раздела, топбар) — это даёт
 * хост.
 *
 * Единый вид списков (владелец, 17.11.2026, макет
 * https://claude.ai/artifact/8uyyTwVpkgEtThZqxZJUU9): страница — общий `ListPage`
 * в серверном режиме (`remote`), как «Проекты»: шапка с описанием и числом
 * записей, кнопки строкой слева, одно поле поиска с фильтрами-плашками
 * («На контроле», «Статус», поля-списки формы), шестерёнка колонок в шапке
 * таблицы, догрузка при прокрутке без кнопок страниц. Поиск, фильтры и
 * сортировку считает сервер (GET /forms/:id/records: search, watching, status,
 * f.<id поля>, sort).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Avatar,
  Icon,
  ListPage,
  type BulkAction,
  type FilterBarConfig,
  type FilterFieldDef,
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
  fieldOptions,
  formatDateTime,
  formatValue,
  isBlank,
  isNumericType,
  optionLabel,
  plural,
  type FormatContext,
} from '../render/format.js'
import { DEFAULT_RECORD_STATUSES, StatusPill, statusLabel, type StatusLabel } from './StatusPill.js'
import { Banner } from './states.js'
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
  /** Сколько записей брать с сервера за раз (догрузка при прокрутке). */
  pageSize?: number
  statusLabels?: Record<string, StatusLabel>
  /** Заголовок; по умолчанию page_title формы, иначе name. */
  title?: string
  /** Дополнительные кнопки шапки. */
  actions?: ReactNode
  /** Ключ настроек колонок в localStorage; по умолчанию id формы. */
  storageKey?: string
  /** Не используется: первая загрузка — скелет строк общего списка. Оставлено для совместимости. */
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
   * Виды — вкладки над тулбаром. Условия вида — те же ключи, что у плашек:
   * `q`, `watching`, `status`, `f:<id поля>`. Счётчик — только у выбранной
   * вкладки: число остальных знает лишь сервер.
   */
  views?: ReadonlyArray<ListSavedView>
  /** Выбранный вид (управляемо). Без него список ведёт выбор сам. */
  viewId?: string | null
  onViewChange?: (id: string) => void
  /** Вид фильтра; по умолчанию — плашки, как у всех списков (17.11.2026). */
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

type Sort = NonNullable<ListRecordsQuery['sort']>

/** Колонки, которые сортирует сервер, → его ключ сортировки. */
const SORT_KEYS: Record<string, [Sort, Sort]> = {
  number: ['number_asc', 'number_desc'],
  title: ['title_asc', 'title_desc'],
  updated_at: ['updated_at_asc', 'updated_at_desc'],
}
/** Поля-списки, по которым сервер умеет фильтровать (значение или массив значений). */
const FILTER_TYPES = new Set(['select', 'multiselect', 'catalog', 'user', 'department'])
const STATUS_KEY = 'status'
const FIELD_PREFIX = 'f:'

const listOf = (v: FilterState[string] | undefined): string[] =>
  Array.isArray(v) ? v.filter(Boolean) : typeof v === 'string' && v ? [v] : []

/** Условия плашек → запрос к серверу. */
export function recordsQuery(filter: FilterState): Pick<ListRecordsQuery, 'search' | 'watching' | 'status' | 'filters'> {
  const q = typeof filter.q === 'string' ? filter.q.trim() : ''
  const filters: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(filter)) {
    if (!k.startsWith(FIELD_PREFIX)) continue
    const vals = listOf(v)
    if (vals.length) filters[k.slice(FIELD_PREFIX.length)] = vals
  }
  const status = listOf(filter[STATUS_KEY])
  return {
    search: q || undefined,
    watching: watchOf(filter) || undefined,
    status: status.length ? status : undefined,
    filters: Object.keys(filters).length ? filters : undefined,
  }
}

type Load = {
  rows: FormRecord[]
  total: number
  page: number
  loading: boolean
  loadingMore: boolean
  error: FormsApiError | Error | null
}

function Cell({ field, value, ctx }: { field: Field; value: unknown; ctx: FormatContext }) {
  if (isBlank(value)) return <span className={styles.muted}>—</span>
  switch (field.type) {
    case 'user': {
      const label = optionLabel(field, String(value), ctx)
      return (
        <span className={styles.cellUser}>
          <Avatar
            size={24}
            name={label}
            src={ctx.staff?.find((o) => o.id === String(value))?.photo}
            aria-hidden="true"
          />
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
  pageSize = 50,
  statusLabels = DEFAULT_RECORD_STATUSES,
  title,
  actions,
  storageKey,
  extraColumns,
  onRowsChange,
  views,
  viewId,
  onViewChange,
  filterVariant = 'chips',
  selectable = false,
  bulkActions,
  bulkLabels,
  onBulkError,
  reloadKey = 0,
}: FormRecordsPageProps) {
  const [load, setLoad] = useState<Load>({
    rows: [],
    total: 0,
    page: 0,
    loading: true,
    loadingMore: false,
    error: null,
  })
  const query = useRef<{ filter: FilterState; sort: Sort } | null>(null)
  const ticket = useRef(0)

  const fetchPage = useCallback(
    (page: number) => {
      const q = query.current
      if (!q) return
      const my = ++ticket.current
      setLoad((prev) =>
        page === 1
          ? { ...prev, loading: true, loadingMore: false, error: null }
          : { ...prev, loadingMore: true, error: null },
      )
      api.records
        .list(form.id, { ...recordsQuery(q.filter), sort: q.sort, page, limit: pageSize })
        .then((res) => {
          if (my !== ticket.current) return
          setLoad((prev) => ({
            rows: page === 1 ? res.data : [...prev.rows, ...res.data.filter((r) => !prev.rows.some((p) => p.id === r.id))],
            total: res.total,
            page,
            loading: false,
            loadingMore: false,
            error: null,
          }))
        })
        .catch((error: unknown) => {
          if (my !== ticket.current) return
          setLoad((prev) => ({
            ...prev,
            loading: false,
            loadingMore: false,
            error: error instanceof Error ? error : new Error(String(error)),
          }))
        })
    },
    [api, form.id, pageSize],
  )

  // Хост попросил перечитать (после массового действия) — те же условия, с начала.
  const firstReload = useRef(true)
  useEffect(() => {
    if (firstReload.current) {
      firstReload.current = false
      return
    }
    fetchPage(1)
  }, [reloadKey, fetchPage])

  // Хосту — набор строк, только когда он изменился (по id), а не на каждый рендер.
  const rowsCb = useRef(onRowsChange)
  rowsCb.current = onRowsChange
  const lastRowsKey = useRef<string | null>(null)
  useEffect(() => {
    if (load.loading || load.error) return
    const key = load.rows.map((r) => r.id).join('\u0001')
    if (key === lastRowsKey.current) return
    lastRowsKey.current = key
    rowsCb.current?.(load.rows)
  }, [load])

  // ─── Фильтр плашками ───
  const filterConfig = useMemo<FilterBarConfig<FormRecord>>(() => {
    const fields: FilterFieldDef<FormRecord>[] = [
      { key: WATCH_KEY, label: 'На контроле', type: 'boolean', get: () => null },
      {
        key: STATUS_KEY,
        label: 'Статус',
        type: 'multiselect',
        options: Object.entries(statusLabels).map(([value, l]) => ({ value, label: l.label })),
        get: (r) => r.status,
      },
    ]
    for (const f of schema.fields) {
      if (f.archived || !FILTER_TYPES.has(f.type)) continue
      const options =
        f.type === 'user' || f.type === 'department'
          ? ((f.type === 'user' ? ctx.staff : ctx.departments) ?? []).map((o) => ({ value: o.id, label: o.label }))
          : fieldOptions(f, ctx).map((o) => ({ value: o.value, label: o.label }))
      if (options.length === 0) continue
      fields.push({
        key: `${FIELD_PREFIX}${f.id}`,
        label: f.label || f.key,
        type: 'multiselect',
        options,
        optional: true,
        get: () => null,
      })
    }
    return {
      scope: `wh24-forms:records:${storageKey ?? form.id}`,
      search: { placeholder: 'Поиск по названию', get: (r) => r.title },
      fields,
      defaultFields: [WATCH_KEY, STATUS_KEY],
    }
  }, [schema.fields, statusLabels, ctx, storageKey, form.id])

  // ─── Колонки ───
  const columns = useMemo<ListColumn<FormRecord>[]>(() => {
    const cols: ListColumn<FormRecord>[] = [
      {
        key: 'number',
        label: '№',
        width: 72,
        minWidth: 72,
        className: styles.num,
        render: (r) => r.number,
        sortValue: (r) => String(r.number),
      },
      {
        key: 'title',
        label: 'Название',
        primary: true,
        render: (r) => (
          <span className={styles.name} title={r.title}>
            {r.title || <span className={styles.muted}>Без названия</span>}
          </span>
        ),
        sortValue: (r) => r.title,
      },
    ]
    for (const f of schema.fields) {
      if (f.archived || !f.show_in_list || f.type === 'section' || f.type === 'note') continue
      cols.push({
        key: `f:${f.id}`,
        label: f.label || f.key,
        minWidth: f.type === 'user' || f.type === 'textarea' ? 200 : 150,
        className: isNumericType(f.type) ? styles.right : undefined,
        render: (r) => (
          <Cell
            field={f}
            value={
              f.type === 'lookup'
                ? r.lookups?.[f.id]
                : isComputedField(f)
                  ? systemValue(f, { record: r, formName: form.name, staff: ctx.staff })
                  : r.data?.[f.id]
            }
            ctx={ctx}
          />
        ),
      })
    }
    // Колонки хоста — после схемных. Чужой ключ (схемный или служебный) пропускаем: иначе
    // два столбца делили бы одну настройку видимости. Сортирует сервер — у них её нет.
    const taken = new Set([...cols.map((c) => c.key), 'status', 'updated_at'])
    for (const x of extraColumns ?? []) {
      if (!x.key || taken.has(x.key)) continue
      taken.add(x.key)
      cols.push({
        ...x,
        sortValue: undefined,
        minWidth: x.minWidth ?? (typeof x.width === 'number' ? x.width : 220),
        render: (r) => (
          // Кнопка или ссылка в ячейке хоста («Повторить», раскрыть текст) — не открытие записи.
          <span
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('button, a')) e.stopPropagation()
            }}
          >
            {x.render(r)}
          </span>
        ),
      })
    }
    cols.push({
      key: 'status',
      label: 'Статус',
      width: 150,
      minWidth: 130,
      render: (r) => {
        const st = statusLabel(r.status, statusLabels)
        return <StatusPill tone={st.tone}>{st.label}</StatusPill>
      },
    })
    cols.push({
      key: 'updated_at',
      label: 'Обновлено',
      width: 160,
      minWidth: 150,
      className: styles.muted,
      render: (r) => formatDateTime(r.updated_at),
      sortValue: (r) => r.updated_at,
    })
    return cols
  }, [schema.fields, extraColumns, statusLabels, ctx, form.name])

  const remote = useMemo(
    () => ({
      total: load.total,
      hasMore: !load.loading && !load.error && load.rows.length < load.total,
      loadingMore: load.loadingMore,
      onLoadMore: () => fetchPage(load.page + 1),
      onQueryChange: ({ filter, sort }: { filter: FilterState; sort: { key: string; dir: 'asc' | 'desc' } }) => {
        const pair = SORT_KEYS[sort.key]
        query.current = { filter, sort: pair ? pair[sort.dir === 'asc' ? 0 : 1] : 'created_at_desc' }
        fetchPage(1)
      },
    }),
    [load, fetchPage],
  )

  const csv = exportHref === undefined ? api.records.exportCsvUrl(form.id) : exportHref
  const published = form.status === 'published'
  const heading = title ?? (form.page_title || form.name)
  const ready = !load.loading && !load.error
  const subtitle = [form.description, ready ? plural(load.total, 'запись', 'записи', 'записей') : '']
    .filter(Boolean)
    .join(' · ')

  const e = load.error
  const errorText = !e
    ? undefined
    : e instanceof FormsApiError && e.forbidden
      ? 'Нет доступа к записям. Права на записи дают ролью в модуле-владельце формы — обратитесь к администратору модуля.'
      : e instanceof FormsApiError && e.notFound
        ? 'Форма не найдена: возможно, она удалена или перенесена.'
        : e instanceof FormsApiError && e.unavailable
          ? 'Сервис временно недоступен: модуль-владелец не отвечает. Это не отказ в доступе — повторите позже.'
          : 'Не удалось загрузить записи. Проверьте соединение — поиск и фильтры сохранены.'

  return (
    <div className={styles.recordsPage}>
      {form.status === 'archived' && (
        <Banner tone="warn">Форма в архиве — записи доступны только для чтения.</Banner>
      )}
      {form.status === 'draft' && (
        <Banner tone="warn">Форма ещё не опубликована — записей в ней быть не может.</Banner>
      )}
      <ListPage<FormRecord>
        title={heading}
        subtitle={subtitle || undefined}
        data={load.rows}
        getId={(r) => r.id}
        columns={columns}
        filterConfig={filterConfig}
        filterVariant={filterVariant}
        defaultSort={{ key: 'number', dir: 'desc' }}
        onRowClick={onOpen}
        loading={load.loading}
        error={load.rows.length === 0 ? errorText : undefined}
        onRetry={() => fetchPage(1)}
        remote={remote}
        pageSize={pageSize}
        views={views}
        viewId={viewId}
        onViewChange={onViewChange}
        selectable={selectable && Boolean(bulkActions?.length)}
        bulkActions={bulkActions}
        bulkLabels={bulkLabels}
        onBulkError={onBulkError}
        emptyIcon="list"
        emptyTitle="Пока нет записей"
        emptyDescription={published ? 'Создайте первую — она появится в этом списке.' : undefined}
        emptyAction={
          canCreate && published && onCreate ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={onCreate}>
              Создать
            </button>
          ) : undefined
        }
        toolbarStart={() => (
          <div className={styles.listActions}>
            {canCreate && published && onCreate && (
              <button type="button" className="btn btn-primary btn-sm" onClick={onCreate}>
                <Icon name="plus" size={14} /> Создать
              </button>
            )}
            {csv && ready && load.total > 0 && (
              <a className="btn btn-secondary btn-sm" href={csv} download>
                <Icon name="download" size={14} /> Экспорт
              </a>
            )}
            {actions}
          </div>
        )}
      />
    </div>
  )
}
