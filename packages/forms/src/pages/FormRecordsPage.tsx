/**
 * FormRecordsPage — экран B: список записей ОДНОЙ формы как обычная страница
 * модуля-владельца. Без роутинга и chrome (панель раздела, топбар) — это даёт
 * хост; здесь шапка страницы, тулбар, таблица и серверный пейджер.
 *
 * Данные — серверные: поиск, страница, размер, сортировка уходят в
 * GET /forms/:id/records. Фильтры по значению поля бэкенд в HTTP не проводит
 * (Этап 2+) — чипов фильтров здесь пока нет, а не «сделаны на клиенте по
 * текущей странице»: такой фильтр врал бы про остальные 25 страниц.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Icon, Input } from '@wowhaus-24/ui-react'

import { FormsApiError, type FormsApi, type ListRecordsQuery } from '../api.js'
import type { Field, Form, FormRecord, SchemaDocument } from '../types.js'
import {
  formatDateTime,
  formatValue,
  initials,
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
}

type Sort = NonNullable<ListRecordsQuery['sort']>

interface Column {
  key: string
  label: string
  field?: Field
  align?: 'left' | 'right'
  width?: number | string
  /** Скрываемая через меню «Колонки». */
  toggleable: boolean
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
          <span className={styles.cellAvatar} aria-hidden>
            {initials(label)}
          </span>
          <span className={styles.name} style={{ fontWeight: 400 }}>
            {label}
          </span>
        </span>
      )
    }
    case 'multiselect': {
      const items = Array.isArray(value) ? value.map(String) : []
      const shown = items.slice(0, 2)
      return (
        <span className={styles.cellChips}>
          {shown.map((v) => (
            <span key={v} className={styles.chip}>
              {optionLabel(field, v, ctx)}
            </span>
          ))}
          {items.length > shown.length && (
            <span className={styles.more}>+{items.length - shown.length}</span>
          )}
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
  pageSize: initialPageSize = 50,
  statusLabels = DEFAULT_RECORD_STATUSES,
  title,
  actions,
  storageKey,
}: FormRecordsPageProps) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [searchText, setSearchText] = useState('')
  const search = useDebounced(searchText.trim(), 300)
  const [sort, setSort] = useState<Sort>('created_at_desc')
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [reloadTick, setReloadTick] = useState(0)

  // Поиск и сортировка возвращают на первую страницу: страница 7 нового
  // результата — это не «то же место», а случайный срез.
  useEffect(() => setPage(1), [search, sort, pageSize])

  const abortRef = useRef(0)
  useEffect(() => {
    const ticket = ++abortRef.current
    setLoad((prev) => (prev.kind === 'ready' ? prev : { kind: 'loading' }))
    api.records
      .list(form.id, { search: search || undefined, page, limit: pageSize, sort })
      .then((res) => {
        if (ticket !== abortRef.current) return
        setLoad({ kind: 'ready', rows: res.data, total: res.total })
      })
      .catch((error: unknown) => {
        if (ticket !== abortRef.current) return
        setLoad({ kind: 'error', error: error instanceof Error ? error : new Error(String(error)) })
      })
  }, [api, form.id, search, page, pageSize, sort, reloadTick])

  const retry = useCallback(() => {
    setLoad({ kind: 'loading' })
    setReloadTick((t) => t + 1)
  }, [])

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
    cols.push({ key: 'status', label: 'Статус', width: 150, toggleable: true })
    cols.push({ key: 'updated_at', label: 'Обновлено', width: 150, toggleable: true })
    return cols
  }, [schema.fields])

  const colsKey = `wh24-forms:cols:${storageKey ?? form.id}`
  const [hidden, setHidden] = useState<string[]>(() => readHidden(colsKey))
  const [colsOpen, setColsOpen] = useState(false)
  const toggleCol = (key: string) => {
    const next = hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key]
    setHidden(next)
    writeHidden(colsKey, next)
  }
  const visibleCols = columns.filter((c) => !hidden.includes(c.key))

  const toggleSort = () => setSort((s) => (s === 'number_desc' ? 'number_asc' : 'number_desc'))

  const csv = exportHref === undefined ? api.records.exportCsvUrl(form.id) : exportHref
  const published = form.status === 'published'
  const heading = title ?? (form.page_title || form.name)
  const total = load.kind === 'ready' ? load.total : null

  const renderBody = () => {
    if (load.kind === 'loading') return <Skeleton />
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
              {visibleCols.map((c) => (
                <col key={c.key} style={c.width ? { width: c.width } : undefined} />
              ))}
            </colgroup>
            <thead>
              <tr>
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
                <tr key={r.id} onClick={onOpen ? () => onOpen(r) : undefined}>
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
                    return (
                      <td key={c.key} className={c.align === 'right' ? styles.right : undefined}>
                        <Cell field={c.field!} value={r.data?.[c.field!.id]} ctx={ctx} />
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

      <div className={styles.toolbar}>
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
        <span className={styles.spacer} />
        <div className={styles.colsWrap}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-label="Колонки"
            aria-expanded={colsOpen}
            onClick={() => setColsOpen((v) => !v)}
          >
            <Icon name="settings" size={14} /> Колонки
          </button>
          {colsOpen && (
            <div className={styles.colsMenu} role="menu" onMouseLeave={() => setColsOpen(false)}>
              {columns.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={!hidden.includes(c.key)}
                  className={styles.colsItem}
                  disabled={!c.toggleable}
                  onClick={() => toggleCol(c.key)}
                >
                  <span style={{ width: 14, display: 'inline-flex' }}>
                    {!hidden.includes(c.key) && <Icon name="check" size={12} />}
                  </span>
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {renderBody()}
    </div>
  )
}
