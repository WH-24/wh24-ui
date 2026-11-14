import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

import { Icon } from '../list/Icon.js'
import { motionMs } from './motion.js'
import { canAnimate } from './presence.js'

import styles from './overlay.module.css'

export type ToastType = 'success' | 'error' | 'info'

/** Действие в тосте («Восстановить» после удаления): такой тост живёт 8 с вместо 3. */
export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  action?: ToastAction
}

export interface ToastApi {
  success: (message: string, opts?: ToastOptions) => void
  error: (message: string, opts?: ToastOptions) => void
  info: (message: string, opts?: ToastOptions) => void
}

interface ToastItem {
  id: number
  type: ToastType
  message: string
  action?: ToastAction
}

const ToastContext = createContext<ToastApi | null>(null)

const ICON = { success: 'check', error: 'close', info: 'info' } as const

/** Сколько живёт тост: обычный — 3 с; ошибка и тост с действием — 8 с. */
const LIFETIME = { plain: 3000, long: 8000 }
/** Больше трёх тостов сразу не читаются — старые уходят. */
const MAX_VISIBLE = 3
/** Стопка: насколько выглядывает и сжимается каждый следующий тост. */
const STACK_OFFSET = 10
const STACK_SCALE = 0.05
/** Раскрытая стопка: зазор между тостами. */
const STACK_GAP = 8
/** Смахивание: дальше этого — закрыть; либо быстрый короткий жест. */
const SWIPE_DISTANCE = 70
const SWIPE_VELOCITY = 0.4
const SWIPE_MIN = 16

interface Drag {
  id: number
  pointerId: number
  x0: number
  t0: number
  dx: number
  moved: boolean
}

/**
 * Короткие уведомления внизу справа. Каждый тост — живая область: читалка
 * зачитывает его (ошибка — `role=alert`, перебивает). Значение контекста
 * стабильно: потребитель с `toast` в зависимостях эффекта не перезапускается
 * от каждого показа.
 *
 * Стопка (принятый макет): новый тост впереди, прежние выглядывают из-под
 * него уменьшенными; под курсором или с фокусом внутри стопка раскрывается
 * в колонку. Тост можно смахнуть вправо (палец или мышь): дальше порога или
 * быстрым жестом — уходит, иначе возвращается.
 *
 * Время: обычный тост — 3 с, ошибка и тост с действием («Восстановить») —
 * 8 с; пока курсор или фокус на тостах, либо тост тянут, отсчёт стоит.
 * Закрыть — «✕», щелчок по тосту или смахивание. Движение — переходами, а
 * не keyframes: тосты приходят пачкой и перенацеливаются на ходу.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const toastsRef = useRef(toasts)
  toastsRef.current = toasts
  // id → таймер и сколько ещё жить (для паузы под курсором).
  const timers = useRef(new Map<number, { handle?: ReturnType<typeof setTimeout>; left: number; at: number }>())
  const nodes = useRef(new Map<number, HTMLDivElement>())
  // Уходящие: ещё в DOM (гаснут), но места в стопке уже не занимают.
  const leaving = useRef(new Set<number>())
  const paused = useRef(false)
  // Пауза = курсор над тостами, фокус внутри ИЛИ тост тянут; считаем
  // раздельно, иначе уход фокуса вместе с закрытым тостом оставлял паузу.
  const hovered = useRef(false)
  const focused = useRef(false)
  const drag = useRef<Drag | null>(null)
  const suppressClick = useRef(false)
  const stackRef = useRef<HTMLDivElement>(null)
  const seq = useRef(0)

  /** Расставить стопку: сдвиг, масштаб и порядок слоёв — переменными на узлах. */
  const layout = useCallback(() => {
    const expanded = hovered.current || focused.current
    const stack = stackRef.current
    if (stack) {
      if (expanded) stack.dataset.expanded = ''
      else delete stack.dataset.expanded
    }
    const list = toastsRef.current.filter((t) => !leaving.current.has(t.id)).reverse()
    // Сначала снимаем ограничение высоты — иначе замер вернёт обрезанную.
    const els = list.map((t) => nodes.current.get(t.id))
    els.forEach((el) => el?.style.removeProperty('max-height'))
    const heights = els.map((el) => el?.offsetHeight ?? 0)
    let y = 0
    els.forEach((el, i) => {
      if (!el) return
      el.style.setProperty('--y', `${expanded ? y : i * STACK_OFFSET}px`)
      el.style.setProperty('--s', String(expanded ? 1 : 1 - STACK_SCALE * i))
      el.style.zIndex = String(100 - i)
      if (!expanded && i > 0) {
        el.dataset.behind = ''
        // Высокий старый тост не торчит из-под короткого нового.
        if (heights[0]) el.style.maxHeight = `${heights[0]}px`
      } else delete el.dataset.behind
      y += heights[i]! + STACK_GAP
    })
  }, [])

  const remove = useCallback((id: number) => {
    leaving.current.delete(id)
    setToasts((prev) => prev.filter((t) => t.id !== id))
    nodes.current.delete(id)
  }, [])

  const dismiss = useCallback(
    (id: number, swiped = false) => {
      const t = timers.current.get(id)
      if (t?.handle) clearTimeout(t.handle)
      timers.current.delete(id)
      if (leaving.current.has(id)) return
      const el = nodes.current.get(id)
      if (!canAnimate(el)) {
        remove(id)
        return
      }
      leaving.current.add(id)
      el.setAttribute('inert', '')
      el.dataset.out = ''
      if (swiped) el.style.setProperty('--dx', '120%')
      layout()
      setTimeout(() => remove(id), motionMs('--dur-slow'))
    },
    [remove, layout],
  )

  const arm = useCallback(
    (id: number, ms: number) => {
      timers.current.set(id, {
        left: ms,
        at: Date.now(),
        handle: paused.current ? undefined : setTimeout(() => dismiss(id), ms),
      })
    },
    [dismiss],
  )

  const pause = useCallback(() => {
    if (paused.current) return
    paused.current = true
    const now = Date.now()
    timers.current.forEach((t) => {
      if (t.handle) clearTimeout(t.handle)
      t.handle = undefined
      t.left = Math.max(0, t.left - (now - t.at))
    })
  }, [])

  const resume = useCallback(() => {
    if (!paused.current) return
    paused.current = false
    timers.current.forEach((t, id) => {
      t.at = Date.now()
      // После паузы — не меньше 1.5 с: успеть убрать руку и дочитать.
      t.left = Math.max(t.left, 1500)
      t.handle = setTimeout(() => dismiss(id), t.left)
    })
  }, [dismiss])

  const syncPause = useCallback(() => {
    if (hovered.current || focused.current || drag.current) pause()
    else resume()
    layout()
  }, [pause, resume, layout])
  const syncPauseRef = useRef(syncPause)
  syncPauseRef.current = syncPause

  // Фокус стоял на кнопке ушедшего тоста — после отрисовки он уже не
  // «внутри» (браузер при удалении узла blur не присылает).
  // Пустая стопка не имеет размера — курсор над ней быть не может.
  useEffect(() => {
    let changed = false
    if (focused.current && !stackRef.current?.contains(document.activeElement)) {
      focused.current = false
      changed = true
    }
    if (hovered.current && toasts.length === 0) {
      hovered.current = false
      changed = true
    }
    if (changed) syncPauseRef.current()
  }, [toasts])

  // Новый тост или ушедший — стопка пересчитывается до отрисовки кадра.
  useLayoutEffect(() => {
    layout()
  }, [toasts, layout])

  // Курсор — нативными mouseenter/mouseleave: синтетические React-события
  // считают «внутри» по дереву компонентов, а стопка тостов — портал, и
  // уход курсора с неё на кнопку страницы React мог не заметить.
  useEffect(() => {
    const el = stackRef.current
    if (!el) return
    const enter = () => {
      hovered.current = true
      syncPauseRef.current()
    }
    const leave = () => {
      hovered.current = false
      syncPauseRef.current()
    }
    el.addEventListener('mouseenter', enter)
    el.addEventListener('mouseleave', leave)
    window.addEventListener('resize', layout)
    return () => {
      el.removeEventListener('mouseenter', enter)
      el.removeEventListener('mouseleave', leave)
      window.removeEventListener('resize', layout)
    }
  }, [layout])

  const push = useCallback(
    (type: ToastType, message: string, opts?: ToastOptions) => {
      const id = ++seq.current
      setToasts((prev) => {
        const next = [...prev, { id, type, message, action: opts?.action }]
        // Старые сверх лимита уходят сразу (без анимации — их вытеснили).
        const live = next.filter((t) => !leaving.current.has(t.id))
        const over = live.length - MAX_VISIBLE
        if (over > 0) {
          const drop = new Set(live.slice(0, over).map((t) => t.id))
          drop.forEach((oldId) => {
            const t = timers.current.get(oldId)
            if (t?.handle) clearTimeout(t.handle)
            timers.current.delete(oldId)
            nodes.current.delete(oldId)
          })
          return next.filter((t) => !drop.has(t.id))
        }
        return next
      })
      arm(id, type === 'error' || opts?.action ? LIFETIME.long : LIFETIME.plain)
    },
    [arm],
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (m, o) => push('success', m, o),
      error: (m, o) => push('error', m, o),
      info: (m, o) => push('info', m, o),
    }),
    [push],
  )

  // ── Смахивание вправо ──
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>, id: number) => {
    // Второй палец и правая кнопка жест не начинают; кнопки тоста — свои.
    if (drag.current || (e.pointerType === 'mouse' && e.button !== 0)) return
    if ((e.target as Element).closest('button')) return
    drag.current = { id, pointerId: e.pointerId, x0: e.clientX || 0, t0: Date.now(), dx: 0, moved: false }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    syncPause()
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    d.dx = Math.max(0, (e.clientX || 0) - d.x0)
    if (d.dx > 4 && !d.moved) {
      d.moved = true
      // Пока тянут — без перехода: тост идёт за пальцем.
      e.currentTarget.dataset.drag = ''
    }
    if (d.moved) e.currentTarget.style.setProperty('--dx', `${d.dx}px`)
  }
  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    drag.current = null
    const el = e.currentTarget
    delete el.dataset.drag
    const velocity = d.dx / Math.max(1, Date.now() - d.t0)
    const away =
      e.type === 'pointerup' && (d.dx > SWIPE_DISTANCE || (velocity > SWIPE_VELOCITY && d.dx > SWIPE_MIN))
    if (d.moved) {
      // Жест — не щелчок: следом придёт click, он тост закрывать не должен.
      suppressClick.current = true
      setTimeout(() => {
        suppressClick.current = false
      }, 0)
    }
    if (away) dismiss(d.id, true)
    else el.style.setProperty('--dx', '0px')
    syncPause()
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          ref={stackRef}
          className={styles.toastStack}
          onFocus={() => {
            focused.current = true
            syncPause()
          }}
          onBlur={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
            focused.current = false
            syncPause()
          }}
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              ref={(el) => {
                if (el) nodes.current.set(t.id, el)
              }}
              className={`${styles.toast} ${styles[`toast_${t.type}`] ?? ''}`}
              role={t.type === 'error' ? 'alert' : 'status'}
              onClick={() => {
                if (suppressClick.current) return
                dismiss(t.id)
              }}
              onPointerDown={(e) => onPointerDown(e, t.id)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerEnd}
              onPointerCancel={onPointerEnd}
            >
              <span className={styles.toastIcon} aria-hidden="true">
                <Icon name={ICON[t.type]} size={12} stroke={2.4} />
              </span>
              <span className={styles.toastMsg}>{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  className={styles.toastAction}
                  onClick={(e) => {
                    e.stopPropagation()
                    dismiss(t.id)
                    t.action?.onClick()
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <button
                type="button"
                className={styles.toastClose}
                aria-label="Закрыть уведомление"
                onClick={(e) => {
                  e.stopPropagation()
                  dismiss(t.id)
                }}
              >
                <Icon name="close" size={12} />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast: нет ToastProvider выше по дереву')
  return ctx
}
