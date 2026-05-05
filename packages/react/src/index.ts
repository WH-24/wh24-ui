/**
 * @wowhaus/ui-react
 *
 * React-side helpers over @wowhaus/ui-tokens. CSS is consumed from the
 * tokens package — import it once at app entry:
 *
 *   import '@wowhaus/ui-tokens/tokens.css'
 *   import '@wowhaus/ui-tokens/base.css'
 *   import { ThemeProvider } from '@wowhaus/ui-react'
 */

export { ThemeProvider, useTheme } from './ThemeProvider.js'
export type { ThemeProviderProps } from './ThemeProvider.js'

// Re-export token types for convenience so consumers don't need a
// separate import for typing purposes.
export type {
  ArticleType,
  StatusTone,
  StatusTriad,
  Theme,
  ThemeMode,
} from '@wowhaus/ui-tokens'
