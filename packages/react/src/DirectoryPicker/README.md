# DirectoryPicker

Переиспользуемый **поиск-справочник** (сотрудники / отделы / любые сущности) с
системой вкладок и режимом быстрого поиска — в стиле глобального поиска Bitrix.
Экспортируется из `@wowhaus-24/ui-react`, шарится на все модули платформы.

```tsx
import { DirectoryPicker } from '@wowhaus-24/ui-react'
```

## Зачем

Единый компонент «найти человека/отдел и перейти» для любого модуля (HR, ОУП,
АХО, Вики). **Data-agnostic**: библиотека не знает про API — данные, аватары и
обработчик выбора приходят через props. Это позволяет использовать его где угодно,
подставляя свои сущности.

## Раскладка

```
┌ [🔍  поле поиска ................  × ] ┐   ← input сверху
│ ┌ ПОСЛЕДНИЕ ┬ ▸ Аватар  Иванов Иван    │ │  ← дропдаун:
│ │ СОТРУДНИКИ│           Должность       │ │     левый рельс вкладок
│ │ ОТДЕЛЫ    │ ▸ Аватар  Петров Пётр     │ │   + скроллируемый список
│ └───────────┴──────────────────────────┘ │
└───────────────────────────────────────────┘
```

## Пример

```tsx
<DirectoryPicker<Staff | Department>
  autoFocus
  placeholder="Найти сотрудника или отдел"
  tabs={[
    { key: 'recent', label: 'Последние',  icon: <ClockIcon />, items: recentItems,
      emptyText: 'Здесь появятся недавно открытые' },
    { key: 'people', label: 'Сотрудники', icon: <UserIcon />,  items: peopleItems },
    { key: 'depts',  label: 'Отделы',     icon: <FolderIcon />, items: deptItems },
  ]}
  defaultTabKey="people"
  onSelect={(item) => openEntity(item.data)}
  onClose={() => setOpen(false)}
/>
```

Строки данных (`DirectoryItem`):

```tsx
const peopleItems = staff.map((s) => ({
  id: s.id,
  title: fullName(s),
  subtitle: s.position,
  avatar: <Avatar first={s.first_name} last={s.last_name} photoUrl={s.photo_url} px={30} />,
  keywords: s.position,      // доп. текст для поиска (не отображается)
  data: s,                   // вернётся в onSelect без изменений
}))

const deptItems = departments.map((d) => ({
  id: d.id,
  title: d.name,
  meta: 'Отдел',             // мелкий заглавный «кикер» над заголовком
  avatar: <DeptIcon />,
  data: d,
}))
```

## Props

| Prop | Тип | По умолч. | Описание |
|---|---|---|---|
| `tabs` | `DirectoryTab<T>[]` | — | Вкладки с данными (минимум одна). |
| `onSelect` | `(item, tab) => void` | — | Клик по строке / Enter — выбор одного. |
| `placeholder` | `string` | `'Поиск…'` | Плейсхолдер поля. |
| `defaultTabKey` | `string` | первая вкладка | Активная вкладка (неконтролируемо). |
| `activeTabKey` / `onTabChange` | `string` / `fn` | — | Контролируемая активная вкладка. |
| `query` / `onQueryChange` | `string` / `fn` | — | Контролируемая строка поиска. |
| `filter` | `(item, query) => boolean` | title+subtitle+keywords | Своя фильтрация. |
| `autoFocus` | `boolean` | `false` | Фокус в поле при монтировании. |
| `maxHeight` | `number` | `340` | Макс. высота области списка (px). |
| `emptyText` | `string` | `'Ничего не найдено'` | Пустое состояние (перекрывается `tab.emptyText`). |
| `onClose` | `() => void` | — | Escape / уход фокуса (для сворачивания снаружи). |
| `alwaysShowTabs` | `boolean` | `false` | Показывать рельс даже при одной вкладке. |
| `plainSearch` | `boolean` | `false` | Поле поиска без своей рамки/фона/фокус-кольца — для встраивания в уже оформленный контейнер (тулбар-pill и т.п.), чтобы не было двойной обводки. |
| `className` | `string` | — | Класс на корень. |

### Древовидная вкладка

Вкладка с `tree: true` рисует свои `items` как **дерево** по `item.parentId`
(отступы + раскрытие/сворачивание шевроном справа). `parentId = null`/отсутствует/
несуществующий id → корневой узел. Клик по строке — выбор (`onSelect`), клик по
шеврону — раскрыть/свернуть. При активном поиске дерево временно превращается в
плоский список совпадений.

```tsx
{
  key: 'depts', label: 'Отделы', icon: <FolderIcon />, tree: true,
  items: departments.map((d) => ({
    id: d.id, title: d.name, meta: 'Отдел', parentId: d.parent_id, data: d,
  })),
}
```

Дженерик `T` — тип `item.data` (напр. `Staff | Department`).

## Поведение

- **Режим — быстрый поиск (single):** клик/Enter → `onSelect(item, tab)`; чекбоксов нет.
- **Клавиатура:** ↑/↓ — навигация, Enter — выбрать, Esc — очистить (а на пустом — `onClose`).
- **Фильтр:** по активной вкладке; по умолчанию — вхождение всех токенов в
  `title + subtitle + keywords` (регистронезависимо, ru-locale).
- **Аватар:** `item.avatar` (ReactNode) рисует потребитель; если не задан — кружок с инициалами.
- **Закрытие:** Escape или уход фокуса за пределы компонента → `onClose`.
- **Доступность:** `combobox` + `listbox`/`option`, `role="tab"`; `prefers-reduced-motion`.

## Стилизация

Все цвета/радиусы — из дизайн-токенов (`@wowhaus-24/ui-tokens`), тёмная тема
через `[data-theme="dark"]` наследуется автоматически. Ширину поля/дропдауна
задаёт потребитель через контейнер (см. `.os2-bar__dir` в apps/hr).

## Первый потребитель

`apps/hr` → `OrgStructurePage` (тулбар «Структура компании»): вкладки
Последние / Сотрудники / Отделы; выбор человека открывает карточку (`onOpenEmp`),
выбор отдела выделяет карточку в схеме; «Последние» персистятся в `localStorage`.
