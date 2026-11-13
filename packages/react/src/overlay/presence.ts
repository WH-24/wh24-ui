import { useCallback, useLayoutEffect, useState, type RefObject } from 'react'

/**
 * Присутствие окна с анимацией выхода. `open: false` не убирает окно из DOM
 * сразу: оно доигрывает выход (`exiting`) и только потом размонтируется.
 * Повторное открытие во время выхода отменяет его — окно остаётся на месте,
 * без мигания.
 */
export function usePresence(open: boolean) {
  const [prevOpen, setPrevOpen] = useState(open)
  const [exiting, setExiting] = useState(false)
  // Производное состояние от смены пропа — без лишнего кадра с эффектом.
  if (open !== prevOpen) {
    setPrevOpen(open)
    setExiting(!open)
  }
  const finish = useCallback(() => setExiting(false), [])
  return { mounted: open || exiting, exiting, finish }
}

export interface ExitLayer {
  ref: RefObject<HTMLElement | null>
  /** Кадры выхода (из текущего вида в скрытый). */
  frames: Keyframe[]
  /** Длительность, мс. */
  duration: number
}

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)'

/**
 * Тестовые DOM (jsdom, happy-dom) анимаций по-настоящему не проигрывают:
 * `finished` там не наступает или ждёт реального времени. Там окно уходит
 * сразу, как до анимаций — тесты потребителей не ждут лишнего.
 */
export function canAnimate(el: Element | null | undefined): el is HTMLElement {
  if (!el || typeof (el as HTMLElement).animate !== 'function') return false
  return !/jsdom|happydom/i.test(navigator.userAgent)
}

export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Проигрывает выход слоёв (подложка, карточка) через Web Animations и зовёт
 * `done`. На время выхода слои `inert` и `aria-hidden`: закрытое окно не
 * ловит клики и фокус и уже не «диалог» для читалки. Нет Web Animations
 * или тестовый DOM — `done` сразу, окно уходит как раньше. При «уменьшить движение» — только короткое затухание: мягче,
 * но смена состояния всё ещё видна.
 */
export function useExitAnimation(exiting: boolean, layers: ExitLayer[], done: () => void): void {
  useLayoutEffect(() => {
    if (!exiting) return
    const els = layers.map((l) => l.ref.current)
    if (!els.every(canAnimate)) {
      done()
      return
    }
    const reduce = prefersReducedMotion()
    els.forEach((el) => {
      el!.setAttribute('inert', '')
      el!.setAttribute('aria-hidden', 'true')
    })
    const anims = layers.map((l, i) =>
      els[i]!.animate(reduce ? [{ opacity: 1 }, { opacity: 0 }] : l.frames, {
        duration: reduce ? Math.min(l.duration, 140) : l.duration,
        easing: EASE_OUT,
        fill: 'forwards',
      }),
    )
    let cancelled = false
    const finish = () => {
      if (!cancelled) {
        cancelled = true
        done()
      }
    }
    Promise.all(anims.map((a) => a.finished)).then(finish, () => {})
    // Страховка: анимация в фоновой вкладке может не закончиться вовремя.
    const fallback = setTimeout(finish, Math.max(...layers.map((l) => l.duration)) + 100)
    return () => {
      cancelled = true
      clearTimeout(fallback)
      anims.forEach((a) => a.cancel())
      els.forEach((el) => {
        el?.removeAttribute('inert')
        // Свой aria-hidden у слоя (подложка панели) не снимаем.
        if (el?.dataset.ariaHiddenOwn !== 'true') el?.removeAttribute('aria-hidden')
      })
    }
    // Слои — новые объекты на каждой отрисовке, но их ref стабильны.
  }, [exiting])
}
