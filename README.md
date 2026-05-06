# WH UI

Дизайн-система Wowhaus — переносимый style provider для всех внутренних
сервисов. Состоит из двух уровней:

| Пакет | Что внутри | Зависит от |
|---|---|---|
| `@wowhaus-24/ui-tokens` | CSS-переменные (light + dark), базовые стили, типизированные токены, vanilla theme API | — |
| `@wowhaus-24/ui-react` | React-обёртки: `ThemeProvider`, headless примитивы | tokens, React 18+ |

## Источники истины

- **Мокапы** в [`mockups/`](./mockups/) — единственный авторитетный источник по
  визуальному поведению. Изменение дизайна = правка мокапа.
- **`styleguide/`** — живая страница со всеми компонентами на реальных
  токенах. Открывается локально, без сборки.
- **CSS-переменные** в `packages/tokens/src/tokens.css` — фиксируют палитру.
  Любой цвет/радиус/токен в продукте идёт отсюда.

## Принципы

1. **Token-first.** Никаких хардкоженных цветов или размеров в коде. Только
   CSS-переменные и типизированный экспорт из `@wowhaus-24/ui-tokens`.
2. **Frame-agnostic ядро.** `ui-tokens` не зависит от React, Vue или чего бы
   то ни было. Vanilla CSS + vanilla JS API для смены темы.
3. **Headless React.** `ui-react` использует Radix Primitives для a11y и
   Floating UI для позиционирования. Стили — только из tokens, не CSS-in-JS.
4. **Без Tailwind.** Мокапы написаны на CSS Modules + переменные —
   переносим один-в-один.
5. **Mockup-first.** Прежде чем писать компонент, открой соответствующий
   HTML-мокап и используй его CSS как источник.

## Структура репо

```
wh-ui/
├── packages/
│   ├── tokens/          @wowhaus-24/ui-tokens (frame-agnostic)
│   └── react/           @wowhaus-24/ui-react (React headless)
├── mockups/             HTML-эталоны UI
├── styleguide/          живой preview примитивов
├── icons/               SVG (lucide-subset, kebab-case, currentColor)
└── .github/workflows/
```

## Использование

В сервисе на React (например `wiki-web`):

```ts
// main.tsx или app entrypoint
import '@wowhaus-24/ui-tokens/tokens.css'
import '@wowhaus-24/ui-tokens/base.css'
import { ThemeProvider } from '@wowhaus-24/ui-react'

createRoot(...).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
)
```

В сервисе без React (Go-templates, plain HTML):

```html
<link rel="stylesheet" href="/path/to/@wowhaus-24/ui-tokens/tokens.css">
<link rel="stylesheet" href="/path/to/@wowhaus-24/ui-tokens/base.css">
<script type="module">
  import { setTheme } from '/path/to/@wowhaus-24/ui-tokens/theme.js'
  setTheme('dark')
</script>
```

## Контракт версионирования

SemVer. Бамп правил:

- **Major** — breaking change в токенах (переименование, удаление
  переменной), удаление компонента
- **Minor** — новый токен, новый компонент, новая опциональная prop
- **Patch** — фикс цвета/радиуса в рамках существующих токенов, баг-фиксы

## Разработка

```bash
npm install              # монорепо, npm workspaces
npm run typecheck        # проверка всех пакетов
npm run build            # сборка всех пакетов
```

Открыть мокапы:
```bash
open mockups/index.html
open mockups/hub-mockup.html
```

Открыть styleguide:
```bash
open styleguide/index.html
```

## Workflow внесения изменений

1. Открой мокап (`mockups/<surface>-mockup.html`) и убедись что нужное
   поведение там зафиксировано. Если нет — сначала правка мокапа отдельным
   PR с пометкой `mockup:`.
2. Если меняется токен — правишь `tokens.css`, обновляешь `tokens.ts`,
   проверяешь dark-вариант.
3. Если меняется компонент — правишь `packages/react/src/`, открываешь
   styleguide для визуальной проверки.
4. Bump версии пакета по SemVer.

## ADR

Решения по стеку фиксируются в репо `wiki-docs/docs/adr/`.
Релевантные ADR:

- ADR-0006 (TBD) — frontend stack & style provider — общий выбор стека
  для сервисов на React, обоснование выделения wh-ui в отдельный репо.
