/**
 * Размещение портального всплывающего (список выбора, календарь) у контрола.
 *
 * Раньше всплывающее всегда вставало под контролом: у нижнего края окна
 * (поле в конце формы, телефон 375×812) календарь уходил за экран вместе с
 * «Сегодня» и «Очистить». Теперь — под контролом, если там хватает места,
 * иначе над ним (если сверху места больше); по горизонтали не выходит за
 * края окна; высота ограничена местом, которое есть.
 */
export interface PopoverPlace {
  top: number
  left: number
  /** Сколько места по высоте реально есть — отдать в max-height. */
  maxHeight: number
  /** Открыто вверх. */
  flipped: boolean
}

const GAP = 4
const MARGIN = 8

export function placePopover(anchor: DOMRect, size: { width: number; height: number }): PopoverPlace {
  const vh = window.innerHeight
  const vw = window.innerWidth
  const below = vh - anchor.bottom - GAP - MARGIN
  const above = anchor.top - GAP - MARGIN
  const flipped = size.height > below && above > below
  const room = Math.max(120, flipped ? above : below)
  const h = Math.min(size.height, room)
  const top = flipped ? Math.max(MARGIN, anchor.top - GAP - h) : anchor.bottom + GAP
  const left = Math.max(MARGIN, Math.min(anchor.left, vw - size.width - MARGIN))
  return { top, left, maxHeight: room, flipped }
}

/** Подсвеченная стрелками строка — в поле зрения списка. */
export function revealOption(id: string | undefined): void {
  if (!id) return
  const el = document.getElementById(id)
  if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' })
}
