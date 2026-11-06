import { Icon, type IconName } from '@wowhaus-24/ui-react'

import { BrainIcon } from '../icons.js'
import styles from './cards.module.css'

/** Иконки, которыми сервер помечает агентов и пресеты; незнакомое имя рисуется «искрой». */
const KNOWN: ReadonlySet<string> = new Set<IconName>([
  'calendar',
  'briefcase',
  'chart',
  'book',
  'bolt',
  'list',
  'users',
  'folder',
  'home',
  'star',
  'bell',
  'msgs',
  'flag',
  'timer',
  'mail',
  'presentations',
  'board',
  'megaphone',
  'pen',
  'tree',
  'check',
  'search',
  'settings',
])

export interface AgentAvatarProps {
  /** `Agent.avatar` / `AgentPreset.avatar`: calendar, briefcase, chart… */
  name?: string
  size?: number
  className?: string
}

/** Значок агента в плашке; декоративный (название рядом). */
export function AgentAvatar({ name, size = 18, className }: AgentAvatarProps) {
  return (
    <span className={[styles.avatar, className].filter(Boolean).join(' ')} aria-hidden="true">
      {name && KNOWN.has(name) ? (
        <Icon name={name as IconName} size={size} />
      ) : (
        <BrainIcon name="sparkle" size={size} />
      )}
    </span>
  )
}
