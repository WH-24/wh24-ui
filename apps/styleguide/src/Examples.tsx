import { useMemo, useState, type ReactNode } from 'react'
import {
  Avatar,
  Chip,
  Combobox,
  ConfirmProvider,
  DateField,
  Drawer,
  FieldGrid,
  FieldRow,
  Icon,
  IconButton,
  Input,
  Kanban,
  ListPage,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  Modal,
  MultiCombobox,
  PageHeader,
  RecordCard,
  SegmentedControl,
  Spinner,
  Tabs,
  Textarea,
  ToastProvider,
  useConfirm,
  useToast,
  type FilterBarConfig,
  type KanbanColumn,
  type ListColumn,
} from '@wowhaus-24/ui-react'

/**
 * Сборные экраны: список с фильтром, канбан, карточка записи, окна и поля —
 * на двух наборах данных. «Обычные» — как в макете; «Худшие» — то, что
 * приходит в жизни: длинные имена, почта без пробелов, один символ, пусто,
 * тысячи вариантов. Набор выбирается переключателем внизу экрана и живёт в
 * адресе (`?data=worst`) — перезагрузка его сохраняет.
 */

type Mode = 'demo' | 'worst'

interface Lead {
  id: string
  name: string
  company: string
  email: string
  owner: string
  stage: string
  sum: number
  tags: string[]
}

const STAGES: KanbanColumn[] = [
  { id: 'new', title: 'Новые', tone: 'info' },
  { id: 'talk', title: 'Переговоры', tone: 'terra' },
  { id: 'offer', title: 'КП отправлено', tone: 'neutral' },
  { id: 'won', title: 'Договор', tone: 'good' },
  { id: 'lost', title: 'Отказ', tone: 'bad' },
]

const WORST_STAGES: KanbanColumn[] = [
  { id: 'new', title: 'Новые входящие обращения с сайта и по телефону', tone: 'info' },
  { id: 'talk', title: 'Переговоры', tone: 'terra' },
  { id: 'offer', title: 'КП отправлено/Менеджер ОС', tone: 'neutral' },
  { id: 'won', title: 'Договор', tone: 'good' },
  { id: 'lost', title: 'Отказ', tone: 'bad' },
  ...Array.from({ length: 16 }, (_, i) => ({ id: `x${i}`, title: `Дополнительная стадия ${i + 1}`, tone: 'neutral' as const })),
]

const DEMO: Lead[] = [
  { id: '1', name: 'Школа на 1100 мест', company: 'Аквилон', email: 'zakaz@akvilon.example', owner: 'Анна Соколова', stage: 'new', sum: 12_400_000, tags: ['школа'] },
  { id: '2', name: 'ЖК «Тобол», корпус 3', company: 'Тобол-Девелопмент', email: 'info@tobol.example', owner: 'Илья Громов', stage: 'talk', sum: 48_000_000, tags: ['жильё', 'срочно'] },
  { id: '3', name: 'Парк «Речной»', company: 'Администрация района', email: 'park@city.example', owner: 'Ольга Демченко', stage: 'offer', sum: 7_250_000, tags: ['благоустройство'] },
  { id: '4', name: 'Офис на Литейном', company: 'Северная верфь', email: 'office@verf.example', owner: 'Павел Ефимов', stage: 'won', sum: 3_100_000, tags: [] },
  { id: '5', name: 'Детский сад на 220 мест', company: 'Аквилон', email: 'zakaz@akvilon.example', owner: 'Анна Соколова', stage: 'new', sum: 9_800_000, tags: ['сад'] },
]

const WORST: Lead[] = [
  {
    id: '1',
    name: 'Многофункциональный общественно-деловой комплекс с подземной автостоянкой и встроенно-пристроенными помещениями, 2-я очередь, корректировка',
    company: 'Общество с ограниченной ответственностью «Специализированный застройщик „Северо-Западная инвестиционная компания“»',
    email: 'bartholomew.fitzgerald-wisniewska@northwind-industries-holdings.example.com',
    owner: 'Александра Вишневская-Ковальчик',
    stage: 'new',
    sum: 1_284_000_000,
    tags: ['customer-feedback-from-enterprise-onboarding', 'срочно', 'согласование-с-комитетом-по-градостроительству'],
  },
  { id: '2', name: 'Я', company: '', email: '', owner: 'Ю', stage: 'new', sum: 0, tags: [] },
  {
    id: '3',
    name: 'Договор_№214/2026-ГП-СМР-корректировка_версия_для_согласования_финал_исправлено.pdf',
    company: 'ИП Ли',
    email: 'a@b.ru',
    owner: '🦊 Лиса Патрикеевна',
    stage: 'offer',
    sum: 1,
    tags: ['x'],
  },
  ...Array.from({ length: 60 }, (_, i) => ({
    id: `m${i}`,
    name: `Объект № ${i + 1}: реконструкция здания общеобразовательной школы`,
    company: `Заказчик ${i + 1}`,
    email: `zakazchik.${i + 1}@very-long-corporate-domain-name.example.org`,
    owner: i % 3 ? 'Константин Константинопольский' : 'Ян Ли',
    stage: WORST_STAGES[i % 5]!.id,
    sum: 1_000_000 * (i + 1),
    tags: i % 4 ? [] : ['жильё'],
  })),
]

const money = new Intl.NumberFormat('ru-RU')

function readMode(): Mode {
  try {
    return new URLSearchParams(window.location.search).get('data') === 'worst' ? 'worst' : 'demo'
  } catch {
    return 'demo'
  }
}

function writeMode(mode: Mode) {
  const url = new URL(window.location.href)
  if (mode === 'worst') url.searchParams.set('data', 'worst')
  else url.searchParams.delete('data')
  window.history.replaceState(null, '', url)
}

function OverlayButtons({ worst }: { worst: boolean }) {
  const confirm = useConfirm()
  const toast = useToast()
  const [modal, setModal] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const title = worst
    ? 'Договор_№214/2026-ГП-СМР-корректировка_версия_для_согласования_финал_исправлено.pdf'
    : 'Новый лид'
  const form = <FormFields worst={worst} idPrefix="ov" />
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <button type="button" className="btn btn-secondary" onClick={() => setModal(true)}>
        Окно
      </button>
      <button type="button" className="btn btn-secondary" onClick={() => setDrawer(true)}>
        Боковая панель
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() =>
          void confirm({
            message: worst
              ? 'Удалить «Многофункциональный общественно-деловой комплекс с подземной автостоянкой» и все 1 284 связанных файла? Это действие нельзя отменить.'
              : 'Удалить лид «Школа на 1100 мест»?',
          })
        }
      >
        Подтверждение (удаление)
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => void confirm({ message: 'Отправить отчёт на согласование?', tone: 'primary' })}
      >
        Подтверждение (обычное)
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() =>
          worst
            ? toast.error(
                'Не удалось сохранить: https://api.wowhaus24.example/v1/leads/00000000-0000-0000-0000-000000000000/files?version=12 вернул 502',
                { action: { label: 'Повторить', onClick: () => {} } },
              )
            : toast.success('Лид сохранён')
        }
      >
        Уведомление
      </button>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={title}
        maxWidth={480}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>
              Отмена
            </button>
            {worst && (
              <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>
                Сохранить черновик
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={() => setModal(false)}>
              {worst ? 'Сохранить и закрыть' : 'Сохранить'}
            </button>
          </>
        }
      >
        {form}
      </Modal>
      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        title={title}
        width={560}
        actions={
          <button type="button" className="btn btn-ghost btn-sm">
            Открыть
          </button>
        }
      >
        {form}
      </Drawer>
    </div>
  )
}

function FormFields({ worst, idPrefix }: { worst: boolean; idPrefix: string }) {
  const people = useMemo(
    () =>
      worst
        ? [
            { value: 'p0', label: 'Александра Вишневская-Ковальчик', hint: 'bartholomew.fitzgerald@northwind-industries-holdings.example.com', avatar: 'https://example.invalid/broken.png' },
            { value: 'p1', label: '🦊 Лиса Патрикеевна', avatar: null },
            ...Array.from({ length: 5000 }, (_, i) => ({ value: `e${i}`, label: `Сотрудник № ${i + 1}`, avatar: null })),
          ]
        : [
            { value: 'p0', label: 'Анна Соколова', avatar: null },
            { value: 'p1', label: 'Илья Громов', avatar: null },
            { value: 'p2', label: 'Ольга Демченко', avatar: null },
          ],
    [worst],
  )
  const tags = useMemo(
    () =>
      worst
        ? [
            { value: 't0', label: 'customer-feedback-from-enterprise-onboarding' },
            ...Array.from({ length: 300 }, (_, i) => ({ value: `t${i + 1}`, label: `Тег ${i + 1}` })),
          ]
        : ['школа', 'жильё', 'срочно', 'сад'].map((t) => ({ value: t, label: t })),
    [worst],
  )
  const [owner, setOwner] = useState(worst ? 'удалённый-сотрудник-id-4411' : 'p0')
  const [picked, setPicked] = useState<string[]>(worst ? tags.slice(0, 40).map((t) => t.value) : ['школа'])
  const [date, setDate] = useState(worst ? '2026-11-14T00:00:00Z' : '2026-11-14')
  return (
    <FieldGrid>
      <FieldRow label="Название" htmlFor={`${idPrefix}-name`} required span={12}>
        <Input id={`${idPrefix}-name`} defaultValue={worst ? WORST[0]!.name : DEMO[0]!.name} />
      </FieldRow>
      <FieldRow
        label={worst ? 'Грузополучатель/Грузоотправитель' : 'Ответственный'}
        htmlFor={`${idPrefix}-owner`}
        span={4}
        hint={worst ? 'Сотрудник,которогоуженетвсправочнике,показываетсяидентификатором' : undefined}
      >
        <Combobox id={`${idPrefix}-owner`} options={people} value={owner} onChange={setOwner} />
      </FieldRow>
      <FieldRow label="Срок" span={4} error={worst ? 'Дата раньше сегодняшней: https://wiki.wowhaus24.example/reglament/sroki-soglasovaniya' : undefined}>
        <DateField value={date} onChange={setDate} ariaLabel="Срок" invalid={worst} />
      </FieldRow>
      <FieldRow label="Сумма" htmlFor={`${idPrefix}-sum`} span={4}>
        <Input id={`${idPrefix}-sum`} defaultValue={worst ? '1 284 000 000,000000001' : '12 400 000'} />
      </FieldRow>
      <FieldRow label="Теги" span={12}>
        <MultiCombobox options={tags} values={picked} onChange={setPicked} placeholder="Добавить тег" />
      </FieldRow>
      <FieldRow label="Комментарий" htmlFor={`${idPrefix}-note`} span={12}>
        <Textarea id={`${idPrefix}-note`} defaultValue={worst ? WORST[0]!.company : ''} />
      </FieldRow>
      <FieldRow label="Недоступное поле" htmlFor={`${idPrefix}-off`} span={6}>
        <Input id={`${idPrefix}-off`} defaultValue="Только чтение" disabled />
      </FieldRow>
      <FieldRow label="Недоступный список" span={6}>
        <Combobox options={people.slice(0, 3)} value="p1" onChange={() => {}} disabled />
      </FieldRow>
    </FieldGrid>
  )
}

export function Examples({ section }: { section: (title: string, desc: string, body: ReactNode) => ReactNode }) {
  const [mode, setModeState] = useState<Mode>(readMode)
  const setMode = (m: Mode) => {
    setModeState(m)
    writeMode(m)
  }
  const worst = mode === 'worst'
  const leads = worst ? WORST : DEMO
  const stages = worst ? WORST_STAGES : STAGES
  const [items, setItems] = useState<Record<Mode, Lead[]>>({ demo: DEMO, worst: WORST })
  const [tab, setTab] = useState('all')
  const [seg, setSeg] = useState('mine')
  const [stage, setStage] = useState('talk')
  const [menuWatch, setMenuWatch] = useState(true)

  const columns: ListColumn<Lead>[] = [
    {
      key: 'name',
      label: 'Название',
      primary: true,
      render: (r) => r.name,
      sortValue: (r) => r.name,
    },
    { key: 'company', label: 'Заказчик', render: (r) => r.company || '—', sortValue: (r) => r.company },
    { key: 'email', label: 'Почта', render: (r) => r.email || '—' },
    {
      key: 'owner',
      label: 'Ответственный',
      render: (r) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0, maxWidth: '100%' }}>
          <Avatar name={r.owner} size={24} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.owner}</span>
        </span>
      ),
      sortValue: (r) => r.owner,
    },
    { key: 'sum', label: 'Сумма, ₽', render: (r) => money.format(r.sum), sortValue: (r) => String(r.sum).padStart(12, '0') },
  ]
  const filterConfig: FilterBarConfig<Lead> = {
    scope: `styleguide-leads-${mode}`,
    search: { placeholder: 'Фильтр и поиск', get: (r) => `${r.name} ${r.company} ${r.email}` },
    fields: [
      {
        key: 'stage',
        label: worst ? 'Стадия воронки продаж (подкатегория проекта)' : 'Стадия',
        type: 'multiselect',
        options: stages.map((s) => ({ value: s.id, label: s.title })),
        get: (r) => r.stage,
      },
      {
        key: 'owner',
        label: 'Ответственный',
        type: 'select',
        options: Array.from(new Set(leads.map((l) => l.owner))).map((o) => ({ value: o, label: o })),
        get: (r) => r.owner,
      },
      { key: 'company', label: 'Заказчик', type: 'text', get: (r) => r.company },
      { key: 'due', label: 'Срок', type: 'daterange', get: (r) => `2026-11-${String(10 + (Number(r.id) % 18)).padStart(2, '0')}` },
    ],
    defaultFields: ['stage', 'owner', 'company', 'due'],
  }

  const tabs = worst
    ? [
        { id: 'all', label: 'Все обращения', count: 1284 },
        { id: 'mine', label: 'Мои', count: 0 },
        { id: 'wait', label: 'Ожидают согласования руководителем', count: 99999 },
        { id: 'late', label: 'Просроченные', count: 12 },
        { id: 'arch', label: 'Архив за прошлые годы', count: 31007 },
        { id: 'trash', label: 'Корзина' },
      ]
    : [
        { id: 'all', label: 'Все', count: 12 },
        { id: 'mine', label: 'Мои', count: 3 },
        { id: 'arch', label: 'Архив' },
      ]
  const segs = worst
    ? ['Согласование', 'На доработке', 'Отклонённые', 'Утверждённые', 'Черновики'].map((l, i) => ({ value: `s${i}`, label: l, count: i * 400 }))
    : [
        { value: 'mine', label: 'Мои' },
        { value: 'team', label: 'Отдела' },
        { value: 'all', label: 'Все' },
      ]

  const lead = leads[0]!
  const board = (
    <Kanban
      columns={stages}
      items={items[mode]}
      getId={(l) => l.id}
      getColumn={(l) => l.stage}
      getLabel={(l) => l.name}
      onMove={(l, to) => setItems((s) => ({ ...s, [mode]: s[mode].map((x) => (x.id === l.id ? { ...x, stage: to } : x)) }))}
      onOpen={() => {}}
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

  return (
    <ConfirmProvider>
      <ToastProvider>
        {section(
          'Заголовок страницы, вкладки, переключатель',
          'PageHeader + Tabs + SegmentedControl: счётчики одного вида, перенос кнопок, длинные подписи.',
          <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
            <PageHeader
              title={worst ? lead.name : 'Лиды'}
              count={worst ? 1284 : 12}
              subtitle={worst ? lead.email : 'Входящие обращения'}
              actions={
                <>
                  <button type="button" className="btn btn-secondary">
                    Экспорт
                  </button>
                  {worst && (
                    <>
                      <button type="button" className="btn btn-secondary">
                        Импорт из 1С
                      </button>
                      <button type="button" className="btn btn-secondary">
                        Настроить воронку
                      </button>
                      <button type="button" className="btn btn-secondary" disabled>
                        Недоступно
                      </button>
                    </>
                  )}
                  <button type="button" className="btn btn-primary">
                    <Icon name="plus" size={14} /> Добавить
                  </button>
                </>
              }
            />
            <Tabs tabs={tabs} value={tab} onChange={setTab} ariaLabel="Разделы" idPrefix="ex" />
            <SegmentedControl options={segs} value={seg} onChange={setSeg} ariaLabel="Чьи" />
          </div>,
        )}

        {section(
          'Список с фильтром',
          'ListPage: таблица, фильтр, настройка колонок, карточки и доска. В «худших» данных — 63 строки, длинные названия, пустые ячейки.',
          <div style={{ height: 680, display: 'flex', border: '1px solid var(--bd)', borderRadius: 'var(--r-lg)', overflow: 'hidden', background: 'var(--bg)' }}>
            <ListPage
              key={mode}
              title="Лиды"
              subtitle={worst ? 'Все обращения за всё время' : undefined}
              data={leads}
              getId={(r) => r.id}
              columns={columns}
              filterConfig={filterConfig}
              selectable
              onRowClick={() => {}}
              renderCard={(r) => (
                <div style={{ padding: 12, border: '1px solid var(--bd)', borderRadius: 'var(--r-lg)', background: 'var(--surf)', minWidth: 0, overflowWrap: 'anywhere' }}>
                  <b style={{ fontWeight: 600 }}>{r.name}</b>
                  <div style={{ color: 'var(--ink-3)', fontSize: 'var(--fs-meta)' }}>{r.company || '—'}</div>
                </div>
              )}
              renderBoard={() => board}
            />
          </div>,
        )}

        {section('Канбан', 'Kanban: точка цвета перед названием колонки, счётчик, меню «Переместить в…».', board)}

        {section(
          'Карточка записи',
          'RecordCard: шапка, показатели, меню «⋯», полоса стадий, вкладки и поля.',
          <div style={{ border: '1px solid var(--bd)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
            <RecordCard
              crumbs={[{ label: 'Лиды', onClick: () => {} }, { label: worst ? lead.company : 'Аквилон' }]}
              title={lead.name}
              idLabel={worst ? '№ 2026-11-000001284' : '№ 214'}
              kpis={[
                { label: 'Сумма', value: `${money.format(lead.sum)} ₽` },
                { label: 'Ответственный', value: lead.owner },
                { label: 'Почта', value: lead.email || '—' },
              ]}
              pyrusUrl="https://pyrus.example/t/1"
              menu={[
                { id: 'edit', label: 'Изменить', onSelect: () => {} },
                { id: 'copy', label: 'Создать копию', hint: 'Ctrl D', onSelect: () => {} },
                ...(worst
                  ? Array.from({ length: 25 }, (_, i) => ({
                      id: `a${i}`,
                      label: `Передать в отдел № ${i + 1} (проектная группа генплана и транспорта)`,
                      onSelect: () => {},
                    }))
                  : []),
                'sep' as const,
                { id: 'del', label: 'Удалить', danger: true, onSelect: () => {} },
              ]}
              stages={stages.map((s) => ({
                value: s.id,
                label: s.title,
                group: s.id === 'won' ? ('success' as const) : s.id === 'lost' ? ('fail' as const) : ('work' as const),
              }))}
              stage={stage}
              onStage={setStage}
              left={{
                label: 'Лента',
                tabs: [
                  { id: 'chat', label: 'Обсуждение', count: worst ? 1284 : 3 },
                  { id: 'files', label: 'Файлы', count: 2 },
                ],
                render: (t) => (
                  <div style={{ padding: 16, color: 'var(--ink-3)', overflowWrap: 'anywhere' }}>
                    {t === 'chat' ? (worst ? lead.email : 'Сообщений пока нет') : 'Файлов нет'}
                  </div>
                ),
              }}
              right={{
                label: 'Поля',
                tabs: [
                  { id: 'main', label: 'Основное' },
                  { id: 'extra', label: worst ? 'Дополнительные сведения о заказчике' : 'Дополнительно' },
                ],
                render: () => (
                  <div style={{ padding: 16 }}>
                    <FormFields worst={worst} idPrefix="rec" />
                  </div>
                ),
              }}
            />
          </div>,
        )}

        {section('Окна и уведомления', 'Modal, Drawer, подтверждение (подпись кнопки — по тону), уведомление.', <OverlayButtons worst={worst} />)}

        {section(
          'Меню, кнопка-значок, кольцо ожидания',
          'Menu — одно на библиотеку (значок, пояснение, сочетание клавиш, флажок, недоступный и опасный пункт); IconButton 32 и 24; Spinner четырёх размеров.',
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
            <Menu
              label="Действия с записью"
              trigger={
                <IconButton ariaLabel="Действия с записью">
                  <Icon name="more" size={16} />
                </IconButton>
              }
            >
              <MenuLabel>Запись</MenuLabel>
              <MenuItem icon={<Icon name="pen" size={14} />} shortcut="E">
                {worst ? 'Изменить карточку записи и все связанные с ней документы' : 'Изменить'}
              </MenuItem>
              <MenuItem icon={<Icon name="folder" size={14} />} hint="в архив">
                Переместить
              </MenuItem>
              <MenuItem disabled>Согласовать</MenuItem>
              <MenuSeparator />
              <MenuItem checked={menuWatch} keepOpen onSelect={() => setMenuWatch((v) => !v)}>
                На контроле
              </MenuItem>
              <MenuSeparator />
              <MenuItem danger icon={<Icon name="trash" size={14} />}>
                Удалить
              </MenuItem>
            </Menu>
            <Menu
              label="Ещё"
              align="start"
              trigger={
                <button type="button" className="btn btn-secondary btn-sm">
                  Меню от левого края
                </button>
              }
            >
              {(worst ? Array.from({ length: 25 }, (_, i) => `Пункт ${i + 1}`) : ['Первый', 'Второй', 'Третий']).map((t) => (
                <MenuItem key={t}>{t}</MenuItem>
              ))}
            </Menu>
            <IconButton size={24} ariaLabel="Настроить">
              <Icon name="settings" size={14} />
            </IconButton>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
              <Spinner size={12} />
              <Spinner />
              <Spinner size={24} />
              <Spinner size={32} label="Загрузка" />
            </span>
          </div>,
        )}

        {section(
          'Поля формы',
          'FieldGrid в узком месте (360px): колонки схлопываются по ширине контейнера, а не окна.',
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0, 1fr)' }}>
            <FormFields worst={worst} idPrefix="wide" />
            <div style={{ width: 'min(360px, 100%)', padding: 12, border: '1px dashed var(--bd-strong)', borderRadius: 'var(--r-lg)' }}>
              <FormFields worst={worst} idPrefix="narrow" />
            </div>
          </div>,
        )}

        {/* Служебный переключатель набора данных — не часть библиотеки. */}
        <div
          role="group"
          aria-label="Набор данных"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 12,
            transform: 'translateX(-50%)',
            zIndex: 'var(--z-toast)',
            display: 'flex',
            gap: 2,
            padding: 2,
            borderRadius: 999,
            background: '#d9d9d9',
            font: '12px system-ui, sans-serif',
          }}
        >
          {(['demo', 'worst'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              style={{
                padding: '6px 12px',
                border: 0,
                borderRadius: 999,
                background: mode === m ? '#fff' : 'transparent',
                color: '#111',
                font: 'inherit',
                cursor: 'pointer',
              }}
            >
              {m === 'demo' ? 'Обычные данные' : 'Худшие данные'}
            </button>
          ))}
        </div>
      </ToastProvider>
    </ConfirmProvider>
  )
}
