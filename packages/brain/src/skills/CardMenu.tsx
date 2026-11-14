import { Icon, IconButton, Menu, MenuItem } from '@wowhaus-24/ui-react'

import styles from './skills.module.css'

export interface CardMenuItem {
  label: string
  danger?: boolean
  onSelect: () => void
}

/**
 * Меню «⋯» карточки (навык, агент) — общий `Menu` из ui-react: Esc и клик мимо
 * закрывают, стрелки двигают, фокус возвращается на кнопку.
 */
export function CardMenu({ label, items }: { label: string; items: CardMenuItem[] }) {
  return (
    <div className={styles.menuWrap}>
      <Menu
        label={label}
        trigger={
          <IconButton ariaLabel={label}>
            <Icon name="more" size={16} />
          </IconButton>
        }
      >
        {items.map((it) => (
          <MenuItem key={it.label} danger={it.danger} onSelect={it.onSelect}>
            {it.label}
          </MenuItem>
        ))}
      </Menu>
    </div>
  )
}
