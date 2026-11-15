import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

import { placePopover } from '../list/popover.js'

/**
 * Общее для всплывающих у якоря (карточка при наведении, центр уведомлений):
 * место на экране считает `placePopover` из `list/popover` — тот же, что у
 * списка выбора и календаря; здесь только слежение за прокруткой и размером
 * окна и выравнивание по правому краю якоря.
 */
export interface AnchoredPlace {
  top: number
  left: number
  maxHeight: number
  /** Открыто вверх — точка роста анимации снизу. */
  flipped: boolean
}

export function useAnchoredPlace(
  open: boolean,
  anchor: () => Element | null,
  popRef: RefObject<HTMLElement | null>,
  align: 'start' | 'end' = 'start',
): AnchoredPlace | null {
  const [place, setPlace] = useState<AnchoredPlace | null>(null)
  const anchorRef = useRef(anchor)
  anchorRef.current = anchor

  useLayoutEffect(() => {
    if (!open) {
      setPlace(null)
      return
    }
    const update = () => {
      const a = anchorRef.current()
      const pop = popRef.current
      if (!a) return
      const r = a.getBoundingClientRect()
      const width = pop?.offsetWidth ?? 0
      const height = pop?.offsetHeight ?? 0
      // Выравнивание по правому краю — тем же расчётом: якорю подменяем
      // левую границу так, чтобы правые края совпали.
      const rect =
        align === 'end'
          ? ({ top: r.top, bottom: r.bottom, left: r.right - width, right: r.right, width, height: r.height } as DOMRect)
          : r
      const p = placePopover(rect, { width, height })
      setPlace((prev) =>
        prev && prev.top === p.top && prev.left === p.left && prev.maxHeight === p.maxHeight && prev.flipped === p.flipped
          ? prev
          : p,
      )
    }
    update()
    // Второй проход — когда всплывающее уже в DOM и его размер известен.
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(update) : 0
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    // Содержимое догрузилось (карточка выросла) — место пересчитываем, иначе
    // она уходит за нижний край окна.
    const ro = typeof ResizeObserver === 'function' && popRef.current ? new ResizeObserver(update) : null
    if (ro && popRef.current) ro.observe(popRef.current)
    return () => {
      ro?.disconnect()
      if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf)
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open, align, popRef])

  return place
}

/**
 * Палец вместо мыши: после касания браузер досылает «мышиные» события, и
 * всплывающее по наведению открывалось бы от тапа. Наведения на таких
 * устройствах нет — подсказку и карточку не показываем (STYLEGUIDE, §5).
 */
export function hoverUnavailable(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(hover: none)').matches
}

/** Esc закрывает всплывающее, пока оно открыто. */
export function useEscape(active: boolean, onEscape: () => void): void {
  const cb = useRef(onEscape)
  cb.current = onEscape
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      cb.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [active])
}

/** Склейка обработчиков: сначала свой у элемента-якоря, потом наш. */
export function chain<E>(theirs: ((e: E) => void) | undefined, ours: (e: E) => void): (e: E) => void {
  return (e: E) => {
    theirs?.(e)
    ours(e)
  }
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
