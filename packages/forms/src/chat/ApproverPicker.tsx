/**
 * Согласующие этапа маршрута: выбранные — плашками с фото из HR (отдел —
 * значком папки), «+ Согласующий» открывает справочник с вкладками
 * «Сотрудники» и «Отделы» — тот же DirectoryPicker, что в «Структуре
 * компании» и маршруте карточки проекта (владелец, 17.11.2026: «список с
 * аватарками из HR, готовый компонент, в списке должны быть и отделы»).
 *
 * Отдел хранится среди согласующих ключом `dept:<id отдела>`: за отдел решает
 * любой его сотрудник (wh24-forms-api, `route.DeptPrefix`).
 */
import { useMemo, useState } from 'react'
import { Avatar, DirectoryPicker, Icon, type DirectoryTab } from '@wowhaus-24/ui-react'

import type { OrgOption } from '../types.js'
import { DEPT_PREFIX, deptOf } from './logic.js'
import styles from './chat.module.css'

export function ApproverPicker({
  staff,
  departments = [],
  values,
  onChange,
  ariaLabel,
}: {
  staff: OrgOption[]
  departments?: OrgOption[]
  values: string[]
  onChange: (values: string[]) => void
  ariaLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const people = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff])
  const depts = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments])

  const tabs = useMemo<DirectoryTab[]>(() => {
    const taken = new Set(values)
    return [
      {
        key: 'people',
        label: 'Сотрудники',
        icon: <Icon name="users" size={14} />,
        items: staff
          .filter((s) => !taken.has(s.id))
          .map((s) => ({
            id: s.id,
            title: s.label,
            subtitle: s.hint || undefined,
            keywords: s.hint || undefined,
            avatar: <Avatar name={s.label} src={s.photo || null} size={28} />,
          })),
        emptyText: 'Все уже добавлены',
      },
      {
        key: 'depts',
        label: 'Отделы',
        icon: <Icon name="folder" size={14} />,
        items: departments
          .filter((d) => !taken.has(DEPT_PREFIX + d.id))
          .map((d) => ({
            id: d.id,
            title: d.label,
            subtitle: 'Решает любой сотрудник отдела',
            avatar: (
              <span className={`${styles.deptMark} ${styles.deptMarkLg}`} aria-hidden="true">
                <Icon name="folder" size={15} />
              </span>
            ),
          })),
        emptyText: departments.length ? 'Все отделы уже добавлены' : 'Справочник отделов недоступен',
      },
    ]
  }, [staff, departments, values])

  const close = () => {
    setOpen(false)
    setQuery('')
  }

  return (
    <div className={styles.approverPicker} role="group" aria-label={ariaLabel}>
      {values.map((id) => {
        const dept = deptOf(id)
        const label = dept ? (depts.get(dept)?.label ?? 'Отдел') : (people.get(id)?.label ?? 'Сотрудник')
        return (
          <span key={id} className={styles.approverChip}>
            {dept ? (
              <span className={styles.deptMark} aria-hidden="true">
                <Icon name="folder" size={12} />
              </span>
            ) : (
              <Avatar name={label} src={people.get(id)?.photo || null} size={20} />
            )}
            <span className={styles.approverChipName}>{dept ? `Отдел «${label}»` : label}</span>
            <button
              type="button"
              className={styles.approverChipX}
              aria-label={`Убрать: ${label}`}
              onClick={() => onChange(values.filter((v) => v !== id))}
            >
              ×
            </button>
          </span>
        )
      })}
      {open ? (
        <div className={styles.approverSearch}>
          <DirectoryPicker
            autoFocus
            placeholder="Найти сотрудника или отдел"
            query={query}
            onQueryChange={setQuery}
            tabs={tabs}
            defaultTabKey="people"
            maxHeight={260}
            onSelect={(item, tab) => {
              onChange([...values, tab.key === 'depts' ? DEPT_PREFIX + item.id : item.id])
              close()
            }}
            onClose={close}
          />
        </div>
      ) : (
        <button type="button" className={`btn btn-ghost btn-sm ${styles.approverAdd}`} onClick={() => setOpen(true)}>
          <Icon name="plus" size={14} /> Согласующий
        </button>
      )}
    </div>
  )
}
