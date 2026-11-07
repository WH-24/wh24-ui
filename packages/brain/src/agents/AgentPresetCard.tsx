import { useId } from 'react'
import { Icon } from '@wowhaus-24/ui-react'

import { AgentAvatar } from './AgentAvatar.js'
import { triggerSummary } from './draft.js'
import styles from './cards.module.css'
import { EVENT_LOCKED_HINT } from './TriggerEditor.js'
import type { AgentPreset } from './types.js'

export interface AgentPresetCardProps {
  preset: AgentPreset
  /** «Создать»: хост зовёт `agents.create({preset_key, name?})` и открывает созданного агента. */
  onCreate?: (preset: AgentPreset) => void
  busy?: boolean
  className?: string
}

/**
 * Готовый агент из каталога. Недоступный (`available: false` — у пресета
 * триггер по событию, а вы не управляете модулем) не создаётся: вместо кнопки
 * понятная причина.
 */
export function AgentPresetCard({ preset, onCreate, busy, className }: AgentPresetCardProps) {
  const reasonId = useId()
  const triggers = triggerSummary(preset.agent?.triggers)
  const blocked = !preset.available
  return (
    <article className={[styles.card, className].filter(Boolean).join(' ')} data-blocked={blocked || undefined}>
      <div className={styles.top}>
        <AgentAvatar name={preset.avatar} />
        <div className={styles.titleBlock}>
          <h3 className={styles.title}>{preset.name}</h3>
        </div>
      </div>
      <p className={styles.desc}>{preset.description}</p>
      {triggers.length > 0 && (
        <dl className={styles.facts}>
          <div>
            <dt>Запуск</dt>
            <dd>{triggers.join(' · ')}</dd>
          </div>
        </dl>
      )}
      <footer className={styles.foot}>
        {blocked ? (
          <span id={reasonId} className={styles.reason}>
            {preset.needs_manager ? EVENT_LOCKED_HINT : 'Недоступен вам'}
          </span>
        ) : (
          <span />
        )}
        {onCreate && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={blocked || busy}
            aria-describedby={blocked ? reasonId : undefined}
            onClick={() => onCreate(preset)}
          >
            <Icon name="plus" size={14} />
            {busy ? 'Создаю…' : 'Создать'}
          </button>
        )}
      </footer>
    </article>
  )
}
