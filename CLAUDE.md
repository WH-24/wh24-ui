# wh24-ui — дизайн-система платформы WowHaus

Общая UI-библиотека (npm-монорепо, workspaces). Не сервис — **не крутится** нигде в проде. Подключается потребителями (WH_Portale `apps/hr`, wh24-{oup,aho,wiki}-web) как **git submodule** через `file:`-зависимости, либо как опубликованные пакеты из GitHub Packages (`npm.pkg.github.com`).

## Пакеты (что экспортирует)

| Пакет | Версия | Что внутри |
|---|---|---|
| `@wowhaus-24/ui-tokens` | 0.1.1 | Frame-agnostic CSS-переменные + базовые стили + vanilla theme API. CSS-экспорты: `./tokens.css` (палитра/радиусы/типографика), `./base.css`, `./button.css` (канонические `.btn-*`, primary = терракот `--terra`), `./bridge.css` (имена переменных портала `--fg-*/--bg-*/--accent-*/--border-*/--radius-*/--z-*` для компонентов стандарта). JS: `.` (типизир. токены), `./theme` (`setTheme`) |
| `@wowhaus-24/ui-react` | 0.1.1 | React 18+ headless-компоненты (Radix Primitives + Floating UI, без CSS-in-JS, без Tailwind). Зависит от `ui-tokens` |
| `@wowhaus-24/forms-react` | 0.1.0 | Платформа «Формы» (wh24-forms-api): типы схемы/модели, `evaluate` (visible_if, фикстуры общие с Go), `validateRecord`, `createFormsApi`, React-рендер записей. Зависит от `ui-react` |
| `@wowhaus-24/brain-react` | 0.6.0 | WH24 Brain — панель «Спросить ИИ», экран «Агенты», «Поля ИИ» в списках и генераторы, навыки, память, модели: `createBrainApi` (search/ask/runs/feedback, опрос `waitForRun`; агенты: `agents.*`, `agentRuns`, `agentPresets`, `agentTools`, `agentDraft`), `Markdown` с цитатами `[n]` (последнее слово и чип — неразрывно) и экспортом таблиц в .xlsx, `renumberCitations` (номера источников 1, 2, 3… по порядку ссылок), копирование ответа `copyAnswer`/`htmlForCopy`/`stripCitations` (HTML + markdown без `[n]`), `SourceCard`/`SourceList`, `AssistantMessage`/`UserMessage` (блоки `Run.blocks` через `renderBlock` хоста), `ChartBlockFallback`/`BlockExplain` (график без Perspective: таблица + «Что посчитано»), `AgentSteps`/`AiActionCard`, `BrainComposer`, `UsageMeter`/`AiLabel`/`PrivacyNotice`, контейнер `AskAiPanel`; агенты — `AgentProfile` (+ `TriggerEditor`/`ScheduleEditor`, `ToolPicker`, `KnowledgePicker`, `MemoryEditor`), `RunLogTable`/`RunDetail`, `AgentCard`/`AgentPresetCard`, `AgentBuilderChat`, `BrainSwitch`; поля ИИ — `useAiFieldColumns`, `AiFieldDialog`/`AiFieldCell`/`AiFieldColumnMenu`, `api.fields.*`; генераторы — `GeneratorDialog`, `api.generate`; `BrainDialog`/`BrainConfirm`; навыки — `SkillsList`/`SkillCard`/`SkillDialog`/`SkillSuggestionsDialog`, `useSlashSkills` + меню «/» в `BrainComposer` (`skills`), `api.skills.*`; память — `MemoryPanel`/`MemoryImportDialog`, `api.memory.*`; модели и индекс — `ModelSelect`, `ModelSettingsDialog`, `IndexStatusDialog`, `api.models.list`, `api.admin.*`. Data-agnostic, источники — как прислал сервер, права проверяет сервер. Зависит от `ui-react`, `react-markdown`, `remark-gfm` |

Компоненты `ui-react` (сверено с `packages/react/src/index.ts` 22.09.2026): `ThemeProvider`/`useTheme`,
`AppShell`, `Avatar` (только инициалы), `Card`, `Chip`, `IconButton`, `MegaDropdown`, `NavTile`, `Pill`,
`SortPill`, `StatBar`, `BestPracticeBadge`, `TypeBadge`, `TypeMarker`, `UtilChip`, `ComingSoon`,
`DirectoryPicker`, `Kanban` (канбан с переносом мышью и меню «Переместить в…», `src/Kanban/`); страница-список `ListPage` (+ `NAME_COL_MIN_WIDTH`; у колонки `ListColumn.headerActions` — кнопки в заголовке без сортировки) с фильтром в духе Битрикс24 —
`FilterBar`, `useFilterState`, `matchItem`, `activeCount`, общий `Combobox` (`src/list/`, экспортирован:
группы, `searchable`, аватар, `invalid`); примитивы формы (`src/form/`: `Input`, `Textarea`,
`FieldRow`/`FieldGrid`/`StaticValue`, `MultiCombobox`, `DateField`, `FileDrop`); `Icon`; бренд —
`applyBrand`, `BRAND_FONTS`, `BRAND_RADIUS_SCALES`. Стандарт страницы модуля (перенесён из портала
09.11.2026, стили на именах `ui-tokens/bridge.css`): `ModuleLayout`/`ModuleNavGroup`/`ModuleNavLink`/
`ModuleNavList` (`src/module/`), `Page`/`PageHeader`/`EmptyState`/`ErrorState`/`Loader` (`src/page/`),
`Tabs`/`TabPanel`/`SegmentedControl` (`src/tabs/`), `Modal`/`Drawer`/`ConfirmProvider`+`useConfirm`/`useAlert`/
`ToastProvider`+`useToast`/`useFocusTrap` (`src/overlay/`). Карточка записи — стандарт лида/проекта/ФМ и записей форм (перенесена из портала 14.11.2026): `RecordCard` (+ `RecordTabs`/`RecordTabPanel`, `ActionsMenu`, `cleanSeps`; `src/record/`); «Спросить ИИ» и меню причин отказа подставляет хост (`aiMenu`, `failMenu`). `FormRecordView` с `discussion` рисует запись в ней — свою вёрстку «как у лида» не делать. Портал пока рисует то же своими копиями
(`apps/hr/src/components/*`, классы `.section-*/.page-*/.modal-*` в `styles.css`). Пакет форм — `packages/forms` (ниже).

Тема: `html[data-theme="dark"]`. Persistence — `localStorage['wh-ui-theme']`, cross-tab sync. Терракот не меняется между темами.

## Скилы для работы над интерфейсом (обязательны)

Любая правка внешнего вида, поведения или движения элементов делается со скилами — вызывать через `Skill` до первой строчки кода.

| Когда | Скил |
|---|---|
| Новый элемент или экран, выбор визуального решения | `ui-ux-pro-max:ui-ux-pro-max`, `frontend-design:frontend-design` |
| Токены, спецификация компонента | `ui-ux-pro-max:design-system` |
| Готового элемента нет в `ui-react` | 21st.dev (инструменты `mcp__magic__*`) — не верстать руками |
| Отклик, наведение, нажатие, всплывающие, детали компонента | `emil-design-eng` |
| Новая анимация | `animate`; несколько элементов сразу (каскад, смена вида) — `choreograph` |
| Проверка движения в диффе | `review-animations`; по всему репо — `improve-animations` |
| «Где добавить движение» / «где его слишком много» | `find-animation-opportunities` / `remove-animations` |
| Анимация дёргается | `animation-performance` |
| Устройство компонента: пропсы, составные компоненты | `composition-patterns` |
| Проверка на плохих данных (длинные имена, пусто, тысячи строк) | `break-ui` |
| Замечание владельца по дизайну → постоянное правило | `learn-taste` |
| Общая проверка качества экрана: разбор, шлифовка, типографика, цвет | `impeccable` (`/impeccable audit`, `critique`, `polish`…) |
| Проверка кода интерфейса по правилам Vercel (доступность, формы, фокус) | `web-design-guidelines` |

Скилы Эмиля Ковальски (`emilkowalski/skills`, снимок 0f2e23b) и `composition-patterns` (`vercel-labs/agent-skills`, 1a2c79d) лежат в `~/.claude/skills` хоста агента; `ui-ux-pro-max` и `frontend-design` — плагины. `impeccable` (`pbakaus/impeccable`, 1995764) стоит папкой скила без хуков плагина; его команды запускают движок — отдельную программу, которую он при первом вызове скачивает с GitHub (сверка по контрольной сумме). `web-design-guidelines` при каждом запуске берёт правила по сети. Токены движения в `tokens.css` (`--dur-*`, `--ease-*`) взяты из того же источника — длительности и кривые числами в компонентах не писать.

Порядок старшинства: слова владельца → этот репозиторий (`STYLEGUIDE.md`, токены, готовые компоненты) → советы скилов. Скил не повод менять терракот, шрифт или заводить Tailwind.

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
- `packages/tokens/` — `@wowhaus-24/ui-tokens`. Источник истины: `packages/tokens/src/tokens.css` (палитра), `packages/tokens/src/button.css` (кнопки), `packages/tokens/src/base.css`; в `exports` пакета они отдаются как `./tokens.css`, `./button.css`, `./base.css`.
- `packages/react/` — `@wowhaus-24/ui-react`. `src/<Component>/*.tsx` + `*.module.css`. `scripts/copy-css.mjs` — postbuild, рекурсивно копирует все `*.module.css` из `src/` в `dist/` (на 22.09.2026 их 20, включая `form/form.module.css`).
- `packages/forms/` — `@wowhaus-24/forms-react`. `src/types.ts` (контракт бэкенда — менять только вместе с ним), `src/conditions/` (+ `fixtures/*.json` = копия `internal/conditions/testdata` бэкенда, при расхождении копировать заново), `src/validate.ts`, `src/schema.ts`, `src/api.ts`, React-часть в `src/render/` и `src/pages/`; свой `scripts/copy-css.mjs` (3 CSS-модуля). `FormRecordsPage` принимает колонки хоста (`extraColumns`, тип `ListColumn` из ui-react) и `onRowsChange` (строки страницы) — так в таблицу записей встают «Поля ИИ». Лента записи (панель комментария как в Pyrus) — `src/chat/` (`RecordChat`, `Composer`, `RouteBar`, разметка `markup.tsx`).
- `packages/brain/` — `@wowhaus-24/brain-react`. `src/types.ts` (контракт brain-api — менять вместе с бэкендом), `src/api.ts` (`createBrainApi`), `src/markdown/` (react-markdown + remark-gfm, плагин цитат `citations.ts`, `xlsx.ts`), `src/sources/`, `src/messages/`, `src/blocks/` (блоки ответа: `BlockExplain`, `ChartBlockFallback`), `src/agent/` (шаги и карточка действия), `src/composer/`, `src/meta/`, `src/panel/`; экран «Агенты» — `src/agents/` (`types.ts` — контракт агентов, `client.ts` — методы клиента, `schedule.ts` — cron ⇄ человеческий ввод и ближайший запуск, `draft.ts` — черновик профиля и правка конструктора, `labels.ts` — подписи; рядом компоненты формы, журнала и карточек); «Поля ИИ» и генераторы — `src/fields/` (`types.ts`, `client.ts`, `errors.ts`, `labels.ts`, `period.ts`, `Dialog.tsx` — модальное окно пакета, `AiField*`, `GeneratorDialog.tsx`, хук `useAiFieldColumns.tsx`); навыки — `src/skills/` (`types.ts`, `client.ts`, `labels.ts` — формат команды и `slugify`, `SkillCard`/`SkillsList`/`SkillDialog`/`SkillSuggestionsDialog`, `CardMenu`, хук `useSlashSkills`; сам список «/» — в `composer/BrainComposer.tsx`: `skills`, `slashQuery`, `matchSlashSkills`); личная память — `src/memory/` (`MemoryPanel`, `MemoryImportDialog`, разбор импорта в `labels.ts`; **не путать** с `agents/` — там память агента, поэтому типы здесь `UserMemory*`); модели и индекс — `src/models/` (`client.ts` — `models.*` и `admin.*`, `format.ts`, `ModelSelect`, `ModelSettingsDialog`, `IndexStatusDialog`); `src/testing.ts` — подставной fetch для тестов (исключён из сборки); свой `scripts/copy-css.mjs` (20 CSS-модулей). README пакета — пример встраивания. Поля выбора — только общий `Combobox`/`MultiCombobox` из `ui-react`; переключателя в `ui-react` нет — `BrainSwitch` внутри пакета.
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
