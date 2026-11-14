/**
 * Токены движения для кода (Web Animations): единственное место в пакете,
 * где длительности и кривые встречаются числами. Значения читаются из
 * CSS-переменных `ui-tokens/tokens.css` на `<html>`; запасные ниже — на
 * случай, когда `tokens.css` не подключён (тесты, изолированный виджет), и
 * обязаны совпадать с токенами — это проверяет `motion.test.ts`.
 */
export const MOTION_FALLBACK = {
  '--dur-fast': '120ms',
  '--dur-base': '180ms',
  '--dur-slow': '240ms',
  '--dur-panel': '320ms',
  '--dur-base-exit': '135ms',
  '--dur-slow-exit': '180ms',
  '--dur-panel-exit': '240ms',
  '--stagger': '40ms',
  '--pop-scale': '0.96',
  '--modal-scale': '0.97',
  '--enter-shift': '8px',
  '--ease-out': 'cubic-bezier(0.23, 1, 0.32, 1)',
  '--ease-in-out': 'cubic-bezier(0.77, 0, 0.175, 1)',
  '--ease-drawer': 'cubic-bezier(0.32, 0.72, 0, 1)',
} as const

export type MotionToken = keyof typeof MOTION_FALLBACK
type DurationToken = Extract<MotionToken, `--dur-${string}` | '--stagger'>
type EaseToken = Extract<MotionToken, `--ease-${string}`>
type ScaleToken = Extract<MotionToken, `--${string}-scale`>

function read(name: MotionToken): string {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return ''
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  } catch {
    return ''
  }
}

function toMs(value: string): number {
  const m = /^(-?\d*\.?\d+)(ms|s)$/.exec(value)
  if (!m) return NaN
  return m[2] === 's' ? Number(m[1]) * 1000 : Number(m[1])
}

/** Длительность токена в миллисекундах. */
export function motionMs(name: DurationToken): number {
  const ms = toMs(read(name))
  return Number.isFinite(ms) && ms >= 0 ? ms : toMs(MOTION_FALLBACK[name])
}

/** Кривая токена — строкой для `easing` Web Animations. */
export function motionEase(name: EaseToken): string {
  const v = read(name)
  return /^(cubic-bezier\(|linear|ease)/.test(v) ? v : MOTION_FALLBACK[name]
}

/** Масштаб токена числом (`--pop-scale`, `--modal-scale`). */
export function motionScale(name: ScaleToken): number {
  const n = Number(read(name) || NaN)
  return Number.isFinite(n) && n > 0 ? n : Number(MOTION_FALLBACK[name])
}

/** Сдвиг появления, CSS-длиной (`--enter-shift`). */
export function motionShift(): string {
  const v = read('--enter-shift')
  return /^-?\d*\.?\d+(px|rem|em)$/.test(v) ? v : MOTION_FALLBACK['--enter-shift']
}

// ── Чем начато действие: клавиатурой или указателем ──
// Действия с клавиатуры повторяются десятки раз подряд и анимироваться не
// должны: список, открытый стрелкой или вводом, появляется сразу.
let lastInput: 'keyboard' | 'pointer' = 'pointer'
let tracking = false
const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'])

function track(): void {
  if (tracking || typeof window === 'undefined') return
  tracking = true
  window.addEventListener(
    'keydown',
    (e) => {
      if (!MODIFIERS.has(e.key)) lastInput = 'keyboard'
    },
    true,
  )
  const pointer = () => {
    lastInput = 'pointer'
  }
  window.addEventListener('pointerdown', pointer, true)
  window.addEventListener('mousedown', pointer, true)
  window.addEventListener('touchstart', pointer, { capture: true, passive: true })
}
track()

/** Последнее действие пользователя было с клавиатуры. */
export function keyboardInitiated(): boolean {
  track()
  return lastInput === 'keyboard'
}
