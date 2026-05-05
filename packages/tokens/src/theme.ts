/**
 * Vanilla theme API — frame-agnostic.
 *
 * Theme is applied as `data-theme` attribute on <html>. Persistence in
 * localStorage. Subscribers are notified when theme changes from any
 * source (manual call, storage event from another tab, system preference
 * change while in 'system' mode).
 */

export type Theme = 'light' | 'dark'
export type ThemeMode = Theme | 'system'

const STORAGE_KEY = 'wh-ui-theme'
const ATTR = 'data-theme'

type Listener = (theme: Theme) => void

const listeners = new Set<Listener>()

function isBrowser(): boolean {
  return typeof document !== 'undefined' && typeof window !== 'undefined'
}

function systemPrefersDark(): boolean {
  if (!isBrowser() || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function readMode(): ThemeMode {
  if (!isBrowser()) return 'system'
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored
    }
  } catch {
    // localStorage may be unavailable (SSR, privacy mode)
  }
  return 'system'
}

function modeToTheme(mode: ThemeMode): Theme {
  if (mode === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return mode
}

function applyTheme(theme: Theme): void {
  if (!isBrowser()) return
  document.documentElement.setAttribute(ATTR, theme)
}

function notify(theme: Theme): void {
  for (const fn of listeners) fn(theme)
}

/**
 * Read the currently active theme (resolved — never returns 'system').
 */
export function getTheme(): Theme {
  if (!isBrowser()) return 'light'
  const attr = document.documentElement.getAttribute(ATTR)
  if (attr === 'light' || attr === 'dark') return attr
  return modeToTheme(readMode())
}

/**
 * Read the user's mode preference (may be 'system').
 */
export function getMode(): ThemeMode {
  return readMode()
}

/**
 * Set theme mode. Persists to localStorage. 'system' tracks
 * `prefers-color-scheme` and updates live.
 */
export function setMode(mode: ThemeMode): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // ignore
  }
  const theme = modeToTheme(mode)
  applyTheme(theme)
  notify(theme)
}

/**
 * Convenience: set theme directly (light or dark). Equivalent to
 * `setMode(theme)` but typed narrower.
 */
export function setTheme(theme: Theme): void {
  setMode(theme)
}

/**
 * Toggle between light and dark. If currently in 'system' mode, switches
 * to the opposite of whatever system was resolving to.
 */
export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark'
  setMode(next)
  return next
}

/**
 * Subscribe to theme changes. Returns an unsubscribe function.
 */
export function subscribe(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/**
 * Initialize: applies persisted (or system) theme to <html>, wires up
 * cross-tab and system-preference syncing. Idempotent — safe to call
 * multiple times. Call as early as possible (before first paint) to
 * avoid FOUC.
 */
export function initTheme(): Theme {
  if (!isBrowser()) return 'light'

  const theme = modeToTheme(readMode())
  applyTheme(theme)

  // Cross-tab sync via storage events.
  if (!initTheme.wired) {
    window.addEventListener('storage', (e) => {
      if (e.key !== STORAGE_KEY) return
      const next = modeToTheme(readMode())
      applyTheme(next)
      notify(next)
    })

    // System-preference live updates (only matters when mode === 'system').
    if (window.matchMedia) {
      const mql = window.matchMedia('(prefers-color-scheme: dark)')
      const onChange = () => {
        if (readMode() !== 'system') return
        const next = modeToTheme('system')
        applyTheme(next)
        notify(next)
      }
      // Modern browsers
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', onChange)
      } else if (typeof (mql as MediaQueryList & { addListener?: (fn: () => void) => void }).addListener === 'function') {
        // Safari < 14 fallback
        ;(mql as MediaQueryList & { addListener: (fn: () => void) => void }).addListener(onChange)
      }
    }

    initTheme.wired = true
  }

  return theme
}
initTheme.wired = false as boolean
