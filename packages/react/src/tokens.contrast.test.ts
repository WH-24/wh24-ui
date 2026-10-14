import { beforeAll, describe, expect, it } from 'vitest'

// Тёмная тема переопределяла подложки статусов (--good-bg…), но не сам цвет
// текста: --bad #a32d2d на тёмной поверхности давал ~2.5:1 (норма WCAG AA
// 4.5:1). Приложения латали это у себя (портал: --danger-fg #f87171).
// Теперь — в токенах. Для сплошных заливок под белым текстом (кнопка при
// наведении, уведомление) — отдельные --*-strong, тёмные в обеих темах.
let css = ''
beforeAll(async () => {
  const fs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as {
    readFileSync: (p: string, enc: string) => string
  }
  // Путь от папки пакета: vitest запускается оттуда (npm test --workspaces).
  css = fs.readFileSync('../tokens/src/tokens.css', 'utf8')
})

const block = (sel: string) => css.split(sel)[1]?.split('\n}')[0] ?? ''
const hex = (b: string, n: string) => b.match(new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6})\\b`))?.[1]
function lum(h: string) {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  const l = c.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]
}
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

describe('статусные цвета — контраст в обеих темах', () => {
  it('контроль: формула', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0)
  })

  it('тёмная тема: текст статусов ≥ 4.5 на всех поверхностях', () => {
    expect(css.length).toBeGreaterThan(1000)
    const dark = block("html[data-theme='dark'] {")
    for (const s of ['good', 'warn', 'bad', 'info']) {
      const fg = hex(dark, s)
      expect(fg, `тёмный --${s}`).toBeTruthy()
      for (const surf of ['bg', 'surf', 'surf-2', 'surf-3']) {
        expect(contrast(fg!, hex(dark, surf)!), `--${s} на --${surf}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('сплошные заливки: белый на --*-strong ≥ 4.5 (одинаково в обеих темах)', () => {
    const root = block(':root {')
    for (const s of ['good', 'warn', 'bad', 'info']) {
      const bg = hex(root, `${s}-strong`)
      expect(bg, `--${s}-strong`).toBeTruthy()
      expect(contrast('#ffffff', bg!), `белый на --${s}-strong`).toBeGreaterThanOrEqual(4.5)
    }
  })
})
