/**
 * Цитаты `[n]` в тексте ответа → отдельные узлы, которые Markdown рисует
 * чипами. Плагин remark: текстовый узел «см. [1] и [2]» распадается на
 * текст / цитата / текст / цитата. Внутри кода и ссылок текст не трогаем —
 * там `[1]` часть кода или подписи.
 */

interface MdNode {
  type: string
  value?: string
  children?: MdNode[]
  data?: Record<string, unknown>
}

const CITE_RE = /\[(\d{1,3})\]/g

/** Имя элемента, в который превращается цитата (см. components в Markdown). */
export const CITATION_TAG = 'brain-cite'

export type CitationFilter = (n: number) => boolean

/** Делит строку на текст и номера цитат. */
export function splitCitations(text: string, keep: CitationFilter): (string | { n: number })[] {
  const out: (string | { n: number })[] = []
  let last = 0
  for (const m of text.matchAll(CITE_RE)) {
    const n = Number(m[1])
    if (!keep(n)) continue
    const start = m.index ?? 0
    if (start > last) out.push(text.slice(last, start))
    out.push({ n })
    last = start + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

const SKIP = new Set(['link', 'linkReference', 'inlineCode', 'code'])

export function remarkCitations(keep: CitationFilter) {
  return () => (tree: MdNode) => {
    const walk = (node: MdNode) => {
      if (!node.children) return
      if (SKIP.has(node.type)) return
      const next: MdNode[] = []
      for (const child of node.children) {
        if (child.type === 'text' && child.value) {
          const parts = splitCitations(child.value, keep)
          if (parts.length === 1 && typeof parts[0] === 'string') {
            next.push(child)
            continue
          }
          for (const p of parts) {
            next.push(
              typeof p === 'string'
                ? { type: 'text', value: p }
                : {
                    type: 'brainCitation',
                    data: { hName: CITATION_TAG, hProperties: { 'data-n': String(p.n) } },
                    children: [],
                  },
            )
          }
        } else {
          walk(child)
          next.push(child)
        }
      }
      node.children = next
    }
    walk(tree)
  }
}
