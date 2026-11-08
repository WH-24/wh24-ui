/*
 * Копирование ответа «как в ChatGPT»: в буфер кладутся сразу два вида —
 * text/html (вставка в Word, почту, Google Docs сохраняет списки, жирный и
 * таблицы) и text/plain с исходным markdown (мессенджеры, поле ввода).
 *
 * Номера источников `[n]` в копию не идут: вне панели им не на что ссылаться.
 * Если Clipboard API недоступен (фрейм без разрешения, старый браузер),
 * остаётся запасной путь через скрытое поле и execCommand('copy') — текстом.
 */

const CITE_RE = /\s?\[(\d{1,3})\]/g

/** Markdown без номеров источников `[n]` (ссылки `[текст](url)` не трогает). */
export function stripCitations(markdown: string): string {
  return markdown.replace(CITE_RE, (m, _n, offset: number, all: string) =>
    all[offset + m.length] === '(' ? m : '',
  )
}

/** HTML отрисованного ответа без кнопок: чипов источников, «Скачать .xlsx». */
export function htmlForCopy(root: Element): string {
  const clone = root.cloneNode(true) as Element
  clone.querySelectorAll('button, [data-copy-skip]').forEach((n) => n.remove())
  return clone.innerHTML
}

/** Кладёт ответ в буфер; `false` — браузер не дал этого сделать. */
export async function copyAnswer(markdown: string, html?: string): Promise<boolean> {
  const text = stripCitations(markdown)
  try {
    if (html && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([text], { type: 'text/plain' }),
          'text/html': new Blob([html], { type: 'text/html' }),
        }),
      ])
      return true
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Нет разрешения на буфер — ниже запасной путь.
  }
  return legacyCopy(text)
}

function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined') return false
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.top = '0'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  ta.remove()
  return ok
}
