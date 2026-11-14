import { useEffect, useRef, type RefObject } from 'react'

import { motionEase, motionMs } from './motion.js'

/** Ширина, до которой окна и боковая панель встают листом снизу (STYLEGUIDE, §5). */
const SHEET_QUERY = '(max-width: 640px)'

/** Сейчас телефон: `Modal`, подтверждение и `Drawer` — лист снизу. */
export function isSheet(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(SHEET_QUERY).matches
}

/** Смахивание листа: дальше этого — закрыть; либо быстрый короткий жест. */
const CLOSE_DISTANCE = 110
const CLOSE_VELOCITY = 0.5
const CLOSE_MIN = 24

/**
 * Лист снизу на телефоне закрывается смахиванием вниз за шапку. Работает,
 * только когда окно можно отменить (`onClose` есть) и ширина — телефонная;
 * на шапку ставится `data-swipe` — по нему CSS рисует «ручку».
 *
 * Жест: указатель захватывается, лист идёт за пальцем без перехода; отпустили
 * дальше порога или быстрым движением — `onClose` (выход доигрывается с того
 * места, где лист отпущен), иначе лист возвращается. Второй палец жест не
 * перехватывает; кнопки шапки жест не начинают.
 */
export function useSheetSwipe(cardRef: RefObject<HTMLElement | null>, onClose: (() => void) | undefined, active = true): void {
  const cb = useRef(onClose)
  cb.current = onClose
  const can = Boolean(onClose) && active
  useEffect(() => {
    const card = cardRef.current
    const head = card?.querySelector<HTMLElement>('[data-dialog-head]')
    if (!card || !head || !can) return
    head.dataset.swipe = ''
    let drag: { id: number; y0: number; t0: number; dy: number } | null = null
    const settle = () => {
      card.style.transition = `transform ${motionMs('--dur-base')}ms ${motionEase('--ease-out')}`
      card.style.transform = ''
      window.setTimeout(() => {
        card.style.transition = ''
      }, motionMs('--dur-base') + 50)
    }
    const down = (e: PointerEvent) => {
      if (drag || !isSheet() || (e.pointerType === 'mouse' && e.button !== 0)) return
      if ((e.target as Element).closest('button, a, input, select, textarea')) return
      drag = { id: e.pointerId, y0: e.clientY || 0, t0: Date.now(), dy: 0 }
      head.setPointerCapture?.(e.pointerId)
      card.style.transition = 'none'
    }
    const move = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      drag.dy = Math.max(0, (e.clientY || 0) - drag.y0)
      card.style.transform = `translateY(${drag.dy}px)`
    }
    const end = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      const { dy, t0 } = drag
      drag = null
      const velocity = dy / Math.max(1, Date.now() - t0)
      if (e.type === 'pointerup' && (dy > CLOSE_DISTANCE || (velocity > CLOSE_VELOCITY && dy > CLOSE_MIN))) {
        card.style.transition = ''
        cb.current?.()
        // Хост окно не закрыл (спросил «Сохранить изменения?») — лист на место.
        window.setTimeout(() => {
          const state = card.closest<HTMLElement>('[data-state]')?.dataset.state
          if (card.isConnected && state === 'open') settle()
        }, 60)
      } else settle()
    }
    head.addEventListener('pointerdown', down)
    head.addEventListener('pointermove', move)
    head.addEventListener('pointerup', end)
    head.addEventListener('pointercancel', end)
    return () => {
      delete head.dataset.swipe
      head.removeEventListener('pointerdown', down)
      head.removeEventListener('pointermove', move)
      head.removeEventListener('pointerup', end)
      head.removeEventListener('pointercancel', end)
    }
  }, [cardRef, can])
}
