import { Fragment } from 'react'
import { IconButton, Menu, MenuItem, MenuSeparator } from '@wowhaus-24/ui-react'

import { BrainIcon } from '../icons.js'
import type { AiField } from './types.js'
import styles from './fields.module.css'

export interface AiFieldColumnMenuProps {
  field: AiField
  /** Расчётов колонки в сутки (`daily_limit` из `fields.list`). */
  dailyLimit?: number
  /** Сколько осталось на сегодня, если известно (после «Заполнить»). */
  limitLeft?: number
  /** Идёт постановка в очередь — пункты заполнения недоступны. */
  busy?: boolean
  onFillEmpty: () => void
  onRefreshAll: () => void
  /** «Настроить…» — только при `field.can.edit`. */
  onConfigure?: () => void
  /** «Удалить…» — только при `field.can.edit`; подтверждение показывает хост/хук. */
  onRemove?: () => void
}

interface Item {
  key: string
  label: string
  danger?: boolean
  disabled?: boolean
  run: () => void
}

/**
 * Меню в заголовке колонки «Поле ИИ» (кладётся в `ListColumn.headerActions`):
 * «Заполнить пустые», «Обновить все», «Настроить…», «Удалить…». Само меню — общий
 * `Menu` из ui-react (портал в `<body>`: таблица с горизонтальной прокруткой его
 * не обрежет; Esc, клик мимо, стрелки).
 */
export function AiFieldColumnMenu({
  field,
  dailyLimit,
  limitLeft,
  busy,
  onFillEmpty,
  onRefreshAll,
  onConfigure,
  onRemove,
}: AiFieldColumnMenuProps) {
  const items: Item[] = [
    { key: 'fill', label: 'Заполнить пустые', disabled: busy, run: onFillEmpty },
    { key: 'refresh', label: 'Обновить все', disabled: busy, run: onRefreshAll },
  ]
  if (field.can.edit && onConfigure) items.push({ key: 'configure', label: 'Настроить…', run: onConfigure })
  if (field.can.edit && onRemove) items.push({ key: 'remove', label: 'Удалить…', danger: true, run: onRemove })

  const limitText =
    limitLeft != null && dailyLimit
      ? `Сегодня осталось ${limitLeft} из ${dailyLimit} расчётов`
      : dailyLimit
        ? `Лимит колонки: ${dailyLimit} расчётов в сутки`
        : ''

  return (
    <Menu
      label={`Колонка «${field.label}»`}
      className={styles.colMenu}
      trigger={
        <IconButton
          size={24}
          className={styles.colBtn}
          ariaLabel={`Колонка «${field.label}»: действия`}
          title="Поле ИИ"
        >
          <BrainIcon name="sparkle" size={14} />
        </IconButton>
      }
    >
      {items.map((it, idx) => (
        <Fragment key={it.key}>
          {it.key === 'configure' && idx > 0 && <MenuSeparator />}
          <MenuItem danger={it.danger} disabled={it.disabled} onSelect={it.run}>
            {it.label}
          </MenuItem>
        </Fragment>
      ))}
      {limitText && <div className={styles.colLimit}>{limitText}</div>}
    </Menu>
  )
}
