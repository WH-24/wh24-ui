# @wowhaus-24/ui-react

React-side helpers over `@wowhaus-24/ui-tokens`. Currently exports a
`ThemeProvider` + `useTheme` hook. Headless primitives (Pill, NavTile,
StatBar, etc.) will land here as we migrate them out of `wiki-web`.

## Components

Полный список — в `src/index.ts`. Элементы по принятому макету
(`mockups/components-mockup.html`): `Tooltip`, `Switch`, `Checkbox`, `Banner`,
`Pager`, `StatusBadge`, `Avatar` / `AvatarStack`, `HoverCard`,
`CommandPalette` (+ `useCommandPaletteShortcut`), `NotificationCenter`,
`Skeleton` / `SkeletonText` / `SkeletonRow`, `ProgressBar`. Одна реализация на
элемент: `Menu` (+ `MenuItem`, `MenuSeparator`, `MenuLabel`) — любое меню
действий, `IconButton` (32 и 24, принимает `ref` и атрибуты кнопки), части окна
`DialogHeader` / `DialogBody` / `DialogFooter` / `DialogClose` (из них собраны
`Modal`, `Drawer` и подтверждение), `Spinner`, `CheckboxMark` (рисунок флажка
для пункта списка). Свои меню, окна, кольца ожидания и кружки с инициалами в
модулях не заводим. Живые примеры —
`npm run dev -w @wowhaus-24/ui-styleguide`.

### Списки и карточки по принятому макету

Всё ниже включается пропсами; без них `ListPage`, `FilterBar`, `Kanban` и
`RecordCard` ведут себя как раньше.

| Что | Как включить |
|---|---|
| Виды-вкладки со счётчиками и «Сохранить вид» | `ListPage`: `views` (`ListSavedView[]`), `onSaveView(name, state)`, по желанию `viewId` / `onViewChange`, `viewLabels`. Виды хранит хост |
| Фильтр плашками «Поле: значение ▾» | `ListPage filterVariant="chips"` или `FilterBar variant="chips"` (+ `trailing`, `chipLabels`). Состояние — тот же `FilterState` |
| Панель массовых действий | `ListPage selectable bulkActions={[{ label, icon, tone, choices, onRun(ids, choice) }]}` (+ `bulkLabels`, `onBulkError`); отдельно — `BulkActionBar`. `onRun` вернул `false` — выбор остаётся |
| Правка в ячейке | `ListColumn.edit = { type: 'text' \| 'select', options, getValue, onCommit(row, value), canEdit }`, ошибка — `ListPage onEditError` |
| Строки доезжают до места после удаления и фильтра | `ListPage animateChanges`; свой список — хук `useFlip(ref, trigger)` и `data-flip-id` на детях |
| Отметка сохранения | `SaveIndicator state="idle \| saving \| saved \| error"`; в шапке карточки — `RecordCard saveState` |
| Поле без рамки до наведения и фокуса | `variant="ghost"` у `Input`, `Combobox`, `DateField` |
| Канбан: сумма, сворачивание, быстрое добавление, место вставки, переезд | `Kanban`: `columnSummary`, `collapsible` (+ `collapsed` / `onCollapsedChange`), `onQuickAdd`, `dropPlaceholder`, `animateChanges`, `labels` |
| Нижняя навигация модуля на телефоне | `ModuleLayout mobileNav="bottom"`, `shortLabel` у `ModuleNavLink` / пунктов `ModuleNavList` |

Без пропсов (для всех сразу): уведомления встают стопкой — новое впереди,
раскрываются под курсором, смахиваются вправо; до 640px `Modal`,
подтверждение и `Drawer` открываются листом снизу и закрываются смахиванием
вниз за шапку.

## Install

```bash
npm install @wowhaus-24/ui-react @wowhaus-24/ui-tokens
```

`react` and `react-dom` are peer dependencies — your app provides them.

## Usage

```tsx
import '@wowhaus-24/ui-tokens/tokens.css'
import '@wowhaus-24/ui-tokens/base.css'
import { ThemeProvider, useTheme } from '@wowhaus-24/ui-react'

function App() {
  return (
    <ThemeProvider>
      <Page />
    </ThemeProvider>
  )
}

function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return <button onClick={toggle}>{theme === 'dark' ? '☀' : '☾'}</button>
}
```

## Avoiding FOUC

The provider runs `initTheme()` on mount, but if your app server-renders
or has a slow first paint, the dark theme may flash from light. Avoid
this with an inline script in `<head>`:

```html
<script>
  (function () {
    var t = localStorage.getItem('wh-ui-theme');
    if (t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  })();
</script>
```

Then pass `initOnMount={false}` to `<ThemeProvider>`.
