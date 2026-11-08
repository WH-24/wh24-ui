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
          // Последнее слово перед номером едет вместе с чипом (`data-lead`):
          // рендер склеивает их в неразрывный кусок, иначе чип-кнопка уезжает
          // на новую строку один — неразрывный пробел перед кнопкой Chrome
          // переносить не мешает.
          let lead: string | undefined
          parts.forEach((p, i) => {
            if (typeof p === 'string') {
              const nextIsCite = i + 1 < parts.length && typeof parts[i + 1] !== 'string'
              const m = nextIsCite ? /(\S+)\s*$/.exec(p) : null
              if (m) {
                if (m.index > 0) next.push({ type: 'text', value: p.slice(0, m.index) })
                lead = m[1]
                return
              }
              next.push({ type: 'text', value: p })
              return
            }
            next.push({
              type: 'brainCitation',
              data: {
                hName: CITATION_TAG,
                hProperties: { 'data-n': String(p.n), ...(lead ? { 'data-lead': lead } : {}) },
              },
              children: [],
            })
            lead = undefined
          })
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

/**
 * Номера источников по порядку появления в тексте: 1, 2, 3… Сервер нумерует
 * фрагменты поиска, и в ответе выходит «[19] … [37] … [38]» — читатель видит
 * случайные числа. Здесь `[n]` в тексте и `n` у источников меняются согласованно:
 * сначала те, на которые сослался текст (в порядке ссылок), потом остальные.
 * Номера, которых нет среди источников, не трогаются.
 */
export function renumberCitations<C extends { n: number }>(
  text: string,
  citations: readonly C[] | undefined | null,
): { text: string; citations: C[] | undefined } {
  if (!citations || citations.length === 0) {
    return { text, citations: citations ? [] : undefined }
  }
  const known = new Set(citations.map((c) => c.n))
  const order = new Map<number, number>()
  for (const m of text.matchAll(CITE_RE)) {
    const n = Number(m[1])
    if (known.has(n) && !order.has(n)) order.set(n, order.size + 1)
  }
  for (const c of [...citations].sort((a, b) => a.n - b.n)) {
    if (!order.has(c.n)) order.set(c.n, order.size + 1)
  }
  return {
    text: text.replace(CITE_RE, (all, d: string) => {
      const k = order.get(Number(d))
      return k ? `[${k}]` : all
    }),
    citations: citations.map((c) => ({ ...c, n: order.get(c.n)! })).sort((a, b) => a.n - b.n),
  }
}
