import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react'

import { keyboardInitiated, motionEase, motionMs, motionScale } from './motion.js'

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
  /** Кривая; по умолчанию `--ease-out`. */
  easing?: string
}

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
        duration: reduce ? Math.min(l.duration, motionMs('--dur-base-exit')) : l.duration,
        easing: l.easing ?? motionEase('--ease-out'),
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

/**
 * Присутствие всплывающего (список выбора, календарь, меню): выход
 * доигрывается за `--dur-base-exit` — прозрачность и масштаб `--pop-scale`
 * (`shift` — вместо масштаба сдвиг вверх, для панели во всю ширину).
 *
 * Действие с клавиатуры не анимируется: `instant` — открыто стрелкой,
 * вводом или Tab (на элемент вешается `data-instant`, CSS отключает вход);
 * закрытие с клавиатуры (Esc, Enter) убирает всплывающее сразу.
 */
export function usePopPresence(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  opts: { shift?: string } = {},
): { mounted: boolean; exiting: boolean; instant: boolean } {
  const { mounted, exiting, finish } = usePresence(open)
  const wasOpen = useRef(false)
  const instant = useRef(false)
  const skipExit = useRef(false)
  if (open !== wasOpen.current) {
    wasOpen.current = open
    if (open) instant.current = keyboardInitiated()
    else skipExit.current = keyboardInitiated()
  }
  const skip = exiting && skipExit.current
  useLayoutEffect(() => {
    if (skip) finish()
  }, [skip, finish])
  const play = exiting && !skip
  // Токены читаем только на выходе: getComputedStyle на каждой отрисовке
  // каждого списка формы — лишний пересчёт стилей.
  useExitAnimation(
    play,
    play
      ? [
          {
            ref,
            frames: [
              { opacity: 1, transform: 'none' },
              {
                opacity: 0,
                transform: opts.shift ? `translateY(${opts.shift})` : `scale(${motionScale('--pop-scale')})`,
              },
            ],
            duration: motionMs('--dur-base-exit'),
          },
        ]
      : [],
    finish,
  )
  return { mounted, exiting, instant: instant.current }
}
