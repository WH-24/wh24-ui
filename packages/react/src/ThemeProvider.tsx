import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  getMode,
  getTheme,
  initTheme,
  setMode as setModeInternal,
  subscribe,
  toggleTheme as toggleThemeInternal,
  type Theme,
  type ThemeMode,
} from '@wowhaus-24/ui-tokens/theme'

interface ThemeContextValue {
  /** Resolved theme currently applied to <html>. */
  theme: Theme
  /** User's mode preference (may be 'system'). */
  mode: ThemeMode
  /** Set explicit mode. */
  setMode: (mode: ThemeMode) => void
  /** Flip light ↔ dark. Returns the new theme. */
  toggle: () => Theme
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export interface ThemeProviderProps {
  children: ReactNode
  /**
   * If true (default), runs `initTheme()` on mount — applies persisted
   * theme to <html>, wires up cross-tab and system-preference syncing.
   * Set to false if your app initializes the theme earlier (e.g. via an
   * inline script in the HTML head to avoid FOUC).
   */
  initOnMount?: boolean
}

export function ThemeProvider({ children, initOnMount = true }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => (typeof document === 'undefined' ? 'light' : getTheme()))
  const [mode, setModeState] = useState<ThemeMode>(() => getMode())

  useEffect(() => {
    if (initOnMount) initTheme()
    setTheme(getTheme())
    setModeState(getMode())

    const unsubscribe = subscribe((next) => {
      setTheme(next)
      setModeState(getMode())
    })
    return unsubscribe
  }, [initOnMount])

  const setMode = useCallback((next: ThemeMode) => {
    setModeInternal(next)
  }, [])

  const toggle = useCallback(() => toggleThemeInternal(), [])

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, mode, setMode, toggle }),
    [theme, mode, setMode, toggle],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

/**
 * Read the current theme and mode controls. Throws if used outside
 * <ThemeProvider>.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (ctx === null) {
    throw new Error('useTheme must be used within a <ThemeProvider>')
  }
  return ctx
}
