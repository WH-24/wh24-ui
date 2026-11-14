import type { ReactNode } from 'react'
import { Switch } from '@wowhaus-24/ui-react'

export interface BrainSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Видимая подпись справа от переключателя. */
  children: ReactNode
  disabled?: boolean
  id?: string
  /** Подпись для скринридера, если по тексту рядом непонятно, к чему переключатель. */
  ariaLabel?: string
  /** id блока с пояснением (`aria-describedby`). */
  describedBy?: string
  className?: string
}

/**
 * Переключатель «включено/выключено» экрана агентов — общий `Switch` из
 * ui-react (вид принятого макета) с прежними пропсами пакета: подпись справа,
 * щелчок по ней тоже переключает, `describedBy` — id пояснения.
 */
export function BrainSwitch({
  checked,
  onChange,
  children,
  disabled,
  id,
  ariaLabel,
  describedBy,
  className,
}: BrainSwitchProps) {
  return (
    <Switch
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      id={id}
      ariaLabel={ariaLabel}
      aria-describedby={describedBy}
      className={className}
    >
      {children}
    </Switch>
  )
}
