import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { Icon } from '../list/Icon.js'

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

/**
 * Короткие уведомления внизу справа — как тосты портала. Живая область:
 * читалка зачитывает их (ошибка — `role=alert`, перебивает). Значение
 * контекста стабильно: потребитель с `toast` в зависимостях эффекта не
 * перезапускается от каждого показа.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())
  const seq = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const t = timers.current.get(id)
    if (t) {
      clearTimeout(t)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback(
    (type: ToastType, message: string, opts?: ToastOptions) => {
      const id = ++seq.current
      setToasts((prev) => [...prev, { id, type, message, action: opts?.action }])
      timers.current.set(id, setTimeout(() => dismiss(id), opts?.action ? 8000 : 3000))
    },
    [dismiss],
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
        <div className={styles.toastStack} aria-live="polite">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`${styles.toast} ${styles[`toast_${t.type}`] ?? ''}`}
              role={t.type === 'error' ? 'alert' : 'status'}
              onClick={() => dismiss(t.id)}
            >
              <span className={styles.toastIcon}>
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
