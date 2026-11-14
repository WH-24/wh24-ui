import { Suspense, useEffect, useId, useRef, type MouseEvent, type KeyboardEvent, type ReactNode } from 'react'

import { Icon, type IconName } from '../list/Icon.js'
import { Loader } from '../page/Loader.js'

import styles from './ModuleLayout.module.css'

/**
 * Раскладка модуля по стандарту портала WH24: панель раздела слева
 * (240px, заголовок с иконкой-чипом, пункты 14px, активный — терракотовая
 * подложка), содержимое справа. Перенесено из портала
 * (`WH_Portale/apps/hr/src/components/ModuleLayout.tsx`, решение владельца
 * 15.09.2026: панель второго уровня рисует сам модуль, у модуля она одна).
 *
 * Узкий экран (до 900px) — панель становится полосой вкладок над
 * содержимым, заголовок панели прячется. По умолчанию решает медиазапрос;
 * `narrow` задаёт режим явно (портал знает ширину сам — `data-narrow`).
 *
 * Suspense внутри тела: панель видна сразу, пока грузится ленивая страница.
 *
 * Стили на семантических именах портала — модулю нужен
 * `@wowhaus-24/ui-tokens/bridge.css`.
 */
export interface ModuleLayoutProps {
  /** Название модуля — заголовок панели и имя области навигации. */
  title: string
  /** Иконка в чипе заголовка: имя из набора или свой SVG. */
  icon: IconName | ReactNode
  /** Пункты панели: `ModuleNavLink`, `ModuleNavList`, `ModuleNavGroup`. */
  nav: ReactNode
  children: ReactNode
  /** Принудительно узкий/широкий режим; не задан — медиазапрос 900px. */
  narrow?: boolean
  /**
   * Навигация модуля на телефоне (до 640px). `top` (по умолчанию) — полоса
   * вкладок над содержимым, как на планшете. `bottom` — закреплённая нижняя
   * панель: значок и короткая подпись (`shortLabel` пункта).
   */
  mobileNav?: 'top' | 'bottom'
  className?: string
}

/** Высота нижней навигации — её читают тосты и панель массовых действий. */
const BOTTOM_NAV_VAR = '--wh24-bottom-nav-h'
const BOTTOM_NAV_HEIGHT = '56px'

export function ModuleLayout({ title, icon, nav, children, narrow, mobileNav = 'top', className }: ModuleLayoutProps) {
  const bottom = mobileNav === 'bottom' && narrow !== false
  // Тосты и панель массовых действий живут в `body`: о нижней навигации им
  // говорит переменная на корне (CSS читает её только на телефоне).
  useEffect(() => {
    if (!bottom) return
    const root = document.documentElement
    root.style.setProperty(BOTTOM_NAV_VAR, BOTTOM_NAV_HEIGHT)
    return () => {
      root.style.removeProperty(BOTTOM_NAV_VAR)
    }
  }, [bottom])
  return (
    <div
      className={className ? `${styles.layout} ${className}` : styles.layout}
      data-narrow={narrow === undefined ? undefined : String(narrow)}
      data-mobile-nav={bottom ? 'bottom' : undefined}
    >
      <aside className={styles.panel} aria-label={title}>
        <div className={styles.panelInner}>
          <div className={styles.head}>
            <div className={styles.title}>
              <span className={styles.titleIcon}>{renderIcon(icon, 13)}</span>
              {title}
            </div>
          </div>
          <nav className={styles.nav}>
            {nav}
          </nav>
        </div>
      </aside>
      <div className={styles.body}>
        <Suspense fallback={<Loader />}>{children}</Suspense>
      </div>
    </div>
  )
}

function renderIcon(icon: IconName | ReactNode, size: number): ReactNode {
  return typeof icon === 'string' ? <Icon name={icon as IconName} size={size} /> : icon
}

/** Обычный левый клик без модификаторов — переход внутри модуля; остальное (новая вкладка, копия адреса) отдаём браузеру. */
function isPlainLeftClick(e: MouseEvent): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
}

export interface ModuleNavLinkProps {
  label: ReactNode
  icon: IconName | ReactNode
  active?: boolean
  /** Адрес пункта — настоящая ссылка: фокус, средняя кнопка, «копировать адрес». */
  href?: string
  /** Переход внутри модуля (роутер). Не дан — работает обычная ссылка. */
  onClick?: () => void
  /** Счётчик справа (очередь, черновики). 0 и пусто не показываются. */
  count?: number | string
  /**
   * Короткая подпись для нижней навигации на телефоне (`mobileNav="bottom"`):
   * одно слово под значком. Не задана — там показывается `label`.
   */
  shortLabel?: string
}

export function ModuleNavLink({ label, icon, active = false, href, onClick, count, shortLabel }: ModuleNavLinkProps) {
  const showCount = count !== undefined && count !== '' && count !== 0
  const ref = useRef<HTMLAnchorElement>(null)
  // На узком экране панель — полоса вкладок с прокруткой: текущий пункт не
  // должен оставаться за краем. `nearest` не двигает то, что уже видно.
  useEffect(() => {
    if (active) ref.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [active])
  return (
    <a
      ref={ref}
      className={styles.link}
      data-active={String(active)}
      aria-current={active ? 'page' : undefined}
      href={href}
      // Без адреса ссылка сама не фокусируется — даём ей фокус и Enter/пробел.
      tabIndex={href ? undefined : 0}
      role={href ? undefined : 'link'}
      onClick={
        onClick
          ? (e: MouseEvent) => {
              if (!isPlainLeftClick(e)) return
              e.preventDefault()
              onClick()
            }
          : undefined
      }
      onKeyDown={
        href || !onClick
          ? undefined
          : (e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
      }
    >
      <span className={styles.linkIcon}>{renderIcon(icon, 14)}</span>
      <span className={styles.linkLabel} data-has-short={shortLabel ? '' : undefined}>
        {label}
      </span>
      {shortLabel && (
        <span className={styles.linkShort} aria-hidden="true">
          {shortLabel}
        </span>
      )}
      {showCount && <span className={styles.count}>{count}</span>}
    </a>
  )
}

export interface ModuleNavItem<K extends string = string> {
  id: K
  label: string
  icon: IconName | ReactNode
  href?: string
  count?: number | string
  shortLabel?: string
}

export interface ModuleNavListProps<K extends string> {
  items: ReadonlyArray<ModuleNavItem<K>>
  activeId: K | null
  onSelect?: (id: K) => void
}

export function ModuleNavList<K extends string>({ items, activeId, onSelect }: ModuleNavListProps<K>) {
  return (
    <>
      {items.map((it) => (
        <ModuleNavLink
          key={it.id}
          active={it.id === activeId}
          href={it.href}
          icon={it.icon}
          label={it.label}
          count={it.count}
          shortLabel={it.shortLabel}
          onClick={onSelect ? () => onSelect(it.id) : undefined}
        />
      ))}
    </>
  )
}

export interface ModuleNavGroupProps {
  /** Подпись группы (11px, прописными). */
  label: string
  children: ReactNode
}

/** Группа пунктов с подписью — «Контент», «Обучение», «Настройки». */
export function ModuleNavGroup({ label, children }: ModuleNavGroupProps) {
  const id = useId()
  return (
    <div className={styles.group} role="group" aria-labelledby={id}>
      <div id={id} className={styles.groupLabel}>
        {label}
      </div>
      {children}
    </div>
  )
}
