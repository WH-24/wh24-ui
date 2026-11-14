import { forwardRef, useEffect, useState, type CSSProperties, type HTMLAttributes, type Ref } from 'react'

import styles from './Avatar.module.css'

export type AvatarSize = 20 | 24 | 32 | 44 | 56

export interface AvatarProps extends Omit<HTMLAttributes<HTMLElement>, 'onClick' | 'children'> {
  /** Готовые инициалы — вместо расчёта из `name`. */
  initials?: string
  /** Имя человека: из него берутся инициалы, цвет и подпись для читалки. */
  name?: string
  /** Фотография. Не загрузилась — показываются инициалы. */
  src?: string | null
  /** Диаметр, px. */
  size?: AvatarSize
  /** Точка «в сети». */
  status?: 'online'
  /** Мягкий цвет по имени (пять тонов макета). По умолчанию — когда задано `name`. */
  tint?: boolean
  ariaLabel?: string
  /** Что дописать к подписи при `status="online"`. */
  statusLabel?: string
  /** Есть обработчик — аватар становится кнопкой. */
  onClick?: () => void
}

/**
 * Инициалы из имени: первые буквы первых двух слов. `Array.from` — чтобы не
 * разрезать пополам эмодзи и буквы вне основной плоскости Юникода. Пустое
 * имя — «?».
 */
export function initialsOf(name: string | null | undefined): string {
  // Кавычки и скобки названий («Ромашка» ООО) в инициалы не идут.
  const words = (name ?? '')
    .replace(/[«»"'()]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const letters = words
    .slice(0, 2)
    .map((w) => Array.from(w)[0] ?? '')
    .join('')
  return letters ? letters.toLocaleUpperCase('ru') : '?'
}

/** Тон 0–4 по имени — тот же расчёт, что в принятом макете. */
export function avatarTint(name: string | null | undefined): number {
  let sum = 0
  for (const ch of Array.from(name ?? '')) sum += ch.codePointAt(0) ?? 0
  return sum % 5
}

const TINTS = [styles.c0, styles.c1, styles.c2, styles.c3, styles.c4]
const SIZES: Record<AvatarSize, string | undefined> = {
  20: styles.s20,
  24: styles.s24,
  32: undefined,
  44: styles.s44,
  56: styles.s56,
}

/**
 * Аватар: фотография или инициалы в круге. С `onClick` — кнопка (обычно
 * открывает меню профиля), без него — картинка с подписью.
 */
export const Avatar = forwardRef<HTMLElement, AvatarProps>(function Avatar(
  {
    initials,
    name,
    src,
    size = 32,
    status,
    tint,
    ariaLabel,
    statusLabel = 'в сети',
    onClick,
    className,
    ...rest
  },
  ref,
) {
  const [failed, setFailed] = useState(false)
  // Новая ссылка — новая попытка: прежняя ошибка к ней не относится.
  useEffect(() => setFailed(false), [src])

  // Готовые инициалы режем до двух символов (по символам, а не половинкам
  // эмодзи): слово целиком вылезало из круга, пустая строка давала пустой круг.
  const letters =
    initials !== undefined ? Array.from(initials.trim()).slice(0, 2).join('') || '?' : initialsOf(name)
  const tinted = tint ?? Boolean(name)
  const cls = [
    styles.av,
    SIZES[size],
    tinted ? TINTS[avatarTint(name ?? initials)] : undefined,
    status ? styles.hasStatus : undefined,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const body = (
    <>
      {src && !failed ? (
        <img className={styles.img} src={src} alt="" draggable={false} onError={() => setFailed(true)} />
      ) : (
        letters
      )}
      {status === 'online' && <span className={styles.on} aria-hidden="true" />}
    </>
  )
  const online = status === 'online' ? `, ${statusLabel}` : ''

  if (onClick) {
    return (
      <button
        {...rest}
        ref={ref as Ref<HTMLButtonElement>}
        type="button"
        className={`${cls} ${styles.btn}`}
        aria-label={(ariaLabel ?? `Профиль ${name ?? letters}`) + online}
        onClick={onClick}
      >
        {body}
      </button>
    )
  }
  return (
    <span
      role="img"
      aria-label={(ariaLabel ?? name ?? letters) + online}
      {...rest}
      ref={ref as Ref<HTMLSpanElement>}
      className={cls}
    >
      {body}
    </span>
  )
})

export interface AvatarStackProps extends HTMLAttributes<HTMLSpanElement> {
  /** Люди по порядку; у каждого — те же поля, что у `Avatar`. */
  people: Array<Pick<AvatarProps, 'name' | 'src' | 'initials' | 'status'> & { id?: string }>
  /** Сколько показать; остальные — счётчиком «+N». */
  max?: number
  size?: AvatarSize
  /** Подпись группы для читалки. */
  ariaLabel?: string
  style?: CSSProperties
}

/** Стопка аватаров внахлёст: команда проекта, участники чата. */
export const AvatarStack = forwardRef<HTMLSpanElement, AvatarStackProps>(function AvatarStack(
  { people, max = 4, size = 32, ariaLabel, className, ...rest },
  ref,
) {
  const limit = Math.max(1, Math.floor(max))
  const shown = people.slice(0, limit)
  const more = people.length - shown.length
  const names = people.map((p) => p.name ?? p.initials).filter(Boolean)
  return (
    <span
      role="group"
      aria-label={ariaLabel ?? (names.length ? `Участники: ${names.join(', ')}` : 'Участники')}
      {...rest}
      ref={ref}
      className={[styles.stack, className].filter(Boolean).join(' ')}
    >
      {shown.map((p, i) => (
        <Avatar
          key={p.id ?? `${p.name ?? p.initials ?? ''}-${i}`}
          name={p.name}
          initials={p.initials}
          src={p.src}
          status={p.status}
          size={size}
          aria-hidden="true"
          title={p.name}
        />
      ))}
      {more > 0 && (
        <span className={[styles.av, SIZES[size], styles.more].filter(Boolean).join(' ')} aria-hidden="true">
          +{more}
        </span>
      )}
    </span>
  )
})
