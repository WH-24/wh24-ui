import { useMemo, useState } from 'react'
import { Icon } from '@wowhaus-24/ui-react'

import { BrainConfirm } from '../fields/Dialog.js'
import { brainErrorText } from '../fields/errors.js'
import { SkillCard } from './SkillCard.js'
import type { Skill, SkillStatus } from './types.js'
import styles from './skills.module.css'

export interface SkillsListProps {
  skills: Skill[]
  /** Первая загрузка: вместо пустого состояния — «Загружаю навыки…». */
  loading?: boolean
  /** Список не загрузился: текст ошибки и «Повторить». */
  error?: string | null
  onRetry?: () => void
  /** «Создать навык» в пустом состоянии (кнопка есть, если передан обработчик). */
  onCreate?: () => void
  /** «Найти в чатах» в пустом состоянии. */
  onSuggest?: () => void
  onEdit?: (skill: Skill) => void
  onSetStatus?: (skill: Skill, status: SkillStatus) => void | Promise<void>
  /** Вызывается после подтверждения «Удалить». Ошибка (reject) остаётся в окне подтверждения. */
  onDelete?: (skill: Skill) => void | Promise<void>
  className?: string
}

const ORDER: Record<SkillStatus, number> = { active: 0, draft: 1, archived: 2 }

/**
 * Список навыков: сетка карточек (включённые первыми, архив — в конце) и
 * пустое состояние с объяснением и кнопками «Создать навык» / «Найти в чатах».
 * Удаление подтверждается окном пакета — хосту достаточно удалить на сервере.
 */
export function SkillsList({ skills, loading, error, onRetry, onCreate, onSuggest, onEdit, onSetStatus, onDelete, className }: SkillsListProps) {
  const [toDelete, setToDelete] = useState<Skill | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const sorted = useMemo(
    () => [...skills].sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name, 'ru')),
    [skills],
  )

  const confirmDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    setDeleteError('')
    try {
      await onDelete?.(toDelete)
      setToDelete(null)
    } catch (e) {
      setDeleteError(brainErrorText(e, 'Не удалось удалить навык. Попробуйте ещё раз.'))
    } finally {
      setDeleting(false)
    }
  }

  let body
  if (error && skills.length === 0) {
    body = (
      <div className={styles.state} role="alert">
        <p className={styles.stateText}>{error}</p>
        {onRetry && (
          <button type="button" className="btn btn-secondary" onClick={onRetry}>
            Повторить
          </button>
        )}
      </div>
    )
  } else if (loading && skills.length === 0) {
    body = (
      <p className={styles.state} role="status">
        Загружаю навыки…
      </p>
    )
  } else if (skills.length === 0) {
    body = (
      <div className={styles.empty}>
        <span className={styles.emptyIcon} aria-hidden="true">
          <Icon name="bolt" size={20} />
        </span>
        <h3 className={styles.emptyTitle}>Навыков пока нет</h3>
        <p className={styles.stateText}>
          Навык — это сохранённая инструкция, которую вызывают командой в начале вопроса: например, «/дайджест» соберёт сводку по вашему шаблону.
        </p>
        <div className={styles.emptyActions}>
          {onCreate && (
            <button type="button" className="btn btn-primary" onClick={onCreate}>
              <Icon name="plus" size={14} />
              Создать навык
            </button>
          )}
          {onSuggest && (
            <button type="button" className="btn btn-secondary" onClick={onSuggest}>
              <Icon name="search" size={14} />
              Найти в чатах
            </button>
          )}
        </div>
      </div>
    )
  } else {
    body = (
      <ul className={styles.grid} aria-label="Навыки">
        {sorted.map((s) => (
          <li key={s.id} className={styles.gridItem}>
            <SkillCard
              skill={s}
              onEdit={onEdit}
              onSetStatus={onSetStatus ? (sk, st) => void onSetStatus(sk, st) : undefined}
              onDelete={onDelete ? (sk) => setToDelete(sk) : undefined}
            />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className={className}>
      {error && skills.length > 0 && (
        <p className={styles.inlineError} role="alert">
          {error}
        </p>
      )}
      {body}
      <BrainConfirm
        open={Boolean(toDelete)}
        title={`Удалить навык «${toDelete?.name ?? ''}»?`}
        message={
          <>
            Команда <code>/{toDelete?.slash}</code> перестанет работать. Это нельзя отменить.
            {deleteError && (
              <span className={styles.confirmError} role="alert">
                {deleteError}
              </span>
            )}
          </>
        }
        confirmLabel="Удалить"
        danger
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          setToDelete(null)
          setDeleteError('')
        }}
      />
    </div>
  )
}
