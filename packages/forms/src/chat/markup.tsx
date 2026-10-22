/**
 * Лёгкая разметка сообщений ленты — то, что даёт кнопка «A» панели:
 * **жирный**, _курсив_, ~~зачёркнутый~~, `код`, строки «- » — список.
 * Плюс ссылки http(s) и упоминания @Фамилия Имя.
 *
 * Разбор в React-элементы, без innerHTML: текст сообщения — ввод
 * пользователя, и HTML из него не исполняется никогда.
 */
import type { ReactNode } from 'react'

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'bold' | 'italic' | 'strike'; children: Inline[] }
  | { kind: 'code'; text: string }
  | { kind: 'link'; href: string }
  | { kind: 'mention'; name: string }

export type Block = { kind: 'para'; lines: Inline[][] } | { kind: 'list'; items: Inline[][] }

const WRAPS: Array<{ mark: string; kind: 'bold' | 'italic' | 'strike' }> = [
  { mark: '**', kind: 'bold' },
  { mark: '~~', kind: 'strike' },
  { mark: '_', kind: 'italic' },
]

const LINK = /^https?:\/\/[^\s<>"']+/
// Хвостовая пунктуация — не часть ссылки: «см. https://x.ru/a.» без точки.
const LINK_TAIL = /[.,;:!?)»]+$/

/**
 * Разбор строки. names — упоминаемые имена (длинные сначала): @ и имя целиком,
 * иначе «@Иван» съел бы начало «@Иванов Пётр».
 */
export function parseInline(src: string, names: string[] = []): Inline[] {
  const sorted = [...names].sort((a, b) => b.length - a.length)
  const out: Inline[] = []
  let text = ''
  const flush = () => {
    if (text) out.push({ kind: 'text', text })
    text = ''
  }
  let i = 0
  outer: while (i < src.length) {
    const rest = src.slice(i)
    if (rest.startsWith('`')) {
      const end = src.indexOf('`', i + 1)
      if (end > i + 1) {
        flush()
        out.push({ kind: 'code', text: src.slice(i + 1, end) })
        i = end + 1
        continue
      }
    }
    for (const w of WRAPS) {
      if (!rest.startsWith(w.mark)) continue
      // Подчёркивание внутри слова (snake_case) — не курсив.
      if (w.mark === '_' && i > 0 && /[\p{L}\p{N}]/u.test(src[i - 1] ?? '')) continue
      const end = src.indexOf(w.mark, i + w.mark.length)
      if (end <= i + w.mark.length) continue
      const inner = src.slice(i + w.mark.length, end)
      if (inner.trim() !== inner) continue
      flush()
      out.push({ kind: w.kind, children: parseInline(inner, names) })
      i = end + w.mark.length
      continue outer
    }
    const link = LINK.exec(rest)
    if (link && (i === 0 || /\s|\(/.test(src[i - 1] ?? ''))) {
      const href = link[0].replace(LINK_TAIL, '')
      flush()
      out.push({ kind: 'link', href })
      i += href.length
      continue
    }
    if (rest.startsWith('@')) {
      const name = sorted.find((n) => rest.startsWith('@' + n))
      if (name) {
        flush()
        out.push({ kind: 'mention', name })
        i += name.length + 1
        continue
      }
    }
    text += src[i]
    i++
  }
  flush()
  return out
}

/** Абзацы и списки: строки «- » или «• » подряд — пункты одного списка. */
export function parseBlocks(src: string, names: string[] = []): Block[] {
  const blocks: Block[] = []
  for (const line of src.replace(/\r\n/g, '\n').split('\n')) {
    const item = /^\s*[-•]\s+(.*)$/.exec(line)
    const last = blocks[blocks.length - 1]
    if (item) {
      const parsed = parseInline(item[1] ?? '', names)
      if (last?.kind === 'list') last.items.push(parsed)
      else blocks.push({ kind: 'list', items: [parsed] })
      continue
    }
    const parsed = parseInline(line, names)
    if (last?.kind === 'para') last.lines.push(parsed)
    else blocks.push({ kind: 'para', lines: [parsed] })
  }
  return blocks
}

function renderInline(nodes: Inline[], cls: MarkupClasses): ReactNode[] {
  return nodes.map((n, i) => {
    switch (n.kind) {
      case 'text':
        return <span key={i}>{n.text}</span>
      case 'bold':
        return <strong key={i}>{renderInline(n.children, cls)}</strong>
      case 'italic':
        return <em key={i}>{renderInline(n.children, cls)}</em>
      case 'strike':
        return <s key={i}>{renderInline(n.children, cls)}</s>
      case 'code':
        return (
          <code key={i} className={cls.code}>
            {n.text}
          </code>
        )
      case 'link':
        return (
          <a key={i} href={n.href} target="_blank" rel="noopener noreferrer">
            {n.href}
          </a>
        )
      case 'mention':
        return (
          <span key={i} className={cls.mention}>
            @{n.name}
          </span>
        )
    }
  })
}

export interface MarkupClasses {
  code?: string
  mention?: string
  list?: string
  para?: string
}

/** Текст сообщения в разметке. */
export function Markup({ text, names, classes = {} }: { text: string; names?: string[]; classes?: MarkupClasses }) {
  return (
    <>
      {parseBlocks(text, names).map((b, i) =>
        b.kind === 'list' ? (
          <ul key={i} className={classes.list}>
            {b.items.map((it, j) => (
              <li key={j}>{renderInline(it, classes)}</li>
            ))}
          </ul>
        ) : (
          <p key={i} className={classes.para}>
            {b.lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {renderInline(l, classes)}
              </span>
            ))}
          </p>
        ),
      )}
    </>
  )
}

/**
 * Обернуть выделение textarea в маркер (кнопки форматирования). Без
 * выделения — маркеры вокруг каретки. Возвращает новый текст и выделение.
 */
export function wrapSelection(
  value: string,
  start: number,
  end: number,
  mark: string,
): { value: string; start: number; end: number } {
  const sel = value.slice(start, end)
  return {
    value: value.slice(0, start) + mark + sel + mark + value.slice(end),
    start: start + mark.length,
    end: end + mark.length,
  }
}

/** Строки выделения — в пункты списка «- ». */
export function listSelection(value: string, start: number, end: number): { value: string; start: number; end: number } {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  const lineEndIdx = value.indexOf('\n', end)
  const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx
  const lines = value
    .slice(lineStart, lineEnd)
    .split('\n')
    .map((l) => (/^\s*[-•]\s/.test(l) ? l : `- ${l}`))
    .join('\n')
  const next = value.slice(0, lineStart) + lines + value.slice(lineEnd)
  return { value: next, start: lineStart, end: lineStart + lines.length }
}
