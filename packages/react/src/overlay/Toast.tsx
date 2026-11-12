import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { Icon } from '../list/Icon.js'
import { canAnimate, prefersReducedMotion } from './presence.js'

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

/**
 * Короткие уведомления внизу справа — как тосты портала. Каждый тост —
 * живая область: читалка зачитывает его (ошибка — `role=alert`, перебивает).
 * Значение контекста стабильно: потребитель с `toast` в зависимостях
 * эффекта не перезапускается от каждого показа.
 *
 * Время: обычный тост — 3 с, ошибка и тост с действием («Восстановить») —
 * 8 с; пока курсор или фокус на тостах, отсчёт стоит (успеть прочитать и
 * нажать). Закрыть — «✕» или щелчок по тосту. Уходит тост коротким
 * затуханием, соседи не прыгают.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  // id → таймер и сколько ещё жить (для паузы под курсором).
  const timers = useRef(new Map<number, { handle?: ReturnType<typeof setTimeout>; left: number; at: number }>())
  const nodes = useRef(new Map<number, HTMLDivElement>())
  const paused = useRef(false)
  // Пауза = курсор над тостами ИЛИ фокус внутри; считаем раздельно, иначе
  // уход фокуса вместе с закрытым тостом оставлял паузу навсегда.
  const hovered = useRef(false)
  const focused = useRef(false)
  const stackRef = useRef<HTMLDivElement>(null)
  const seq = useRef(0)

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    nodes.current.delete(id)
  }, [])

  const dismiss = useCallback(
    (id: number) => {
      const t = timers.current.get(id)
      if (t?.handle) clearTimeout(t.handle)
      timers.current.delete(id)
      const el = nodes.current.get(id)
      if (!canAnimate(el)) {
        remove(id)
        return
      }
      el.setAttribute('inert', '')
      const anim = el.animate(
        prefersReducedMotion()
          ? [{ opacity: 1 }, { opacity: 0 }]
          : [
              { opacity: 1, transform: 'translateY(0)' },
              { opacity: 0, transform: 'translateY(4px)' },
            ],
        { duration: 140, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' },
      )
      anim.finished.then(
        () => remove(id),
        () => remove(id),
      )
    },
    [remove],
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
    if (hovered.current || focused.current) pause()
    else resume()
  }, [pause, resume])
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
    return () => {
      el.removeEventListener('mouseenter', enter)
      el.removeEventListener('mouseleave', leave)
    }
  }, [])

  const push = useCallback(
    (type: ToastType, message: string, opts?: ToastOptions) => {
      const id = ++seq.current
      setToasts((prev) => {
        const next = [...prev, { id, type, message, action: opts?.action }]
        // Старые сверх лимита уходят сразу (без анимации — их вытеснили).
        const over = next.length - MAX_VISIBLE
        if (over > 0) {
          for (const old of next.slice(0, over)) {
            const t = timers.current.get(old.id)
            if (t?.handle) clearTimeout(t.handle)
            timers.current.delete(old.id)
          }
          return next.slice(over)
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
              onClick={() => dismiss(t.id)}
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
