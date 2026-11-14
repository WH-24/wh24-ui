import { useState, type ReactNode } from 'react'
import {
  Avatar,
  AvatarStack,
  Banner,
  Checkbox,
  CommandPalette,
  FileDrop,
  HoverCard,
  IconButton,
  Icon,
  NotificationCenter,
  Pager,
  ProgressBar,
  Skeleton,
  SkeletonRow,
  SkeletonText,
  StatusBadge,
  Switch,
  Tooltip,
  useCommandPaletteShortcut,
  type CommandItem,
  type FileDropItem,
  type NotificationItem,
} from '@wowhaus-24/ui-react'

/** Новые элементы по принятому макету (`mockups/components-mockup.html`). */

const NOTES: NotificationItem[] = [
  { id: '1', who: 'Анна Соколова', text: 'упомянула вас в проекте «Школа на 1100 мест»', time: '5 минут назад', unread: true },
  { id: '2', who: 'Ольга Демченко', text: 'согласовала отчёт времени за октябрь', time: 'час назад', unread: true },
  { id: '3', who: 'Павел Ефимов', text: 'загрузил модель в проект «ЖК «Аквилон», корпус 3»', time: 'вчера', unread: true },
  { id: '4', who: 'Светлана Лебедева', text: 'добавила вас в команду проекта «Парк «Речной»»', time: '12 ноября' },
]

const PEOPLE = ['Анна Соколова', 'Илья Громов', 'Павел Ефимов', 'Ольга Демченко', 'Никита Морозов', 'Дарья Ильина']

export function NewComponents({ section }: { section: (title: string, desc: string, body: ReactNode) => ReactNode }) {
  const [sw, setSw] = useState(true)
  const [cb, setCb] = useState(true)
  const [some, setSome] = useState<boolean[]>([true, false, false])
  const [page, setPage] = useState(3)
  const [banners, setBanners] = useState({ info: true, warn: true })
  const [notes, setNotes] = useState(NOTES)
  const [cmd, setCmd] = useState(false)
  const [last, setLast] = useState('—')
  const [progress, setProgress] = useState(40)
  const [files, setFiles] = useState<FileDropItem[]>([
    { id: '1', name: 'Договор № 214.pdf', size: 482_000, status: 'done' },
    { id: '2', name: 'Техзадание.docx', status: 'uploading', progress: 62 },
    { id: '3', name: 'Очень длинное название файла генерального плана, лист 3, версия для согласования.dwg', status: 'error' },
    { id: '4', name: 'Смета.xlsx', status: 'uploading' },
  ])
  useCommandPaletteShortcut(() => setCmd(true))

  const all = some.every(Boolean)
  const none = some.every((x) => !x)

  const commands: CommandItem[] = [
    { id: 'add', group: 'Действия', label: 'Добавить сотрудника', icon: 'plus', shortcut: 'Ctrl N' },
    { id: 'theme', group: 'Действия', label: 'Сменить тему', icon: 'sun' },
    { id: 'emp', group: 'Разделы', label: 'Сотрудники', icon: 'users' },
    { id: 'prj', group: 'Разделы', label: 'Проекты', icon: 'folder' },
    ...PEOPLE.slice(0, 3).map((name) => ({
      id: name,
      group: 'Сотрудники',
      label: name,
      subtitle: 'Главный архитектор проекта, мастерская № 2',
      avatar: { name },
    })),
  ]

  return (
    <>
      {section(
        'Tooltip',
        'Подсказка: первая через 350 мс, соседние — сразу; сочетание клавиш плашкой.',
        <div className="sg-row">
          <Tooltip label="Добавить" shortcut="Ctrl N">
            <span>
              <IconButton ariaLabel="Добавить" title="">
                <Icon name="plus" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip label="Фильтр">
            <span>
              <IconButton ariaLabel="Фильтр" title="">
                <Icon name="filter" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip label="Настройки" side="bottom">
            <span>
              <IconButton ariaLabel="Настройки" title="">
                <Icon name="settings" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip label="Очень длинная подсказка, которая переносится на несколько строк и не выходит за край окна">
            <button type="button" className="btn btn-secondary btn-sm">
              Длинная подсказка
            </button>
          </Tooltip>
        </div>,
      )}

      {section(
        'Switch · Checkbox',
        'Переключатель действует сразу; флажок — выбор в форме, с состоянием «выбрана часть».',
        <div className="sg-row">
          <Switch checked={sw} onChange={setSw}>
            Уведомления на почту
          </Switch>
          <Switch checked={false} onChange={() => {}} disabled>
            Недоступно
          </Switch>
          <Checkbox checked={cb} onCheckedChange={setCb}>
            Только мои проекты
          </Checkbox>
          <Checkbox
            checked={all}
            indeterminate={!all && !none}
            onCheckedChange={(v) => setSome(some.map(() => v))}
          >
            Выбрать все
          </Checkbox>
          {some.map((v, i) => (
            <Checkbox key={i} checked={v} onCheckedChange={(x) => setSome(some.map((y, j) => (j === i ? x : y)))}>
              Строка {i + 1}
            </Checkbox>
          ))}
          <Checkbox disabled>Недоступно</Checkbox>
        </div>,
      )}

      {section(
        'Banner',
        'Сообщение на странице: четыре тона, действие и «скрыть».',
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {banners.info && (
            <Banner
              onDismiss={() => setBanners({ ...banners, info: false })}
              action={
                <button type="button" className="btn btn-secondary btn-sm">
                  Подробнее
                </button>
              }
            >
              С 1 декабря отчёты времени закрываются автоматически в последний рабочий день месяца.
            </Banner>
          )}
          {banners.warn && (
            <Banner
              tone="warn"
              onDismiss={() => setBanners({ ...banners, warn: false })}
              action={
                <button type="button" className="btn btn-secondary btn-sm">
                  Напомнить
                </button>
              }
            >
              У трёх сотрудников не заполнен отчёт за прошлую неделю.
            </Banner>
          )}
          <Banner tone="good">Изменения сохранены.</Banner>
          <Banner tone="bad">Не удалось загрузить данные из 1С. Попробуйте ещё раз через минуту.</Banner>
          {(!banners.info || !banners.warn) && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBanners({ info: true, warn: true })}>
              Вернуть скрытые
            </button>
          )}
        </div>,
      )}

      {section(
        'Pager · StatusBadge',
        'Постраничный переход и статус записи плашкой.',
        <>
          <div className="sg-row">
            <Pager page={page} pageCount={12} onChange={setPage} />
            <Pager page={1} pageCount={3} onChange={() => {}} />
          </div>
          <div className="sg-row">
            <StatusBadge>Черновик</StatusBadge>
            <StatusBadge tone="info">В работе</StatusBadge>
            <StatusBadge tone="good">Согласован</StatusBadge>
            <StatusBadge tone="warn">На проверке</StatusBadge>
            <StatusBadge tone="bad">Просрочен</StatusBadge>
            <StatusBadge tone="brand">Новый</StatusBadge>
            <StatusBadge tone="good" dot>
              В сети
            </StatusBadge>
            <StatusBadge tone="bad" dot>
              Отклонён
            </StatusBadge>
            <span style={{ width: 120, display: 'inline-flex' }}>
              <StatusBadge tone="info">Очень длинное название статуса</StatusBadge>
            </span>
          </div>
        </>,
      )}

      {section(
        'Avatar · AvatarStack',
        'Инициалы из имени, фото, размеры 20–56, точка «в сети», цвет по имени.',
        <div className="sg-row">
          {([20, 24, 32, 44, 56] as const).map((s) => (
            <Avatar key={s} name="Анна Соколова" size={s} status={s >= 32 ? 'online' : undefined} />
          ))}
          {PEOPLE.slice(1, 5).map((n) => (
            <Avatar key={n} name={n} />
          ))}
          <Avatar name="Илья Громов" src={PHOTO} size={44} status="online" />
          <Avatar name="Илья Громов" src="/нет-такого-файла.jpg" size={44} />
          <Avatar name="" />
          <Avatar name="Павел Ефимов" tint={false} onClick={() => {}} />
          <AvatarStack people={PEOPLE.map((name) => ({ name }))} max={4} />
          <AvatarStack people={PEOPLE.map((name) => ({ name }))} max={3} size={24} />
        </div>,
      )}

      {section(
        'HoverCard',
        'Карточка при наведении (полсекунды) или фокусе; на сенсорных экранах её нет.',
        <div className="sg-row">
          {PEOPLE.slice(0, 2).map((name) => (
            <HoverCard
              key={name}
              content={
                <>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <Avatar name={name} size={56} status="online" />
                    <div style={{ minWidth: 0 }}>
                      <b style={{ display: 'block' }}>{name}</b>
                      <span style={{ color: 'var(--ink-3)', fontSize: 12.5 }}>Главный архитектор проекта</span>
                    </div>
                  </div>
                  <div style={{ color: 'var(--ink-3)', fontSize: 12.5 }}>
                    Мастерская № 2 · <StatusBadge tone="good">Работает</StatusBadge>
                  </div>
                  <button type="button" className="btn btn-secondary btn-sm">
                    Открыть карточку
                  </button>
                </>
              }
            >
              <a href="#hovercard" style={{ color: 'var(--terra-text)' }} onClick={(e) => e.preventDefault()}>
                {name}
              </a>
            </HoverCard>
          ))}
        </div>,
      )}

      {section(
        'CommandPalette',
        'Поиск и команды: Ctrl/Cmd+K (и «л» в русской раскладке). Открывается без анимации.',
        <div className="sg-row">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCmd(true)}>
            Открыть палитру
          </button>
          <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>Последний выбор: {last}</span>
          <CommandPalette open={cmd} onClose={() => setCmd(false)} items={commands} onSelect={(it) => setLast(it.label)} />
        </div>,
      )}

      {section(
        'NotificationCenter',
        'Колокольчик со счётчиком и список; данные и «прочитано» — у хозяина.',
        <div className="sg-row">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNotes(NOTES)}>
            Вернуть непрочитанные
          </button>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8 }}>
            <NotificationCenter items={[]} />
            <NotificationCenter
              items={notes}
              onItemClick={(it) => setNotes(notes.map((x) => (x.id === it.id ? { ...x, unread: false } : x)))}
              onMarkAllRead={() => setNotes(notes.map((x) => ({ ...x, unread: false })))}
            />
          </span>
        </div>,
      )}

      {section(
        'Skeleton · ProgressBar',
        'Заготовки на время загрузки и полоса выполнения.',
        <>
          <div className="sg-row" style={{ alignItems: 'stretch' }}>
            <div style={{ flex: '1 1 220px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow avatar={false} />
            </div>
            <div style={{ flex: '1 1 220px', minWidth: 0 }}>
              <SkeletonText lines={4} />
            </div>
            <Skeleton circle width={56} />
          </div>
          <div className="sg-row">
            <div style={{ flex: '1 1 240px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <ProgressBar value={progress} ariaLabel="Загрузка" />
              <ProgressBar ariaLabel="Идёт расчёт" />
              <ProgressBar value={100} tone="good" size="sm" ariaLabel="Готово" />
              <ProgressBar value={70} tone="bad" size="sm" ariaLabel="Ошибка" />
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setProgress((p) => (p >= 100 ? 0 : p + 20))}>
              +20%
            </button>
          </div>
        </>,
      )}

      {section(
        'FileDrop — состояние загрузки',
        'У файла может быть status: загружается (с долей или без), загружен, ошибка с «Повторить».',
        <div style={{ maxWidth: 520 }}>
          <FileDrop
            files={files.map((f) =>
              f.status === 'error'
                ? {
                    ...f,
                    onRetry: () =>
                      setFiles((fs) => fs.map((x) => (x.id === f.id ? { ...x, status: 'uploading' as const } : x))),
                  }
                : f,
            )}
            onAdd={(added) =>
              setFiles((fs) => [
                ...fs,
                ...added.map((a, i) => ({ id: `${Date.now()}-${i}`, name: a.name, size: a.size, status: 'uploading' as const })),
              ])
            }
            onRemove={(f) => setFiles((fs) => fs.filter((x) => x.id !== f.id))}
          />
        </div>,
      )}
    </>
  )
}

/** Картинка-заглушка для примера с фото (без сети). */
const PHOTO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#c9b8a4"/><circle cx="16" cy="12.5" r="5.5" fill="#7a5c45"/><path d="M5 31c1-7.5 5.5-10.5 11-10.5s10 3 11 10.5z" fill="#7a5c45"/></svg>',
  )
