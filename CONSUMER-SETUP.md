# Подключение @wowhaus-24/ui-* в свой сервис

Эта инструкция — для команды, которая хочет использовать дизайн-систему
Wowhaus в своём React-сервисе.

## Что вы получите

- `@wowhaus-24/ui-tokens` — CSS-переменные (цвета, типографика, spacing,
  shadow, z-index), light + dark тема, vanilla JS theme API
- `@wowhaus-24/ui-react` — React-компоненты: AppShell, Card, Avatar,
  Pill, NavTile, MegaDropdown, StatBar и ещё 7 примитивов

Внутри: CSS Modules + типизированный TS, без CSS-in-JS, без Tailwind.

## 1. Получить доступ к репо

Нужен read-доступ к `WOWHAUS-24/wh24-ui`. Если у вас уже collaborator —
шаг готов. Если нет — попросите у Lenivedz.

## 2. Создать Personal Access Token

В вашем личном профиле GitHub:

1. Settings → Developer settings → **Personal access tokens (classic)**
2. **Generate new token** → классический (не fine-grained — он не
   поддерживает GitHub Packages в ораганизации)
3. Scopes: ✓ `read:packages`
4. Expiration: 1 year (или дольше)
5. Сохраните токен — он показывается один раз

## 3. Локальный setup

Создайте `~/.npmrc` (один раз для всех ваших проектов):

```
//npm.pkg.github.com/:_authToken=<ВАШ_PAT_ИЗ_ШАГА_2>
```

Внутри проекта создайте `.npmrc` (коммитить можно — токена не содержит):

```
@wowhaus-24:registry=https://npm.pkg.github.com
always-auth=true
```

## 4. Установить пакеты

```bash
npm install @wowhaus-24/ui-tokens @wowhaus-24/ui-react
```

## 5. Использовать

В точке входа приложения (`main.tsx` / `app.tsx`):

```tsx
import '@wowhaus-24/ui-tokens/tokens.css'
import '@wowhaus-24/ui-tokens/base.css'

import { ThemeProvider } from '@wowhaus-24/ui-react'

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <YourApp />
  </ThemeProvider>,
)
```

Дальше любой компонент:

```tsx
import { Card, TypeBadge, BestPracticeBadge } from '@wowhaus-24/ui-react'

function ProjectCard() {
  return (
    <Card variant="cover" bestPractice markerSlot={<TypeBadge type="project" />}>
      Содержимое
    </Card>
  )
}
```

## 6. CI/CD

Если ваш сервис собирается в GitHub Actions, добавьте в workflow:

```yaml
permissions:
  contents: read
  packages: read

steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version: "20"
      registry-url: "https://npm.pkg.github.com"
      scope: "@wowhaus-24"
      cache: npm

  - name: npm ci
    run: npm ci
    env:
      # Если ваш репо в WOWHAUS-24 org — используйте GITHUB_TOKEN.
      # Если в другом владельце — добавьте секрет с PAT (см. шаг 2).
      NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      # либо: ${{ secrets.WH24_UI_TOKEN }} с PAT
```

## Темы

Светлая по умолчанию, тёмная — атрибут `data-theme="dark"` на `<html>`.

```tsx
import { useTheme } from '@wowhaus-24/ui-react'

function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return <button onClick={toggle}>{theme === 'dark' ? '☀' : '☾'}</button>
}
```

Persistence в `localStorage['wh-ui-theme']`. Cross-tab sync есть.
Чтобы избежать FOUC — добавьте inline-скрипт в `<head>` ДО React:

```html
<script>
  (function () {
    var t = localStorage.getItem('wh-ui-theme')
    if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
  })()
</script>
```

## Версионирование (SemVer)

- **Patch** (0.1.0 → 0.1.1) — баг-фиксы, обратная совместимость
- **Minor** (0.1.0 → 0.2.0) — новые токены, новые компоненты, новые
  опциональные props
- **Major** (0.1.0 → 1.0.0) — breaking changes (rename токена,
  удаление компонента, breaking API change)

Меняем зависимость в своём `package.json` явно — `^0.1.0` ловит patch
+ minor, `~0.1.0` только patch, `0.1.0` пин.

## Что нельзя

- Хардкодить цвет/размер/радиус, который есть как токен — берите из `var(--…)`
- Импортировать из internal-путей `@wowhaus-24/ui-react/dist/...` —
  только из root entry
- Изменять компоненты у себя в проекте через `!important` — если
  чего-то не хватает, заведите issue / PR в репо `WOWHAUS-24/wh24-ui`

## Поддержка

- Issue: https://github.com/WOWHAUS-24/wh24-ui/issues
- Style guide (визуальный preview всех компонентов):
  ```bash
  git clone git@github.com:WOWHAUS-24/wh24-ui.git
  cd wh24-ui
  npm install
  npm run dev:styleguide  # → http://localhost:5174
  ```
