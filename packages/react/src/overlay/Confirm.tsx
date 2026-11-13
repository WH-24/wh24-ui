import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { Icon } from '../list/Icon.js'
import { useFocusTrap, useScrollLock } from './useFocusTrap.js'

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
 * так что подтверждение над модалкой не закрывает обе.
 *
 * Фокус: у разрушительного вопроса (`tone: 'danger'`, по умолчанию) — на
 * «Отмена», чтобы случайный Enter (тот же, что открыл вопрос с кнопки
 * строки) ничего не удалял; у обычного согласия и сообщения — на основной
 * кнопке. Вопросы, заданные подряд, встают в очередь: каждый получает
 * свой ответ, ни одно `await` не зависает.
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
  key: number
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
  const [queue, setQueue] = useState<Pending[]>([])
  const queueRef = useRef(queue)
  queueRef.current = queue
  const seq = useRef(0)
  const pending = queue[0] ?? null

  const enqueue = useCallback((p: Omit<Pending, 'key'>) => {
    setQueue((q) => [...q, { ...p, key: ++seq.current }])
  }, [])
  const confirm = useCallback<ConfirmFn>(
    (opts) => new Promise<boolean>((resolve) => enqueue({ ...opts, resolve })),
    [enqueue],
  )
  const alert = useCallback(
    (message: ReactNode, title?: string) =>
      new Promise<void>((resolve) =>
        enqueue({ message, title, alert: true, tone: 'primary', resolve: () => resolve() }),
      ),
    [enqueue],
  )
  // Ответ — снаружи updater'а: StrictMode вызывает updater дважды.
  const close = useCallback((ok: boolean) => {
    const head = queueRef.current[0]
    if (!head) return
    head.resolve(ok)
    queueRef.current = queueRef.current.slice(1)
    setQueue((q) => (q[0] === head ? q.slice(1) : q))
  }, [])

  const [api] = useState<ConfirmApi>(() => ({ confirm, alert }))

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      {pending && createPortal(<ConfirmCard key={pending.key} pending={pending} close={close} />, document.body)}
    </ConfirmContext.Provider>
  )
}

function ConfirmCard({ pending, close }: { pending: Pending; close: (ok: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const okRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  useFocusTrap({ open: true, containerRef: ref, onEscape: () => close(false) })
  useScrollLock(true)
  const danger = !pending.alert && pending.tone !== 'primary'
  useEffect(() => {
    ;(danger ? cancelRef : okRef).current?.focus()
  }, [danger])
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
            <button ref={cancelRef} type="button" className="btn btn-secondary btn-sm" onClick={() => close(false)}>
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
