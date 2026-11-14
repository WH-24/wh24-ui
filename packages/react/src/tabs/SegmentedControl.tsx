import { useRef, type ReactNode } from 'react'

import { Icon, type IconName } from '../list/Icon.js'

import { keyboardInitiated } from '../overlay/motion.js'

import styles from './tabs.module.css'
import { useSlideIndicator } from './useSlideIndicator.js'

export interface SegmentOption<V extends string = string> {
  value: V
  label: ReactNode
  icon?: IconName
  count?: number | string
}

/**
 * Переключатель вида или режима («Список / Карточки», «Неделя / Месяц») —
 * как `.view-switch` портала: приглушённая пилюля, выбранный — на
 * поверхности с тенью. Это не вкладки страницы: содержимое не меняется
 * целиком, меняется его представление. Кнопки с `aria-pressed`. Фон
 * выбранного — одна плашка: по клику она переезжает к новому варианту.
 */
export interface SegmentedControlProps<V extends string> {
  options: ReadonlyArray<SegmentOption<V>>
  value: V
  onChange: (value: V) => void
  ariaLabel: string
  className?: string
}

export function SegmentedControl<V extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps<V>) {
  const groupRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLSpanElement>(null)
  const instant = useRef(false)
  useSlideIndicator(groupRef, thumbRef, 'button[aria-pressed="true"]', 'size', instant, options.length)
  return (
    <div
      ref={groupRef}
      role="group"
      aria-label={ariaLabel}
      className={className ? `${styles.seg} ${className}` : styles.seg}
    >
      <span ref={thumbRef} className={styles.thumb} aria-hidden="true" />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={styles.segBtn}
          aria-pressed={o.value === value}
          onClick={() => {
            // Выбор с клавиатуры (Enter, пробел) — плашка встаёт сразу.
            instant.current = keyboardInitiated()
            onChange(o.value)
          }}
        >
          {o.icon && <Icon name={o.icon} size={14} />}
          {o.label}
          {o.count !== undefined && o.count !== '' && <span className={styles.count}>{o.count}</span>}
        </button>
      ))}
    </div>
  )
}
