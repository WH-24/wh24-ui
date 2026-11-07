import { useMemo, useState } from 'react'
import { Combobox, type ComboboxOption } from '@wowhaus-24/ui-react'

import type { BrainModel } from './types.js'
import styles from './models.module.css'

export interface ModelSelectProps {
  models: BrainModel[]
  /** Выбранная модель; пусто — «по умолчанию» (показывается `defaultModel`). */
  value: string
  onChange: (modelId: string) => void
  /** Модель по умолчанию: помечается подсказкой «по умолчанию». */
  defaultModel?: string
  /** Если передан — последним пунктом идёт «Настроить модели…» (откроет `ModelSettingsDialog`). */
  onConfigure?: () => void
  disabled?: boolean
  ariaLabel?: string
  className?: string
}

const CONFIGURE = '\u0000configure'

/**
 * Компактный выбор модели для шапки панели «Спросить ИИ» (кладётся в `modelSlot`).
 * Без модели в списке и без `onConfigure` ничего не рисует — выбирать нечего.
 */
export function ModelSelect({ models, value, onChange, defaultModel, onConfigure, disabled, ariaLabel = 'Модель ИИ', className }: ModelSelectProps) {
  // После «Настроить модели…» значение не меняется, а поле ввода Combobox уже показывает
  // подпись пункта — пересоздаём его, чтобы оно вернулось к выбранной модели.
  const [nonce, setNonce] = useState(0)

  const options = useMemo<ComboboxOption[]>(() => {
    const list: ComboboxOption[] = models.map((m) => ({
      value: m.id,
      label: m.label || m.id,
      hint: m.id === defaultModel ? 'по умолчанию' : undefined,
      group: onConfigure ? 'Модель' : undefined,
    }))
    if (onConfigure) list.push({ value: CONFIGURE, label: 'Настроить модели…', group: 'Настройки' })
    return list
  }, [models, defaultModel, onConfigure])

  if (models.length === 0 && !onConfigure) return null
  const current = value || defaultModel || models[0]?.id || ''

  return (
    <Combobox
      key={nonce}
      className={[styles.modelSelect, className].filter(Boolean).join(' ')}
      options={options}
      value={current}
      ariaLabel={ariaLabel}
      clearable={false}
      searchable={false}
      disabled={disabled}
      onChange={(v) => {
        if (v === CONFIGURE) {
          setNonce((n) => n + 1)
          onConfigure?.()
          return
        }
        if (v) onChange(v)
      }}
    />
  )
}
