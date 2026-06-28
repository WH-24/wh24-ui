/**
 * Бренд-настройки сервиса (логотип/цвет/шрифт/радиусы/название) и их применение
 * в рантайме как CSS-переменные. Источник истины — общий, чтобы и портал, и
 * встроенные модули (АХО/Вики) применяли бренд одинаково.
 *
 * Поля совпадают с JSON бэкенда (wowhaus-api /brand-settings), чтобы консьюмеры
 * передавали полученный объект как есть. Пустые поля = дефолт токена (не трогаем).
 */
export interface BrandSettings {
  /** S3-presigned URL логотипа (пусто = фолбэк на текущий знак). */
  logo_url?: string
  /** Бренд-цвет, hex `#rrggbb` (пусто = терракот по умолчанию). */
  brand_color?: string
  /** Ключ подключённого шрифта: 'inter' | 'manrope' | 'ibm-plex'. */
  font_family?: string
  /** Шкала скруглений: 'compact' | 'default' | 'rounded'. */
  radius_scale?: string
  /** Имя сервиса для заголовка вкладки/тултипа (пусто = «WH Portal»). */
  app_name?: string
  /** Стиль прелоадера: 'spinner' | 'dots' | 'bar'. */
  preloader_style?: string
}

const FONT_STACKS: Record<string, string> = {
  inter: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  manrope: "'Manrope', 'Manrope Variable', system-ui, -apple-system, sans-serif",
  'ibm-plex': "'IBM Plex Sans', system-ui, -apple-system, sans-serif",
}

interface RadiusSet {
  xs: string
  sm: string
  md: string
  lg: string
  xl: string
}

const RADIUS_SCALES: Record<string, RadiusSet> = {
  compact: { xs: '2px', sm: '3px', md: '5px', lg: '7px', xl: '10px' },
  default: { xs: '4px', sm: '6px', md: '10px', lg: '14px', xl: '20px' },
  rounded: { xs: '6px', sm: '10px', md: '14px', lg: '20px', xl: '28px' },
}

/** `#rrggbb` → [r,g,b] (0..255); null при некорректном вводе. */
function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m || m[1] === undefined) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const toHex = (r: number, g: number, b: number): string =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')

/** Затемнить цвет на долю `amount` (0..1). */
function darken(hex: string, amount: number): string {
  const rgb = parseHex(hex)
  if (!rgb) return hex
  return toHex(rgb[0] * (1 - amount), rgb[1] * (1 - amount), rgb[2] * (1 - amount))
}

/** Полупрозрачный тинт цвета (rgba) с заданной альфой. */
function tint(hex: string, alpha: number): string {
  const rgb = parseHex(hex)
  if (!rgb) return hex
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`
}

/**
 * Применить бренд-настройки к документу (или иному корню) через CSS-переменные.
 * Покрывает оба семейства токенов: design-system портала (`--primary*`,
 * `--radius-*`) и ui-tokens модулей (`--terra*`, `--r-*`). Мост `--accent-*`
 * в портале ссылается на `--terra*`, поэтому отдельно его не трогаем.
 */
export function applyBrand(
  s: BrandSettings | null | undefined,
  root: HTMLElement = document.documentElement,
): void {
  if (!s) return
  const set = (k: string, v: string) => root.style.setProperty(k, v)

  if (s.brand_color && parseHex(s.brand_color)) {
    const c = s.brand_color
    const d = darken(c, 0.18)
    // Портал (design-system).
    set('--primary', c)
    set('--primary-strong', d)
    set('--primary-subtle', tint(c, 0.12))
    // Модули + мост портала (ui-tokens).
    set('--terra', c)
    set('--terra-d', d)
    set('--terra-bg', tint(c, 0.1))
    set('--terra-bd', tint(c, 0.45))
  }

  const stack = s.font_family ? FONT_STACKS[s.font_family] : undefined
  if (stack) {
    set('--font-sans', stack)
  }

  const r = s.radius_scale ? RADIUS_SCALES[s.radius_scale] : undefined
  if (r) {
    set('--radius-xs', r.xs)
    set('--radius-sm', r.sm)
    set('--radius-md', r.md)
    set('--radius-lg', r.lg)
    set('--radius-xl', r.xl)
    set('--r-xs', r.xs)
    set('--r-sm', r.sm)
    set('--r-md', r.md)
    set('--r-lg', r.lg)
    set('--r-xl', r.xl)
  }
}

/** Доступные шрифты/шкалы — для UI-редактора бренда. */
export const BRAND_FONTS = Object.keys(FONT_STACKS)
export const BRAND_RADIUS_SCALES = Object.keys(RADIUS_SCALES)
