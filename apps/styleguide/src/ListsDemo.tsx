import { useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import {
  Chip,
  Combobox,
  DateField,
  FieldGrid,
  FieldRow,
  Input,
  Kanban,
  ListPage,
  ModuleLayout,
  ModuleNavList,
  SaveIndicator,
  SegmentedControl,
  Switch,
  useConfirm,
  useToast,
  type FilterBarConfig,
  type KanbanColumn,
  type ListColumn,
  type ListSavedView,
  type SaveState,
} from '@wowhaus-24/ui-react'

/**
 * Живые примеры шага 5 (принятый макет): виды-вкладки, фильтр плашками,
 * массовые действия, правка в ячейке, плавный переезд строк, канбан с суммой,
 * сворачиванием, быстрым добавлением и местом вставки, поля-призраки с
 * отметкой сохранения, нижняя навигация на телефоне.
 */

export interface Lead {
  id: string
  name: string
  company: string
  email: string
  owner: string
  stage: string
  sum: number
  tags: string[]
}

const money = new Intl.NumberFormat('ru-RU')
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const short = (sum: number) =>
  sum >= 1_000_000 ? `${(sum / 1_000_000).toFixed(1).replace('.', ',')} млн ₽` : sum ? `${money.format(sum)} ₽` : '—'

interface DemoProps {
  worst: boolean
  mode: string
  rows: Lead[]
  setRows: Dispatch<SetStateAction<Lead[]>>
  stages: KanbanColumn[]
}

export function LeadsBoard({ rows, setRows, stages, full }: DemoProps & { full: boolean }) {
  const toast = useToast()
  return (
    <Kanban
      columns={stages}
      items={rows}
      getId={(l) => l.id}
      getColumn={(l) => l.stage}
      getLabel={(l) => l.name}
      onMove={(l, to) => setRows((s) => s.map((x) => (x.id === l.id ? { ...x, stage: to } : x)))}
      onOpen={() => {}}
      {...(full
        ? {
            columnSummary: (_c: KanbanColumn, list: Lead[]) => short(list.reduce((a, l) => a + l.sum, 0)),
            collapsible: true,
            dropPlaceholder: true,
            animateChanges: true,
            onReorder: (l: Lead, beforeId: string | null) =>
              setRows((s) => {
                const rest = s.filter((x) => x.id !== l.id)
                const at = beforeId ? rest.findIndex((x) => x.id === beforeId) : -1
                if (at >= 0) return [...rest.slice(0, at), l, ...rest.slice(at)]
                // В конец своей колонки: после последней её карточки.
                const last = rest.map((x) => x.stage).lastIndexOf(l.stage)
                return [...rest.slice(0, last + 1), l, ...rest.slice(last + 1)]
              }),
            onQuickAdd: async (columnId: string, title: string) => {
              await sleep(400)
              setRows((s) => [
                ...s,
                { id: `n${Date.now()}`, name: title, company: '', email: '', owner: 'Тимур Шакиров', stage: columnId, sum: 0, tags: [] },
              ])
              toast.success(`Лид «${title}» добавлен`)
            },
          }
        : {})}
      renderCard={(l) => (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <b style={{ fontWeight: 600 }}>{l.name}</b>
          <small style={{ color: 'var(--ink-3)' }}>{l.email || 'почта не указана'}</small>
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {l.tags.map((t) => (
              <Chip key={t} variant="tag">
                {t}
              </Chip>
            ))}
          </span>
        </span>
      )}
    />
  )
}

export function LeadsList({ worst, mode, rows, setRows, stages, columns, filterConfig, board }: DemoProps & {
  columns: ListColumn<Lead>[]
  filterConfig: FilterBarConfig<Lead>
  board: ReactNode
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [filterVariant, setFilterVariant] = useState<'chips' | 'panel'>('chips')
  const [failing, setFailing] = useState(false)
  const [save, setSave] = useState<SaveState>('idle')
  const owners = Array.from(new Set(rows.map((l) => l.owner))).map((o) => ({ value: o, label: o }))
  const stageOptions = stages.map((s) => ({ value: s.id, label: s.title }))
  const [views, setViews] = useState<ListSavedView[]>(() => {
    const initial: ListSavedView[] = [
      { id: 'all', label: worst ? 'Все обращения за всё время работы' : 'Все', state: {} },
      { id: 'talk', label: 'Переговоры', state: { stage: [stages[1]!.id] } },
      { id: 'none', label: 'Нет таких', state: { company: 'такого заказчика нет' } },
    ]
    return initial
  })

  /** «Сервер»: полсекунды думает; с включённой ошибкой — отказывает. */
  const commit = async (id: string, patch: Partial<Lead>) => {
    setSave('saving')
    await sleep(600)
    if (failing) {
      setSave('error')
      throw new Error('Сервер не сохранил изменение')
    }
    setRows((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    setSave('saved')
  }

  const cols: ListColumn<Lead>[] = columns.map((c) =>
    c.key === 'company'
      ? { ...c, edit: { type: 'text' as const, getValue: (r: Lead) => r.company, onCommit: (r: Lead, v: string) => commit(r.id, { company: v }) } }
      : c.key === 'owner'
        ? { ...c, edit: { type: 'select' as const, options: owners, getValue: (r: Lead) => r.owner, onCommit: (r: Lead, v: string) => commit(r.id, { owner: v }) } }
        : c,
  )
  cols.splice(2, 0, {
    key: 'stage',
    label: 'Стадия',
    render: (r) => stages.find((s) => s.id === r.stage)?.title ?? r.stage,
    sortValue: (r) => r.stage,
    edit: { type: 'select', options: stageOptions, getValue: (r) => r.stage, onCommit: (r, v) => commit(r.id, { stage: v }) },
  })

  return (
    <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <SegmentedControl
          ariaLabel="Вид фильтра"
          value={filterVariant}
          onChange={setFilterVariant}
          options={[
            { value: 'chips', label: 'Фильтр плашками' },
            { value: 'panel', label: 'Фильтр панелью' },
          ]}
        />
        <Switch checked={failing} onChange={setFailing}>
          Сервер отвечает ошибкой
        </Switch>
        <SaveIndicator state={save} />
      </div>
      <div style={{ height: 680, display: 'flex', border: '1px solid var(--bd)', borderRadius: 'var(--r-lg)', overflow: 'hidden', background: 'var(--bg)' }}>
        <ListPage
          key={`${mode}-${filterVariant}`}
          title="Лиды"
          subtitle={worst ? 'Все обращения за всё время' : 'Заказчик, стадия и ответственный меняются прямо в таблице'}
          data={rows}
          getId={(r) => r.id}
          columns={cols}
          filterConfig={filterConfig}
          filterVariant={filterVariant}
          views={views}
          onSaveView={(name, state) => {
            setViews((v) => [...v, { id: `v${Date.now()}`, label: name, state }])
            toast.success(`Вид «${name}» сохранён`)
          }}
          selectable
          animateChanges
          onRowClick={() => {}}
          onEditError={(e) => toast.error(e instanceof Error ? e.message : 'Не сохранилось')}
          onBulkError={(e) => toast.error(e instanceof Error ? e.message : 'Не получилось')}
          bulkActions={[
            {
              label: 'Изменить стадию',
              choices: stageOptions,
              onRun: async (ids, stage) => {
                await sleep(400)
                if (failing) throw new Error('Сервер не изменил стадию')
                const back = rows
                setRows((s) => s.map((x) => (ids.includes(x.id) ? { ...x, stage: stage! } : x)))
                toast.info(`Изменено записей: ${ids.length}`, { action: { label: 'Отменить', onClick: () => setRows(back) } })
              },
            },
            {
              label: 'Выгрузить',
              icon: 'download',
              keepSelection: true,
              onRun: (ids) => {
                toast.success(`Файл готов: ${ids.length} строк`)
              },
            },
            {
              label: 'Удалить',
              icon: 'trash',
              tone: 'danger',
              onRun: async (ids) => {
                // Отказ — не ошибка: `false` оставляет выбор.
                if (!(await confirm({ title: 'Удалить лиды?', message: `Будет удалено записей: ${ids.length}.` }))) return false
                const back = rows
                setRows((s) => s.filter((x) => !ids.includes(x.id)))
                toast.info(`Удалено записей: ${ids.length}`, { action: { label: 'Вернуть', onClick: () => setRows(back) } })
              },
            },
          ]}
          renderCard={(r) => (
            <div style={{ padding: 12, border: '1px solid var(--bd)', borderRadius: 'var(--r-lg)', background: 'var(--surf)', minWidth: 0, overflowWrap: 'anywhere' }}>
              <b style={{ fontWeight: 600 }}>{r.name}</b>
              <div style={{ color: 'var(--ink-3)', fontSize: 'var(--fs-meta)' }}>{r.company || '—'}</div>
            </div>
          )}
          renderBoard={() => board}
        />
      </div>
    </div>
  )
}

/** Панель свойств с полями-призраками: правка на месте, сохранение само. */
export function GhostPanel({ worst, lead, onSave }: { worst: boolean; lead: Lead; onSave: () => void }) {
  const [company, setCompany] = useState(lead.company)
  const [owner, setOwner] = useState(lead.owner)
  const [due, setDue] = useState('2026-12-01')
  const owners = [lead.owner, 'Тимур Шакиров', 'Анна Соколова'].map((o) => ({ value: o, label: o }))
  return (
    <FieldGrid>
      <FieldRow label={worst ? 'Заказчик (юридическое лицо по договору)' : 'Заказчик'} htmlFor="ghost-company" span={12}>
        <Input
          id="ghost-company"
          variant="ghost"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          onBlur={onSave}
        />
      </FieldRow>
      <FieldRow label="Ответственный" span={12}>
        <Combobox
          variant="ghost"
          options={owners}
          value={owner}
          clearable={false}
          inputAriaLabel="Ответственный"
          onChange={(v) => {
            setOwner(v)
            onSave()
          }}
        />
      </FieldRow>
      <FieldRow label="Срок" span={12}>
        <DateField
          variant="ghost"
          ariaLabel="Срок"
          value={due}
          onChange={(v) => {
            setDue(v)
            onSave()
          }}
        />
      </FieldRow>
    </FieldGrid>
  )
}

/** Нижняя навигация модуля на телефоне (до 640px) — включается переключателем. */
export function BottomNavDemo({ worst }: { worst: boolean }) {
  const [on, setOn] = useState(false)
  const [active, setActive] = useState('leads')
  const items = [
    { id: 'leads', label: worst ? 'Лиды и входящие обращения' : 'Лиды', icon: 'inbox' as const, shortLabel: 'Лиды', count: worst ? 1284 : 3 },
    { id: 'projects', label: 'Проекты', icon: 'briefcase' as const },
    { id: 'people', label: worst ? 'Сотрудники и подрядчики' : 'Сотрудники', icon: 'users' as const, shortLabel: 'Люди' },
    { id: 'reports', label: 'Отчёты', icon: 'chart' as const },
    ...(worst ? [{ id: 'settings', label: 'Настройки модуля', icon: 'settings' as const, shortLabel: 'Ещё' }] : []),
  ]
  return (
    <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
      <Switch checked={on} onChange={setOn}>
        Нижняя навигация (видна на экране до 640px)
      </Switch>
      <div style={{ border: '1px solid var(--bd)', borderRadius: 'var(--r-lg)', overflow: 'hidden', minHeight: 160, display: 'flex' }}>
        <ModuleLayout
          title="Отдел управления проектами"
          icon="briefcase"
          mobileNav={on ? 'bottom' : 'top'}
          nav={<ModuleNavList items={items} activeId={active} onSelect={setActive} />}
        >
          <div style={{ padding: 16, color: 'var(--ink-3)' }}>
            Раздел: {items.find((i) => i.id === active)?.label}. На широком экране панель слева, до 900px — полоса вкладок,
            до 640px с переключателем — панель внизу.
          </div>
        </ModuleLayout>
      </div>
    </div>
  )
}
