import type { ReactNode } from 'react'

import { Icon } from '../list/Icon.js'
import { Menu, MenuItem, MenuSeparator } from '../Menu/Menu.js'
import { cleanSeps, type MenuEntry } from './menuItems.js'
import s from './record.module.css'

export type { MenuEntry }

/**
 * Меню «⋯» карточки записи — тонкая обёртка над общим `Menu`: пункты
 * массивом (`'sep'` — разделитель), кнопка 36px, `small` — 28px или свой
 * класс. Клавиатура, место и движение — в `Menu`.
 */
export function ActionsMenu({
  items: rawItems,
  label = 'Ещё действия',
  small,
  buttonClassName,
  icon,
}: {
  items: MenuEntry[]
  label?: string
  small?: boolean
  /** Свой вид кнопки «⋯» (например, 30×30 с рамкой во вкладке «Команда»). */
  buttonClassName?: string
  /** Свой значок кнопки (по умолчанию — Icon «more»). */
  icon?: ReactNode
}) {
  const items = cleanSeps(rawItems)
  if (!items.some((i) => i !== 'sep')) return null

  return (
    <div className={s.menuWrap}>
      <Menu
        label={label}
        className={s.menu}
        trigger={
          <button
            type="button"
            className={buttonClassName ?? (small ? s.smallBtn : `btn btn-secondary ${s.iconBtn}`)}
            aria-label={label}
          >
            {icon ?? <Icon name="more" size={16} />}
          </button>
        }
      >
        {items.map((it, i) =>
          it === 'sep' ? (
            <MenuSeparator key={`sep-${i}`} />
          ) : (
            <MenuItem key={it.id} danger={it.danger} hint={it.hint} onSelect={it.onSelect}>
              {it.label}
            </MenuItem>
          ),
        )}
      </Menu>
    </div>
  )
}
