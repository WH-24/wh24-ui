# Local dev workspace setup

Это инструкция по локальной настройке рабочей копии для работы с
несколькими нашими репозиториями одновременно.

## Зачем

`wh-ui` (дизайн-система) — отдельный git-репозиторий. `wiki-web`
(фронт вики) импортирует из него `@wowhaus/ui-react` и
`@wowhaus/ui-tokens`. Чтобы изменения в wh-ui мгновенно подхватывались
в wiki-web без публикации в npm-registry — настраиваем локальный
npm workspace на уровне общей директории.

## Требования

- Node.js ≥ 18, npm ≥ 7 (для workspaces)
- Все четыре репозитория клонированы рядом:

```
~/Documents/Codding/deploy/   ← workspace-root
├── wiki-docs/.git              (текущий репо документации)
├── wiki-api/                   (Go backend)
├── wiki-web/                   (React frontend)
└── wh-ui/                      (design system)
```

## Установка

1. Создай `package.json` в `deploy/` (gitignored, локальный glue):

```json
{
  "name": "wowhaus-dev-workspace",
  "private": true,
  "workspaces": [
    "wiki-web",
    "wh-ui/packages/*",
    "wh-ui/apps/*"
  ],
  "scripts": {
    "build:ui": "npm run build -w @wowhaus/ui-tokens -w @wowhaus/ui-react",
    "test:ui": "npm test -w @wowhaus/ui-react",
    "dev:wiki-web": "npm run dev -w wiki-web",
    "dev:styleguide": "npm run dev -w @wowhaus/ui-styleguide"
  }
}
```

2. Из `deploy/` запусти один раз:

```bash
npm install
```

Это создаст:
- `deploy/node_modules/` — общий, hoisted
- `deploy/node_modules/@wowhaus/ui-react` → симлинк на `wh-ui/packages/react`
- `deploy/node_modules/@wowhaus/ui-tokens` → симлинк на `wh-ui/packages/tokens`
- `deploy/node_modules/@wowhaus/ui-styleguide` → симлинк на `wh-ui/apps/styleguide`
- `wiki-web/node_modules/` минимальный (только wiki-web-specific deps,
  всё остальное hoisted в корень)

3. Собери wh-ui один раз чтобы заполнить `dist/`:

```bash
npm run build:ui
```

Без этого wiki-web TS не найдёт типы.

## Workflow при разработке

### Изменил Card в wh-ui — хочу увидеть в wiki-web

1. Правишь файл в `wh-ui/packages/react/src/Card/`
2. Запускаешь rebuild ui-react:
   ```bash
   npm run build -w @wowhaus/ui-react
   # или watch:
   cd wh-ui && tsc -b -w
   ```
3. Vite в wiki-web подхватит изменения через симлинк автоматически.
   Если не подхватил — `Ctrl+R` в браузере.

### Запуск styleguide-app

```bash
npm run dev:styleguide  # → http://localhost:5174
```

Все 14 примитивов с light/dark toggle.

### Запуск wiki-web

```bash
npm run dev:wiki-web  # → http://localhost:5173 (или какой указан в vite.config)
```

## CI и production

Этот workspace — **только для локальной разработки**. В CI каждый репо
собирается изолированно через свой `package.json`. Когда wh-ui
стабилизируется и появится потребность в нескольких consumer-сервисах
— переход на private npm-registry / GitHub Packages с published
версиями (см. ADR-TBD).

## Что НЕ делать

- Не коммить `deploy/package.json` ни в один из под-репозиториев —
  это локальный glue
- Не добавлять в `wiki-web/package.json` `file:../wh-ui/...` — это
  обходит workspace-resolver и ломает hoisting
- Не запускать `npm install` внутри `wh-ui/` или `wiki-web/`
  отдельно когда есть workspace-root в `deploy/` — node_modules
  разъедутся. Вместо этого запускай из `deploy/`

## Troubleshooting

**`Cannot find module '@wowhaus/ui-react'`** — сделай
`npm run build:ui` из `deploy/`. tsc не запустится автоматически на
install.

**TypeScript видит старые типы** — рестартуй TS-сервер в IDE
(VS Code: `Cmd+Shift+P` → `TypeScript: Restart TS Server`).

**Vite показывает старый CSS** — рестартуй `npm run dev:wiki-web`.
HMR через симлинки иногда теряет file-watcher.

**Хочу работать только в wh-ui standalone** — `cd wh-ui && rm -rf
node_modules && npm install` создаст изолированный workspace внутри
wh-ui. Но для интеграции с wiki-web нужно вернуть deploy-уровень.
