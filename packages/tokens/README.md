# @wowhaus/ui-tokens

Frame-agnostic design tokens and theme API. Used by every Wowhaus service
that needs the brand look.

## Install

```bash
npm install @wowhaus/ui-tokens
```

## Use the styles

Import once at app entry, before any other CSS:

```ts
import '@wowhaus/ui-tokens/tokens.css'
import '@wowhaus/ui-tokens/base.css'
```

`tokens.css` declares `:root` custom properties + dark-theme overrides.
`base.css` is a small reset (box-sizing, body font, focus-visible).

## Theme switching

```ts
import { initTheme, setMode, toggleTheme, subscribe } from '@wowhaus/ui-tokens/theme'

// Apply persisted/system theme as early as possible (avoids FOUC).
initTheme()

// User clicks the theme toggle
toggleTheme()

// Or set explicitly
setMode('dark')   // 'light' | 'dark' | 'system'

// React to changes (e.g. update icon)
const unsub = subscribe((theme) => console.log('theme:', theme))
```

The theme is applied as `<html data-theme="dark">`. CSS in `tokens.css`
keys off this attribute.

## Typed tokens

For TS code that needs to reference a token (inline style, CSS-in-JS
escape hatch):

```ts
import { colors, radii, fonts, articleTypeColor, statusToneTriad } from '@wowhaus/ui-tokens'

// Each token is a string like 'var(--terra)' — works in `style={{...}}`
<div style={{ background: colors.terraBg, borderRadius: radii.md }} />

// Type-safe lookups
const c = articleTypeColor['project']  // 'var(--tp-proj)'
const t = statusToneTriad['warn']       // { fg, bg, bd }
```

## Adding a new token

1. Add to `src/tokens.css` under `:root` (and to `html[data-theme="dark"]`
   if it should differ in dark theme).
2. Add to `src/tokens.ts` in the appropriate group.
3. Bump `version` in `package.json` (minor for new token, major for
   rename/removal).

## Why no CSS-in-JS

Tokens are static. The mockups (in `wh-ui/mockups/`) are written in
plain CSS. Keeping the runtime path the same is faster, smaller, and
makes copy-paste from mockups trivial.
