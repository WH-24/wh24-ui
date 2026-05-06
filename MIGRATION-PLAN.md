# Миграция UI-примитивов: wiki-web → @wowhaus/ui-react

**Дата:** 6 мая 2026
**Цель:** Перенести 15 примитивов из `wiki-web/src/shared/ui/` в
`@wowhaus/ui-react`. После миграции wiki-web импортирует их из
workspace package, а не дублирует код.

## Inventory — что мигрируем

| # | Примитив | wiki-web путь | Сложность | Зависимости |
|---|---|---|---|---|
| 1 | TypeMarker | `shared/ui/TypeMarker/` | S | tokens (ArticleType) |
| 2 | TypeBadge | `shared/ui/TypeBadge/` | S | tokens (ArticleType, articleTypeBg) |
| 3 | BestPracticeBadge | `shared/ui/BestPracticeBadge/` | S | tokens |
| 4 | Chip | `shared/ui/Chip/` | S | tokens |
| 5 | UtilChip | `shared/ui/UtilChip/` | S | tokens |
| 6 | StatBar | `shared/ui/StatBar/` | M | tokens |
| 7 | Avatar | `shared/ui/Avatar/` | S | tokens |
| 8 | IconButton | `shared/ui/IconButton/` | S | tokens |
| 9 | Pill | `shared/ui/Pill/` | S | tokens |
| 10 | SortPill | `shared/ui/SortPill/` | S | tokens |
| 11 | NavTile | `shared/ui/NavTile/` | M | tokens, react-router (Link) |
| 12 | Card | `shared/ui/Card/` | M | tokens |
| 13 | MegaDropdown | `shared/ui/MegaDropdown/` | L | tokens, focus-trap, click-outside |
| 14 | AppShell | `shared/ui/AppShell/` | L | tokens, react-router |
| 15 | ComingSoon | `shared/ui/ComingSoon/` | XS | tokens |

S = Simple (≤30 строк), M = Medium (30-80), L = Large (80+).

## Открытые вопросы по контракту

### Q1. CSS Modules vs vanilla CSS

Wiki-web использует CSS Modules (`*.module.css`). Это требует webpack/vite
plugin у consumer'а. В `@wowhaus/ui-react` оставляем CSS Modules или
переходим на vanilla CSS?

**Решение:** оставляем CSS Modules. Все consumer-сервисы будут на Vite
(или будут указывать css-modules plugin в bundler-config). Для
non-React consumer'ов есть `@wowhaus/ui-tokens/tokens.css` — там нет
CSS Modules. Это разделение ответственностей.

### Q2. React Router зависимость

Примитивы NavTile и AppShell импортируют `react-router-dom` для `<Link>`.
Это ломает frame-agnostic концепцию.

**Решение:** не делаем NavTile и AppShell зависимыми от react-router.
Вместо `Link` используем prop `as` или `renderLink`:

```tsx
// До:
<NavTile to="/browser" label="Browser" />
<Link to={to}>...</Link>

// После:
<NavTile href="/browser" label="Browser" renderLink={(props) => <Link {...props}/>}>
```

Default `renderLink = (props) => <a {...props} />` — обычный anchor.
Consumer передаёт свой Link если использует роутер.

### Q3. Тесты

Wiki-web имеет 13 *.test.tsx файлов на vitest+@testing-library/react.

**Решение:** переносим тесты вместе с примитивами в
`packages/react/src/<Primitive>/<Primitive>.test.tsx`. Vitest setup
повторяем в `packages/react/`.

### Q4. Storybook / playground

Сейчас примитивы видны только через `KitchenSinkSurface` в wiki-web.
В @wowhaus/ui-react нужно отдельное место для preview.

**Решение:** styleguide app (Vite app в `apps/styleguide/`) —
отдельный workspace package, импортирует из `@wowhaus/ui-react` и
отрисовывает каждый примитив в галерее. Storybook — overkill для нашего
размера.

### Q5. Обратная совместимость в wiki-web

После миграции wiki-web должен импортировать из `@wowhaus/ui-react`,
не из локального `shared/ui/`.

**Решение:** в wiki-web `package.json` добавить
`"@wowhaus/ui-react": "file:../wh-ui/packages/react"` (или git
submodule, или npm publish — на этапе deploy решаем). Локальные
`shared/ui/` файлы удаляем за раз с миграцией каждого примитива.

## Этапы миграции

### Этап 0 — подготовка (✅ сделано в этом коммите)

- [x] Расширить `@wowhaus/ui-tokens/tokens.css` до надмножества
  wiki-web токенов (`--tp-proj-fg/-bg`, fs/sp/shadow/z, lineHeights,
  fontWeights)
- [x] Обновить `tokens.ts` — `ARTICLE_TYPES`, `ARTICLE_TYPE_LABELS`,
  `articleTypeBg`, `fontSizes`, `lineHeights`, `fontWeights`,
  `space`, `shadows`, `zIndex`
- [x] Build verified

### Этап 1 — vitest в @wowhaus/ui-react

- [ ] Установить `vitest`, `@testing-library/react`, `@testing-library/jest-dom`
  в `packages/react/`
- [ ] Создать `packages/react/vitest.config.ts`
- [ ] Создать `packages/react/test-setup.ts`
- [ ] Добавить script `"test": "vitest"` в `packages/react/package.json`
- [ ] Корневой `package.json` — script `"test": "npm test --workspaces --if-present"`

### Этап 2 — примитивы по сложности (S → M → L)

#### 2.1 — Simple (XS+S, 9 примитивов)
1. ComingSoon (XS) — простейший, проверка миграции
2. TypeMarker (S) — закроет паттерн ArticleType
3. TypeBadge (S)
4. BestPracticeBadge (S)
5. Chip (S)
6. UtilChip (S)
7. Avatar (S)
8. IconButton (S)
9. Pill (S)
10. SortPill (S)

Каждый: tsx + module.css + test.tsx + barrel-export. Тест проходит.

#### 2.2 — Medium (3 примитива)
1. StatBar (M)
2. NavTile (M) — ввести `renderLink` контракт (Q2)
3. Card (M)

#### 2.3 — Large (3 примитива)
1. MegaDropdown (L) — focus-trap + click-outside; решить через Radix Popover
   или своё (сейчас — своё)
2. AppShell (L) — `renderLink` контракт
3. (Storybook-like styleguide app — отдельный шаг 3)

### Этап 3 — styleguide app

- [ ] `apps/styleguide/` — Vite + React + workspace dep `@wowhaus/ui-react`
- [ ] Каркас: галерея с категориями, dark/light toggle
- [ ] Прогон через все 15 примитивов

### Этап 4 — миграция wiki-web

В отдельной сессии (в `wiki-web/`):

- [ ] `package.json` — добавить `"@wowhaus/ui-react": "file:..."` или
  workspace symlink
- [ ] `package.json` — добавить `"@wowhaus/ui-tokens": "file:..."`
- [ ] Заменить импорты `import { TypeMarker } from '@/shared/ui/TypeMarker/TypeMarker'`
  на `import { TypeMarker } from '@wowhaus/ui-react'` по всем файлам
  (codemod через jscodeshift или ручной grep+sed)
- [ ] Удалить `wiki-web/src/shared/ui/<Primitive>/` после успешной замены
- [ ] Сохранить только `wiki-web/src/shared/ui/AppShell/` и
  `<wiki-web>-specific` если такие есть
- [ ] `tokens.ts` и `tokens.css` в wiki-web — оставить только deprecated
  aliases которые ещё используются (чистится постепенно)
- [ ] `tsc --noEmit` чистый
- [ ] eslint чистый
- [ ] Все Playwright e2e тесты проходят
- [ ] Visual regression — сравнить скриншоты до/после

### Этап 5 — публикация (когда появится второй consumer)

- [ ] Версионирование `@wowhaus/ui-tokens@1.0.0`,
  `@wowhaus/ui-react@1.0.0`
- [ ] CHANGELOG обновить
- [ ] Решить про npm registry: GitHub Packages (Lenivedz scope) vs
  publish private package
- [ ] CI workflow для publish-on-tag

## Проектные решения по примитивам

### TypeMarker
- API: `<TypeMarker type={'project'} active={false} />`
- Без изменений по сравнению с wiki-web

### TypeBadge
- API: `<TypeBadge type={'project'} />`
- Использует `articleTypeColor` + `articleTypeBg` для контраста
- Текст из `ARTICLE_TYPE_LABELS`

### Card
- API: `<Card variant="cover|noCover" bestPractice?: boolean type={ArticleType} ... />`
- Самый сложный из «средних» — содержит cover + body + footer

### MegaDropdown
- Своя реализация (focus-trap, click-outside, ESC)
- В будущем: переписать на Radix Popover (отдельная задача после
  миграции)

### AppShell
- Topbar: brand + cmdk-pill + theme-toggle + admin-icon + avatar
- Без вкладочной навигации (исправлено в spec v4)
- `renderLink` для интеграции с роутером

## Размер работы

| Этап | Время оценочно |
|---|---|
| 1 (vitest setup) | 30 мин |
| 2.1 (10 simple) | 2-3 часа |
| 2.2 (3 medium) | 1-2 часа |
| 2.3 (2 large) | 2-3 часа |
| 3 (styleguide app) | 2 часа |
| 4 (wiki-web replacement) | 2-3 часа |

**Итого:** 10-14 часов работы. Рекомендую разбить на сессии:
- **Сессия 1:** Этапы 0-1 + 2.1 (10 simple primitives)
- **Сессия 2:** Этапы 2.2-2.3 (5 medium+large)
- **Сессия 3:** Этап 3 (styleguide)
- **Сессия 4:** Этап 4 (wiki-web replacement)

## Что не делаем в этой миграции

- Headless обёртки на Radix Primitives (Dialog, Popover, Tooltip,
  Tabs) — отдельная задача после миграции существующих примитивов
- TipTap-обёртка для article-edit
- cmdk-обёртка
- SVG icon library

Эти штуки появятся в `@wowhaus/ui-react` отдельными PR'ами, не в
рамках migration.
