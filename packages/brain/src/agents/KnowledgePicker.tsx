import { useId, useRef } from 'react'
import { Icon } from '@wowhaus-24/ui-react'

import { BrainIcon } from '../icons.js'
import { useFocusAfterChange } from './focus.js'
import { DEFAULT_MODULES, moduleMeta, type ModuleMetaMap } from '../sources/modules.js'
import styles from './pickers.module.css'

/** Закреплённый документ: название и ссылку по id находит хост. */
export interface PinnedDocument {
  id: string
  title?: string
  url?: string
  module?: string
}

export interface KnowledgePickerProps {
  /** Выбранные модули; пусто — все модули, доступные запускающему. */
  modules: string[]
  onModulesChange: (next: string[]) => void
  /** Модули для выбора (ключи); по умолчанию — модули портала из `DEFAULT_MODULES`. */
  moduleKeys?: string[]
  moduleLabels?: ModuleMetaMap
  /** Закреплённые документы (≤ `maxPinned`). */
  pinned: PinnedDocument[]
  onRemovePinned: (id: string) => void
  /** Хост открывает свой поиск документов и добавляет выбранный. Нет колбэка — кнопки нет. */
  onPickDocument?: () => void
  onOpenDocument?: (doc: PinnedDocument) => void
  maxPinned?: number
  readOnly?: boolean
  className?: string
}

/**
 * Знания агента: в каких модулях искать и какие документы он видит всегда.
 * Права при этом не расширяются: поиск идёт правами того, кто запускает агента,
 * — «знания шире прав» не поддерживаются.
 */
export function KnowledgePicker({
  modules,
  onModulesChange,
  moduleKeys,
  moduleLabels,
  pinned,
  onRemovePinned,
  onPickDocument,
  onOpenDocument,
  maxPinned = 5,
  readOnly,
  className,
}: KnowledgePickerProps) {
  const uid = useId()
  const list = useRef<HTMLUListElement>(null)
  const pick = useRef<HTMLButtonElement>(null)
  const heading = useRef<HTMLSpanElement>(null)
  const after = useFocusAfterChange(pinned.length)
  const removePinned = (id: string, i: number) => {
    after(() => {
      const rows = list.current?.children
      const next = rows?.[Math.min(i, (rows?.length ?? 1) - 1)]
      return next?.querySelector<HTMLElement>('button') ?? pick.current ?? heading.current
    })
    onRemovePinned(id)
  }
  const keys = moduleKeys ?? Object.keys(DEFAULT_MODULES)
  // Модуль из профиля, которого нет в списке, не теряем.
  const shown = [...keys, ...modules.filter((m) => !keys.includes(m))]
  const toggle = (m: string) => onModulesChange(modules.includes(m) ? modules.filter((x) => x !== m) : [...modules, m])

  return (
    <div className={[styles.knowledge, className].filter(Boolean).join(' ')}>
      <div role="group" aria-labelledby={`${uid}-mods`}>
        <span id={`${uid}-mods`} className={styles.subLabel}>
          Где искать
        </span>
        <div className={styles.chips}>
          {shown.map((m) => {
            const meta = moduleMeta(m, moduleLabels)
            const on = modules.includes(m)
            return (
              <button
                key={m}
                type="button"
                className={styles.chip}
                aria-pressed={on}
                disabled={readOnly}
                onClick={() => toggle(m)}
              >
                {on ? (
                  <span className={styles.chipMark}>
                    <Icon name="check" size={13} />
                  </span>
                ) : (
                  <Icon name={meta.icon} size={13} />
                )}
                {meta.label || m}
              </button>
            )
          })}
        </div>
        <p className={styles.note}>
          {modules.length === 0
            ? 'Ничего не выбрано — поиск по всем модулям, к которым есть доступ у того, кто запускает агента.'
            : 'Поиск только в выбранных модулях. Доступ запускающего при этом не расширяется.'}
        </p>
      </div>

      <div role="group" aria-labelledby={`${uid}-pin`}>
        <span ref={heading} tabIndex={-1} id={`${uid}-pin`} className={styles.subLabel}>
          Закреплённые документы
          <span className={styles.count}>
            {pinned.length} из {maxPinned}
          </span>
        </span>
        {pinned.length === 0 ? (
          <p className={styles.note}>Нет. Закрепите документ, который агент должен видеть всегда.</p>
        ) : (
          <ul ref={list} className={styles.pinned}>
            {pinned.map((d, i) => (
              <li key={d.id} className={styles.pin}>
                <BrainIcon name="file" size={14} />
                {onOpenDocument && d.url ? (
                  <a
                    className={styles.pinTitle}
                    href={d.url}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
                      e.preventDefault()
                      onOpenDocument(d)
                    }}
                  >
                    {d.title || d.id}
                  </a>
                ) : (
                  <span className={styles.pinTitle}>{d.title || d.id}</span>
                )}
                {d.module && <span className={styles.pinMeta}>{moduleMeta(d.module, moduleLabels).label}</span>}
                {!readOnly && (
                  <button
                    type="button"
                    className={styles.textBtn}
                    aria-label={`Убрать документ «${d.title || d.id}»`}
                    onClick={() => removePinned(d.id, i)}
                  >
                    Убрать
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {!readOnly && onPickDocument && (
          <button
            ref={pick}
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={pinned.length >= maxPinned}
            onClick={onPickDocument}
          >
            <Icon name="plus" size={14} />
            Закрепить документ
          </button>
        )}
      </div>
    </div>
  )
}
