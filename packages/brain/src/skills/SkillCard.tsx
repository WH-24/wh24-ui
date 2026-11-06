import { Icon } from '@wowhaus-24/ui-react'

import { CardMenu, type CardMenuItem } from './CardMenu.js'
import { SKILL_STATUS_LABEL, usesLabel } from './labels.js'
import type { Skill, SkillStatus } from './types.js'
import styles from './skills.module.css'

export interface SkillCardProps {
  skill: Skill
  /** «Редактировать» и клик по названию — только при `skill.can.edit`. */
  onEdit?: (skill: Skill) => void
  /** «Включить» / «Отключить» / «В архив»: новый статус. Только при `skill.can.edit`. */
  onSetStatus?: (skill: Skill, status: SkillStatus) => void
  /** «Удалить» — только при `skill.can.edit`; подтверждение показывает `SkillsList` (или хост). */
  onDelete?: (skill: Skill) => void
  className?: string
}

function StatusBadge({ status }: { status: SkillStatus }) {
  return (
    <span className={styles.status} data-status={status}>
      {status === 'active' ? <Icon name="check" size={12} /> : status === 'draft' ? <Icon name="pen" size={12} /> : <Icon name="archive" size={12} />}
      {SKILL_STATUS_LABEL[status] ?? status}
    </span>
  )
}

function formatDate(iso: string | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

/**
 * Карточка навыка: название, команда `/слэш`, описание (или начало инструкций),
 * статус, «Общий», сколько раз применён. Меню «⋯» — только при `skill.can.edit`:
 * права лишь решают, что показать, запрещённое действие сервер всё равно отклонит.
 */
export function SkillCard({ skill, onEdit, onSetStatus, onDelete, className }: SkillCardProps) {
  const editable = skill.can?.edit === true
  const items: CardMenuItem[] = []
  if (editable) {
    if (onEdit) items.push({ label: 'Редактировать', onSelect: () => onEdit(skill) })
    if (onSetStatus) {
      if (skill.status === 'active') items.push({ label: 'Отключить', onSelect: () => onSetStatus(skill, 'draft') })
      else items.push({ label: 'Включить', onSelect: () => onSetStatus(skill, 'active') })
      if (skill.status !== 'archived') items.push({ label: 'В архив', onSelect: () => onSetStatus(skill, 'archived') })
    }
    if (onDelete) items.push({ label: 'Удалить…', danger: true, onSelect: () => onDelete(skill) })
  }
  const text = skill.description || skill.instructions
  const last = formatDate(skill.last_used_at)

  return (
    <article className={[styles.card, className].filter(Boolean).join(' ')} data-status={skill.status}>
      <div className={styles.top}>
        <div className={styles.titleBlock}>
          <h3 className={styles.title}>
            {editable && onEdit ? (
              <button type="button" className={styles.titleBtn} onClick={() => onEdit(skill)}>
                {skill.name || 'Без названия'}
              </button>
            ) : (
              skill.name || 'Без названия'
            )}
          </h3>
          <div className={styles.badges}>
            <code className={styles.slash} aria-label={`Команда /${skill.slash}`}>
              /{skill.slash}
            </code>
            <StatusBadge status={skill.status} />
            {skill.visibility === 'public' && <span className={styles.shared}>Общий</span>}
          </div>
        </div>
        {items.length > 0 && <CardMenu label={`Действия: ${skill.name || 'навык'}`} items={items} />}
      </div>
      {text && <p className={styles.desc}>{text}</p>}
      <footer className={styles.foot}>
        {usesLabel(skill.uses)}
        {last ? ` · последний раз ${last}` : ''}
      </footer>
    </article>
  )
}
