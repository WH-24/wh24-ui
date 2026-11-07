import { useId, useMemo, useState } from 'react'
import { Input } from '@wowhaus-24/ui-react'

import { moduleMeta, type ModuleMetaMap } from '../sources/modules.js'
import { BrainSwitch } from './Switch.js'
import styles from './pickers.module.css'
import type { AgentToolInfo, WritePolicy } from './types.js'

export interface ToolPickerProps {
  /** Инструменты, доступные вам (`GET /agent-tools`). Недоступного в списке нет. */
  tools: AgentToolInfo[]
  /** Выбранные имена; пустой список = все доступные. */
  value: string[]
  onChange: (next: string[]) => void
  /** Политика записи агента: при «Только читать» инструменты записи агенту не выдаются. */
  writePolicy?: WritePolicy
  readOnly?: boolean
  loading?: boolean
  error?: string | null
  modules?: ModuleMetaMap
  className?: string
}

const WRITE_BADGE = 'требует подтверждения'

/**
 * Выбор инструментов агента. «Все доступные» (пусто) — агент получает всё, что
 * доступно запускающему на момент запуска. Чтение и запись — отдельными
 * группами: запись всегда идёт предпросмотром и ждёт «Подтвердить».
 */
export function ToolPicker({
  tools,
  value,
  onChange,
  writePolicy,
  readOnly,
  loading,
  error,
  modules,
  className,
}: ToolPickerProps) {
  const uid = useId()
  const [q, setQ] = useState('')
  const [hint, setHint] = useState<string | null>(null)
  const all = value.length === 0
  const known = useMemo(() => new Set(tools.map((t) => t.name)), [tools])
  const selected = useMemo(() => new Set(value), [value])
  // В профиле остались инструменты, которых вам уже не видно: показываем, а не теряем молча.
  const missing = value.filter((n) => !known.has(n))

  const needle = q.trim().toLowerCase()
  const visible = tools.filter(
    (t) =>
      !needle ||
      t.title.toLowerCase().includes(needle) ||
      t.name.toLowerCase().includes(needle) ||
      (t.description ?? '').toLowerCase().includes(needle),
  )
  const reads = visible.filter((t) => !t.write)
  const writes = visible.filter((t) => t.write)

  const toggleAll = (on: boolean) => {
    setHint(null)
    // «Все» → пусто; снять «Все» → явный полный список, из которого можно убирать.
    onChange(on ? [] : tools.map((t) => t.name))
  }
  const toggle = (name: string) => {
    if (all) return
    if (selected.has(name)) {
      if (value.length === 1) {
        setHint('Нужен хотя бы один инструмент. Чтобы выдать все, включите «Все доступные»')
        return
      }
      setHint(null)
      onChange(value.filter((n) => n !== name))
    } else {
      setHint(null)
      onChange([...value, name])
    }
  }

  const row = (t: AgentToolInfo) => {
    const checked = all || selected.has(t.name)
    const meta = moduleMeta(t.source, modules)
    return (
      <li key={t.name}>
        <label className={styles.toolRow} data-on={checked || undefined}>
          <input
            type="checkbox"
            className={styles.check}
            checked={checked}
            disabled={readOnly || all}
            onChange={() => toggle(t.name)}
          />
          <span className={styles.toolBody}>
            <span className={styles.toolTitle}>
              {t.title || t.name}
              {t.write && <span className={styles.writeBadge}>{WRITE_BADGE}</span>}
            </span>
            {t.description && <span className={styles.toolDesc}>{t.description}</span>}
            <span className={styles.toolMeta}>
              <code>{t.name}</code>
              {t.source && <span>{meta.label || t.source}</span>}
            </span>
          </span>
        </label>
      </li>
    )
  }

  const group = (title: string, note: string | null, list: AgentToolInfo[]) =>
    list.length > 0 && (
      <section className={styles.group} aria-labelledby={`${uid}-${title}`}>
        <h4 id={`${uid}-${title}`} className={styles.groupTitle}>
          {title}
          <span className={styles.count}>{list.length}</span>
        </h4>
        {note && <p className={styles.groupNote}>{note}</p>}
        <ul className={styles.toolList}>{list.map(row)}</ul>
      </section>
    )

  return (
    <div className={[styles.tools, className].filter(Boolean).join(' ')} aria-busy={loading || undefined}>
      <BrainSwitch checked={all} disabled={readOnly || loading} onChange={toggleAll}>
        Все доступные
      </BrainSwitch>
      <p className={styles.note}>
        {all
          ? 'Агент получает все инструменты, доступные тому, кто его запускает, — и только их.'
          : `Выбрано инструментов: ${value.length}. Остальные агенту не выдаются.`}
      </p>

      {loading && <p className={styles.note}>Загружаю инструменты…</p>}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {!loading && !error && tools.length === 0 && <p className={styles.note}>Доступных вам инструментов нет.</p>}

      {tools.length > 0 && (
        <>
          <Input
            type="search"
            aria-label="Найти инструмент"
            placeholder="Найти инструмент"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {visible.length === 0 && <p className={styles.note}>Ничего не найдено.</p>}
          {group('Чтение', null, reads)}
          {group(
            'Запись',
            writePolicy === 'deny'
              ? 'Сейчас выбрано «Только читать»: инструменты записи агенту не выдаются.'
              : 'Агент только готовит запись предпросмотром — выполняет её человек кнопкой «Подтвердить».',
            writes,
          )}
        </>
      )}

      {missing.length > 0 && (
        <section className={styles.group} aria-labelledby={`${uid}-missing`}>
          <h4 id={`${uid}-missing`} className={styles.groupTitle}>
            Сейчас недоступны вам
          </h4>
          <ul className={styles.toolList}>
            {missing.map((n) => (
              <li key={n}>
                <label className={styles.toolRow} data-on>
                  <input
                    type="checkbox"
                    className={styles.check}
                    checked
                    disabled={readOnly}
                    onChange={() => toggle(n)}
                  />
                  <span className={styles.toolBody}>
                    <span className={styles.toolMeta}>
                      <code>{n}</code>
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className={styles.live} role="status" aria-live="polite">
        {hint}
      </div>
    </div>
  )
}
