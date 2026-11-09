import type { ReactNode } from 'react'

import styles from './page.module.css'

/**
 * Поле страницы модуля: отступы как у `.page` портала (8 28 40). Внутри —
 * `PageHeader`, вкладки, содержимое. Таблица последним ребёнком доходит до
 * низа окна без отступа (правило владельца 01.11.2026) — для этого `fill`.
 */
export interface PageProps {
  children: ReactNode
  /** Последний блок тянется до низа окна (таблица во всю высоту). */
  fill?: boolean
  className?: string
}

export function Page({ children, fill = false, className }: PageProps) {
  const cls = [styles.page, fill ? styles.fill : '', className ?? ''].filter(Boolean).join(' ')
  return <div className={cls}>{children}</div>
}
