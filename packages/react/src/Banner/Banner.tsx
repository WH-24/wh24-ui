import { forwardRef, useRef, type HTMLAttributes, type ReactNode } from 'react'

import { Icon, type IconName } from '../list/Icon.js'
import { canAnimate } from '../overlay/presence.js'
import { cx } from '../popup/popup.js'

import styles from './Banner.module.css'

export type BannerTone = 'info' | 'warn' | 'good' | 'bad'

export interface BannerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  tone?: BannerTone
  /** Текст сообщения. */
  children: ReactNode
  /** Действие справа — обычно `<button className="btn btn-secondary btn-sm">`. */
  action?: ReactNode
  /** Задан — рисуется крестик; баннер убирает хозяин страницы. */
  onDismiss?: () => void
  dismissLabel?: string
  /** Свой значок вместо значка тона; `null` — без значка. */
  icon?: IconName | ReactNode | null
}

const TONE_ICON: Record<BannerTone, IconName> = {
  info: 'info',
  warn: 'alert',
  good: 'check',
  bad: 'alert',
}

/** Затухание перед скрытием — как у макета (135 мс = --dur-base-exit). */
const EXIT_MS = 135

/**
 * Сообщение на странице: что-то изменилось или требует внимания, но работу
 * не останавливает. Ошибка (`bad`) объявляется читалкой сразу (`alert`),
 * остальное — вежливо (`status`).
 */
export const Banner = forwardRef<HTMLDivElement, BannerProps>(function Banner(
  { tone = 'info', children, action, onDismiss, dismissLabel = 'Скрыть сообщение', icon, className, ...rest },
  ref,
) {
  const inner = useRef<HTMLDivElement | null>(null)
  const leaving = useRef(false)

  const dismiss = () => {
    if (!onDismiss || leaving.current) return
    const el = inner.current
    if (!canAnimate(el)) {
      onDismiss()
      return
    }
    leaving.current = true
    const done = () => {
      leaving.current = false
      onDismiss()
    }
    const anim = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: EXIT_MS, fill: 'forwards' })
    anim.finished.then(done, done)
  }

  const glyph = icon === undefined ? TONE_ICON[tone] : icon
  return (
    <div
      role={tone === 'bad' ? 'alert' : 'status'}
      {...rest}
      ref={(el) => {
        inner.current = el
        if (typeof ref === 'function') ref(el)
        else if (ref) ref.current = el
      }}
      className={cx(styles.banner, styles[tone], className)}
    >
      {glyph != null && (
        <span className={styles.icon} aria-hidden="true">
          {typeof glyph === 'string' ? <Icon name={glyph as IconName} size={16} /> : glyph}
        </span>
      )}
      <span className={styles.text}>{children}</span>
      {action != null && <span className={styles.action}>{action}</span>}
      {onDismiss && (
        <button type="button" className={styles.close} aria-label={dismissLabel} onClick={dismiss}>
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  )
})
