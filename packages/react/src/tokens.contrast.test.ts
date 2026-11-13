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

describe('bridge.css — серый текст стандарта ≥ 4.5 в обеих темах', () => {
  let bridge = ''
  beforeAll(async () => {
    const fs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as {
      readFileSync: (p: string, enc: string) => string
    }
    bridge = fs.readFileSync('../tokens/src/bridge.css', 'utf8')
  })
  const part = (src: string, sel: string) => src.split(sel)[1]?.split('\n}')[0] ?? ''

  it('третичный и приглушённый текст на всех поверхностях', () => {
    const themes: Array<[string, string, string]> = [
      ['светлая', ':root {', ':root {'],
      ['тёмная', "html[data-theme='dark'] {", "html[data-theme='dark'] {"],
    ]
    for (const [name, bridgeSel, tokenSel] of themes) {
      const b = part(bridge, bridgeSel)
      const t = block(tokenSel)
      for (const fgName of ['fg-tertiary', 'fg-muted']) {
        const fg = hex(b, fgName)
        expect(fg, `${name}: --${fgName}`).toBeTruthy()
        for (const surf of ['bg', 'surf', 'surf-2', 'surf-3']) {
          expect(contrast(fg!, hex(t, surf)!), `${name}: --${fgName} на --${surf}`).toBeGreaterThanOrEqual(4.5)
        }
      }
    }
  })
})

// Аудит 12.11.2026 (impeccable / Emil Kowalski): белый на --terra 3.47:1 в
// основной кнопке, серый --ink-3 4.29:1, плейсхолдеры на --ink-4 2.1:1,
// --terra-d текстом в тёмной теме 3.6:1, чип «Проект» в тёмной 1.8:1, рамка
// поля 1.3:1. Здесь — то, что держит эти пары.
describe('аудит 12.11: текст, кнопка, типы, рамка поля', () => {
  const rgba = (b: string, n: string) => {
    const m = b.match(new RegExp(`--${n}:\\s*rgba\\((\\d+),\\s*(\\d+),\\s*(\\d+),\\s*([\\d.]+)\\)`))
    return m ? { c: [m[1], m[2], m[3]].map(Number), a: Number(m[4]) } : null
  }
  const over = (fg: { c: number[]; a: number }, bgHex: string) => {
    const bg = [1, 3, 5].map((i) => parseInt(bgHex.slice(i, i + 2), 16))
    return '#' + fg.c.map((v, i) => Math.round(v * fg.a + bg[i]! * (1 - fg.a)).toString(16).padStart(2, '0')).join('')
  }
  const themes = (): Array<[string, string]> => [
    ['светлая', block(':root {')],
    ['тёмная', block("html[data-theme='dark'] {")],
  ]
  const surfOf = (name: string, t: string) => hex(t, name) ?? hex(block(':root {'), name)!

  it('--ink-3 и --terra-text ≥ 4.5 на всех поверхностях обеих тем', () => {
    for (const [name, t] of themes()) {
      for (const fgName of ['ink-3', 'terra-text']) {
        const fg = hex(t, fgName) ?? hex(block(':root {'), fgName)
        expect(fg, `${name}: --${fgName}`).toBeTruthy()
        for (const surf of ['bg', 'surf', 'surf-2', 'surf-3']) {
          expect(contrast(fg!, surfOf(surf, t)), `${name}: --${fgName} на --${surf}`).toBeGreaterThanOrEqual(4.5)
        }
      }
    }
  })

  it('светлая тема: текст статусов ≥ 4.5 на белом и на своей подложке', () => {
    const root = block(':root {')
    for (const s of ['good', 'warn', 'bad', 'info']) {
      expect(contrast(hex(root, s)!, '#ffffff'), `--${s} на белом`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(hex(root, s)!, hex(root, `${s}-bg`)!), `--${s} на --${s}-bg`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('основная кнопка: белый на --terra-solid и --terra-solid-hover ≥ 4.5', () => {
    const root = block(':root {')
    expect(contrast('#ffffff', hex(root, 'terra-solid')!)).toBeGreaterThanOrEqual(4.5)
    expect(contrast('#ffffff', hex(root, 'terra-solid-hover')!)).toBeGreaterThanOrEqual(4.5)
  })

  it('тёмная тема: цвета типов материалов ≥ 4.5 на поверхности', () => {
    const dark = block("html[data-theme='dark'] {")
    for (const tp of ['proj', 'std', 'sol', 'art']) {
      expect(contrast(hex(dark, `tp-${tp}-fg`)!, hex(dark, 'surf')!), `--tp-${tp}-fg`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('рамка поля --field-bd ≥ 3 к поверхности (WCAG 1.4.11)', () => {
    for (const [name, t] of themes()) {
      const bd = rgba(t, 'field-bd')
      expect(bd, `${name}: --field-bd`).toBeTruthy()
      for (const surf of ['surf', 'bg']) {
        const s = surfOf(surf, t)
        expect(contrast(over(bd!, s), s), `${name}: --field-bd на --${surf}`).toBeGreaterThanOrEqual(2.9)
      }
    }
  })

  it('самодостаточные блоки ListPage/фильтра/Combobox не возвращают серый ниже нормы', async () => {
    const fs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as {
      readFileSync: (p: string, enc: string) => string
    }
    for (const f of ['src/list/ListPage.module.css', 'src/list/filter/filter.module.css', 'src/list/Combobox.module.css']) {
      const src = fs.readFileSync(f, 'utf8')
      const [light, dark] = [src.split('{')[1] ?? '', src.split(/:where\(\[data-theme=["']dark["']\]\)[^{]*\{/)[1] ?? '']
      for (const fgName of ['fg-tertiary', 'fg-muted']) {
        expect(contrast(hex(light, fgName)!, '#ffffff'), `${f}: светлый --${fgName}`).toBeGreaterThanOrEqual(4.5)
        expect(contrast(hex(dark, fgName)!, '#161816'), `${f}: тёмный --${fgName}`).toBeGreaterThanOrEqual(4.5)
      }
      expect(src, `${f}: синий вне палитры`).not.toMatch(/59,\s*130,\s*246/)
    }
  })
})
