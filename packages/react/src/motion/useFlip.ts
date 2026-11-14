import { useLayoutEffect, useRef, type RefObject } from 'react'

import { motionEase, motionMs } from '../overlay/motion.js'
import { canAnimate, prefersReducedMotion } from '../overlay/presence.js'

/**
 * Перестановка без прыжка (FLIP): элементы, оставшиеся на экране после
 * удаления, массового изменения или переноса, плавно доезжают до нового
 * места (`--dur-slow`, `--ease-in-out`), новые — проявляются (`--dur-base`).
 *
 * Хук сам ничего не решает о данных: он запоминает места детей с атрибутом
 * `data-flip-id` и проигрывает переезд, когда сменился `trigger`. Что считать
 * поводом — решает вызывающий: `ListPage` передаёт набор строк без порядка
 * (сортировка движения не даёт), канбан — порядок карточек по колонкам.
 *
 *   const ref = useRef<HTMLUListElement>(null)
 *   useFlip(ref, items.map((i) => i.id).join(','))
 *   <ul ref={ref}>{items.map((i) => <li key={i.id} data-flip-id={i.id}>…</li>)}</ul>
 *
 * «Уменьшить движение», тестовый DOM и списки длиннее `maxItems` — без
 * движения: элементы просто встают на место.
 */
export interface FlipOptions {
  /** Выключить движение (например, пока идёт перенос мышью). */
  disabled?: boolean
  /** Больше элементов — не анимируем: замер сотен строк дороже пользы. */
  maxItems?: number
}

export interface FlipRect {
  left: number
  top: number
}

export interface FlipMove {
  id: string
  /** Сдвиг из старого места в новое, px. */
  dx: number
  dy: number
  /** Элемента раньше не было — проявить. */
  enter: boolean
}

/** Что и откуда должно приехать: сравнение мест «до» и «после». */
export function flipMoves(prev: ReadonlyMap<string, FlipRect>, next: ReadonlyMap<string, FlipRect>): FlipMove[] {
  const out: FlipMove[] = []
  next.forEach((n, id) => {
    const o = prev.get(id)
    if (!o) {
      out.push({ id, dx: 0, dy: 0, enter: true })
      return
    }
    const dx = o.left - n.left
    const dy = o.top - n.top
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) out.push({ id, dx, dy, enter: false })
  })
  return out
}

const NO_TRIGGER = Symbol('no-trigger')

function measure(root: HTMLElement, maxItems: number): Map<string, FlipRect> | null {
  const els = root.querySelectorAll<HTMLElement>('[data-flip-id]')
  if (els.length === 0 || els.length > maxItems) return null
  const out = new Map<string, FlipRect>()
  els.forEach((el) => {
    const r = el.getBoundingClientRect()
    out.set(el.dataset.flipId!, { left: r.left, top: r.top })
  })
  return out
}

export function useFlip(
  ref: RefObject<HTMLElement | null>,
  trigger: unknown,
  { disabled = false, maxItems = 400 }: FlipOptions = {},
): void {
  const before = useRef<Map<string, FlipRect> | null>(null)
  const anims = useRef(new Map<string, Animation>())
  const last = useRef<unknown>(NO_TRIGGER)

  // Места «до» снимаются прямо в отрисовке, пока DOM ещё старый: между
  // замером и перестановкой не вклинится прокрутка, а лишних замеров на
  // каждую отрисовку нет. Идущий переезд учитывается сам: место берётся
  // видимое, и новый переезд стартует с него (перебивается без рывка).
  if (last.current !== trigger) {
    const first = last.current === NO_TRIGGER
    last.current = trigger
    const root = ref.current
    before.current =
      !first && !disabled && root && canAnimate(root) && !prefersReducedMotion() ? measure(root, maxItems) : null
  }

  useLayoutEffect(() => {
    const from = before.current
    before.current = null
    const root = ref.current
    if (!from || !root) return
    anims.current.forEach((a) => a.cancel())
    anims.current.clear()
    const next = measure(root, maxItems)
    if (!next) return
    const duration = motionMs('--dur-slow')
    const easing = motionEase('--ease-in-out')
    const viewH = window.innerHeight
    for (const m of flipMoves(from, next)) {
      const el = root.querySelector<HTMLElement>(`[data-flip-id="${CSS.escape(m.id)}"]`)
      if (!el) continue
      // За экраном и до, и после — движения никто не увидит.
      const top = next.get(m.id)!.top
      if ((top < -200 && top + m.dy < -200) || (top > viewH && top + m.dy > viewH)) continue
      const a = m.enter
        ? el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: motionMs('--dur-base'), easing: 'ease' })
        : el.animate([{ transform: `translate(${m.dx}px, ${m.dy}px)` }, { transform: 'none' }], { duration, easing })
      anims.current.set(m.id, a)
      const drop = () => {
        if (anims.current.get(m.id) === a) anims.current.delete(m.id)
      }
      a.finished.then(drop, drop)
    }
  })

  useLayoutEffect(() => {
    const running = anims.current
    return () => {
      running.forEach((a) => a.cancel())
      running.clear()
    }
  }, [])
}
