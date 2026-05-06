import type { ReactElement, ReactNode } from 'react'

import styles from './NavTile.module.css'

/**
 * Props passed to a custom link renderer. Mirror common attributes
 * of `<a>` so libraries like react-router-dom Link work out of the box.
 */
export interface NavTileLinkRendererProps {
  href: string
  className?: string
  children: ReactNode
  ariaLabel?: string
}

export interface NavTileProps {
  href: string
  name: string
  sub: string
  icon: ReactNode
  /**
   * Optional custom link component. Default renders a plain `<a>`.
   * Pass a router-aware Link when you need SPA navigation:
   * `renderLink={(p) => <Link to={p.href} className={p.className}>{p.children}</Link>}`
   */
  renderLink?: (props: NavTileLinkRendererProps) => ReactElement
}

const defaultLink = ({ href, className, children, ariaLabel }: NavTileLinkRendererProps) => (
  <a href={href} className={className} aria-label={ariaLabel}>
    {children}
  </a>
)

/**
 * Large navigation tile — used on the hub to point at major surfaces
 * (Browser, Search). Icon-square + name + subtitle + arrow.
 */
export function NavTile({ href, name, sub, icon, renderLink = defaultLink }: NavTileProps) {
  const content = (
    <>
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.text}>
        <span className={styles.name}>{name}</span>
        <span className={styles.sub}>{sub}</span>
      </span>
      <span className={styles.arr} aria-hidden="true">
        →
      </span>
    </>
  )

  return renderLink({
    href,
    className: styles.tile,
    children: content,
    ariaLabel: name,
  })
}
