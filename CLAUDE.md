# wh24-ui — дизайн-система платформы WowHaus

Общая UI-библиотека (npm-монорепо, workspaces). Не сервис — **не крутится** нигде в проде. Подключается потребителями (WH_Portale `apps/hr`, wh24-{oup,aho,wiki}-web) как **git submodule** через `file:`-зависимости, либо как опубликованные пакеты из GitHub Packages (`npm.pkg.github.com`).

## Пакеты (что экспортирует)

| Пакет | Версия | Что внутри |
|---|---|---|
| `@wowhaus-24/ui-tokens` | 0.1.1 | Frame-agnostic CSS-переменные + базовые стили + vanilla theme API. CSS-экспорты: `./tokens.css` (палитра/радиусы/типографика), `./base.css`, `./button.css` (канонические `.btn-*`, primary = терракот `--terra`). JS: `.` (типизир. токены), `./theme` (`setTheme`) |
| `@wowhaus-24/ui-react` | 0.1.1 | React 18+ headless-компоненты (Radix Primitives + Floating UI, без CSS-in-JS, без Tailwind). Зависит от `ui-tokens` |

Компоненты `ui-react`: `ThemeProvider`/`useTheme`, `AppShell`, `Avatar` (только инициалы), `Card`, `Chip`, `IconButton`, `MegaDropdown`, `NavTile`, `Pill`, `SortPill`, `StatBar`, `BestPracticeBadge`, `TypeBadge`, `TypeMarker`, `UtilChip`, `ComingSoon`.

Тема: `html[data-theme="dark"]`. Persistence — `localStorage['wh-ui-theme']`, cross-tab sync. Терракот не меняется между темами.

## Запуск

```bash
npm install                                  # монорепо, npm workspaces
npm run typecheck                            # tsc -b по всем пакетам
npm run build                                # tsc -b (см. ГРАБЛИ — root build НЕ копирует CSS)
npm test --workspaces --if-present           # vitest в packages/react
npm run build --workspaces --if-present      # полная сборка с postbuild (как в CI publish)
npm run dev -w @wowhaus-24/ui-styleguide     # живой styleguide → http://localhost:5174
```

## Структура

- `package.json` (root) — workspaces (`packages/*`, `apps/*`), скрипты `build`/`typecheck`/`test`/`clean`.
- `packages/tokens/` — `@wowhaus-24/ui-tokens`. Источник истины: `src/tokens.css` (палитра), `src/button.css` (кнопки), `src/base.css`.
- `packages/react/` — `@wowhaus-24/ui-react`. `src/<Component>/*.tsx` + `*.module.css`. `scripts/copy-css.mjs` — postbuild, копирует 15 `.module.css` в `dist/`.
- `apps/styleguide/` — `@wowhaus-24/ui-styleguide` (Vite), визуальный preview примитивов.
- `mockups/*.html` — авторитетный источник по визуалу (изначально под wiki-web). Изменение дизайна = сначала правка мокапа.
- `STYLEGUIDE.md` — глобальные правила стилей; `CONSUMER-SETUP.md` — как подключить потребителю; `DEV-WORKSPACE.md` — deploy-workspace скрипты.
- `.github/workflows/`: `ci.yml` (typecheck+build на push/PR в main), `publish.yaml`, `security-scan.yml`.

Эндпоинты: n/a (фронт-либа, бэкенда нет).

## Деплой / публикация

Не деплоится на хост. **Дистрибуция двумя путями:**
1. **Как submodule** — потребитель синкает репо к пину и подключает через `file:`-зависимости (`apps/hr/package.json`).
2. **GitHub Packages** — workflow `publish.yaml` публикует `ui-tokens` и `ui-react` в `npm.pkg.github.com` **по пушу git-тега** `v*` или `@wowhaus-24/*` (НЕ на мерж в main). Версию пакета бампать вручную по SemVer перед тегом. Потребителю нужен `read:packages` PAT в `~/.npmrc` (см. `CONSUMER-SETUP.md`).

## ГРАБЛИ (сверено, неочевидное)

1. **Root `npm run build` = только `tsc -b` — CSS-модули НЕ попадают в `dist/`.** Для рабочего `ui-react` нужен postbuild `copy-css.mjs`: либо `cd packages/react && npm run build`, либо `npm run build --workspaces --if-present`. Иначе `import styles from './X.module.css'` в скомпилированном JS падает в рантайме.
2. **Потребители (WH_Portale `apps/hr` и др.) ломаются на сборке, если submodule `wh24-ui` не синкнут к нужному пину.** Их код импортит из конкретного коммита (напр. `main.tsx` → `ui-tokens/button.css` из `9958b50`). Перед сборкой потребителя: `git submodule update --init wh24-ui` к записанному указателю + `npm i && npm run build` (с пересборкой `packages/react`). После изменений здесь — бампнуть указатель submodule в потребителе.
3. `package.json` (root) `name: "wh-ui"`, `private: true` — публикуются только вложенные пакеты, не корень.
4. `dev:styleguide` из `CONSUMER-SETUP.md` — скрипт deploy-workspace (`DEV-WORKSPACE.md`), его НЕТ в root `package.json`. Внутри репо используй `npm run dev -w @wowhaus-24/ui-styleguide`.

Платформенный контекст и память — в зонтике `../CLAUDE.md` и `../memory/` (см. `memory/wh24_ui_design_system.md`, `ui_styleguide.md`).


## Changelog (правило WH-24)

Все заметные пользовательские изменения фиксируй в `CHANGELOG.md` по мере работы,
в секции `## [Unreleased]`. Формат — Keep a Changelog (RU) + SemVer, записи на
русском с точки зрения пользователя (не «bump lib», а «Добавлен экспорт в PDF»).
Внутреннее (CI, зависимости, рефакторинг) в changelog не пиши.

Релиз: перенеси `[Unreleased]` → `## [X.Y.Z] — ГГГГ-ММ-ДД`, поставь git-тег
`vX.Y.Z` и запушь — workflow `.github/workflows/release-on-tag.yml` создаст GitHub
Release из секции changelog (портал публикует его в «Что нового»).
Полная политика: https://github.com/WH-24/WH_Portale/blob/main/docs/CHANGELOG_POLICY.md
Продукт: none
