# wh-ui — agent guide

Дизайн-система Wowhaus. Любой агент, открывающий этот репо, читает этот
файл целиком до того, как трогать код.

## Что это

Монорепо (npm workspaces) с двумя пакетами:

- `@wowhaus-24/ui-tokens` — frame-agnostic CSS-переменные, базовые стили,
  типизированный экспорт токенов, vanilla theme API.
- `@wowhaus-24/ui-react` — React-обёртки (ThemeProvider, headless примитивы).

Плюс:
- `mockups/` — HTML-эталоны UI. **Источник истины** по визуальному
  поведению. Всё что в коде должно совпадать с мокапом.
- `styleguide/` — живая страница с примитивами на реальных токенах.
- `icons/` — место для SVG-библиотеки (lucide-subset, kebab-case,
  `currentColor`).

## Что мы строим

Wh-ui используется во всех будущих сервисах Wowhaus — `wiki-web`,
будущие сервисы (HR, портфолио, etc.). Поэтому:

1. **Никаких бизнес-сущностей в коде.** В `ui-react` нет ничего
   специфичного для вики (нет «Article», «Block», нет API-клиентов).
   Только переиспользуемые UI-кирпичи.
2. **Никаких runtime-зависимостей в `ui-tokens`.** Это пакет, который
   могут потреблять Go-templates, Vue, Svelte, plain HTML. Только CSS
   и vanilla JS.
3. **Никаких CSS-in-JS.** Стили — это `*.module.css` рядом с компонентом
   плюс CSS-переменные из tokens. Мокапы написаны на vanilla CSS,
   и мы держим тот же runtime-путь.

## Источники истины

| Что | Где |
|---|---|
| Цвета, радиусы, типографика | `packages/tokens/src/tokens.css` |
| Типизированные алиасы токенов | `packages/tokens/src/tokens.ts` (синхрон с CSS вручную) |
| Vanilla theme API | `packages/tokens/src/theme.ts` |
| Визуальное поведение surface | `mockups/<surface>-mockup.html` |
| Live-preview примитивов | `styleguide/index.html` |

## Принципы работы с мокапами

1. Мокапы — **дизайн-канон**. Любое изменение визуала — сначала правка
   мокапа в отдельном PR с префиксом `mockup:`, потом реализация.
2. CSS из мокапов **переносится один-в-один** в CSS Modules компонентов.
   Никакого «улучшения по пути».
3. Если мокап показывает поведение которое CSS не покрывает (focus-trap,
   keyboard nav, drag-and-drop) — это рантайм-логика, реализуется в
   `ui-react` поверх Radix Primitives / Floating UI / dnd-kit.

## Что запрещено

- Tailwind, styled-components, emotion, vanilla-extract — любой CSS-in-JS
  или utility-CSS.
- Хардкодить цвет/радиус/размер вне `tokens.css`. Если значения нет —
  добавить токен.
- Копировать ARIA-логику руками (focus-trap, ESC-handling, click-outside)
  когда есть Radix.
- Импортировать что-либо `wiki-*`-специфичное в `packages/`.
- Реальные API-вызовы в компонентах. Storybook-style — компонент получает
  данные через props.

## Контракт версий (SemVer)

- **Major** — breaking change в токенах (rename/удаление переменной),
  удаление компонента, изменение peerDependency.
- **Minor** — новый токен, новый компонент, новая опциональная prop.
- **Patch** — исправление существующего токена/компонента в рамках
  обратной совместимости.

Bump происходит вручную при PR. CHANGELOG.md обновляется в том же PR.

## Команды

```bash
npm install          # установка с workspace-линковкой
npm run typecheck    # tsc --noEmit во всех пакетах
npm run build        # сборка всех пакетов
npm run clean        # удалить dist/ и tsbuildinfo
```

## Открыть мокапы

```bash
open mockups/hub-mockup.html
open mockups/index.html      # навигация по всем экранам
open styleguide/index.html
```

## Roadmap

| Этап | Статус |
|---|---|
| Scaffold монорепо, токены, theme API, ThemeProvider | ✅ |
| Перенести мокапы в репо | ✅ |
| Перенести styleguide | ✅ |
| Миграция примитивов из `wiki-web/src/shared/ui/` в `ui-react` | ⏳ |
| Headless обёртки на Radix (Dialog, Popover, Tabs, ...) | ⏳ |
| Cmd+K (`cmdk`) | ⏳ |
| TipTap-обёртка для article-edit | ⏳ |
| SVG-библиотека `icons/` (lucide-subset) | ⏳ |
| Публикация в npm (private registry или GitHub Packages) | ⏳ |

## Связанные репо (org `WOWHAUS-24`)

- [`wh24-wiki-docs`](https://github.com/WOWHAUS-24/wh24-wiki-docs) —
  координационная docs-репа: spec, ADR, ROADMAP
- [`wh24-wiki-api`](https://github.com/WOWHAUS-24/wh24-wiki-api) —
  Go-бэкенд вики
- [`wh24-wiki-web`](https://github.com/WOWHAUS-24/wh24-wiki-web) —
  React-фронт вики, первый consumer wh24-ui

[`ADR-0006`](https://github.com/WOWHAUS-24/wh24-wiki-docs/blob/main/docs/adr/0006-frontend-stack-and-style-provider.md)
фиксирует решение о выделении wh24-ui в отдельный репо и общий
стек для всех React-сервисов Wowhaus.

[`ADR-0007`](https://github.com/WOWHAUS-24/wh24-wiki-docs/blob/main/docs/adr/0007-wh-id-contract.md)
описывает интеграцию с identity provider (WH ID).
