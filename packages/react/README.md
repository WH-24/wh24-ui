# @wowhaus/ui-react

React-side helpers over `@wowhaus/ui-tokens`. Currently exports a
`ThemeProvider` + `useTheme` hook. Headless primitives (Pill, NavTile,
StatBar, etc.) will land here as we migrate them out of `wiki-web`.

## Install

```bash
npm install @wowhaus/ui-react @wowhaus/ui-tokens
```

`react` and `react-dom` are peer dependencies — your app provides them.

## Usage

```tsx
import '@wowhaus/ui-tokens/tokens.css'
import '@wowhaus/ui-tokens/base.css'
import { ThemeProvider, useTheme } from '@wowhaus/ui-react'

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
