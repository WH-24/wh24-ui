import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { Icon } from '../list/Icon.js'
import { useFocusTrap } from './useFocusTrap.js'

import styles from './overlay.module.css'

/**
 * Подтверждение и сообщение в стиле портала — вместо `window.confirm` и
 * `window.alert` (нативные окна в iframe выглядят чужими, Chrome глушит их
 * при частых вызовах).
 *
 *   const confirm = useConfirm()
 *   if (!(await confirm({ message: 'Удалить тег «X»?' }))) return
 *
 *   const notify = useAlert()
 *   await notify('Не удалось удалить изображение')
 *
 * Поверх любых окон (`--z-confirm`); Esc — отмена через общий стек ловушек,
 * так что подтверждение над модалкой не закрывает обе. Фокус — на кнопке
 * согласия: Enter подтверждает, как и в портале.
 */
export interface ConfirmOptions {
  title?: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** danger (по умолчанию) — красная кнопка; primary — обычное согласие. */
  tone?: 'danger' | 'primary'
}

export type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

interface Pending extends ConfirmOptions {
  /** Сообщение с одной кнопкой вместо вопроса. */
  alert?: boolean
  resolve: (ok: boolean) => void
}

interface ConfirmApi {
  confirm: ConfirmFn
  alert: (message: ReactNode, title?: string) => Promise<void>
}

const ConfirmContext = createContext<ConfirmApi | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)

  const confirm = useCallback<ConfirmFn>(
    (opts) => new Promise<boolean>((resolve) => setPending({ ...opts, resolve })),
    [],
  )
  const alert = useCallback(
    (message: ReactNode, title?: string) =>
      new Promise<void>((resolve) =>
        setPending({ message, title, alert: true, tone: 'primary', resolve: () => resolve() }),
      ),
    [],
  )
  const close = useCallback((ok: boolean) => {
    setPending((p) => {
      p?.resolve(ok)
      return null
    })
  }, [])

  const [api] = useState<ConfirmApi>(() => ({ confirm, alert }))

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      {pending && createPortal(<ConfirmCard pending={pending} close={close} />, document.body)}
    </ConfirmContext.Provider>
  )
}

function ConfirmCard({ pending, close }: { pending: Pending; close: (ok: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const okRef = useRef<HTMLButtonElement>(null)
  useFocusTrap({ open: true, containerRef: ref, onEscape: () => close(false) })
  useEffect(() => {
    okRef.current?.focus()
  }, [])
  const danger = !pending.alert && pending.tone !== 'primary'
  return (
    <div
      className={`${styles.backdrop} ${styles.confirmBackdrop}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close(false)
      }}
    >
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="wh24-confirm-title"
        aria-describedby="wh24-confirm-message"
        className={`${styles.card} ${styles.confirmCard}`}
      >
        <div className={styles.head}>
          <h2 id="wh24-confirm-title" className={styles.title}>
            {pending.title ?? (pending.alert ? 'Не получилось' : 'Подтверждение')}
          </h2>
          <button type="button" className={styles.close} onClick={() => close(false)} aria-label="Закрыть">
            <Icon name="close" size={16} />
          </button>
        </div>
        <div id="wh24-confirm-message" className={`${styles.body} ${styles.confirmMessage}`}>
          {pending.message}
        </div>
        <div className={styles.footer}>
          {!pending.alert && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => close(false)}>
              {pending.cancelLabel ?? 'Отмена'}
            </button>
          )}
          <button
            ref={okRef}
            type="button"
            className={`btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => close(true)}
          >
            {pending.confirmLabel ?? (pending.alert ? 'Понятно' : 'Удалить')}
          </button>
        </div>
      </div>
    </div>
  )
}

function useConfirmApi(hook: string): ConfirmApi {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error(`${hook}: нет ConfirmProvider выше по дереву`)
  return ctx
}

export function useConfirm(): ConfirmFn {
  return useConfirmApi('useConfirm').confirm
}

/** Сообщение с одной кнопкой «Понятно» — замена `window.alert`. */
export function useAlert(): ConfirmApi['alert'] {
  return useConfirmApi('useAlert').alert
}
