/** Пункт меню «⋯» карточки записи; `'sep'` — разделитель. */
export type MenuEntry =
  | { id: string; label: string; hint?: string; danger?: boolean; onSelect: () => void }
  | 'sep'

/** Убираем разделители в начале, в конце и подряд — пункты бывают скрыты. */
export function cleanSeps(items: MenuEntry[]): MenuEntry[] {
  const out: MenuEntry[] = []
  for (const it of items) {
    if (it === 'sep' && (out.length === 0 || out[out.length - 1] === 'sep')) continue
    out.push(it)
  }
  while (out[out.length - 1] === 'sep') out.pop()
  return out
}
