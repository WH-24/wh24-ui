import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Icon } from '@wowhaus-24/ui-react'

import { BrainIcon } from '../icons.js'
import type { SlashSkill } from '../skills/types.js'
import { ACCEPT, formatSize, type BrainFile } from './files.js'
import styles from './composer.module.css'

export interface BrainComposerProps {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  /** Ответ ещё идёт: отправка заблокирована, но поле остаётся живым. */
  busy?: boolean
  /** Пока идёт ответ — кнопка «Остановить» вместо отправки. */
  onStop?: () => void
  placeholder?: string
  /** Подсказка под полем. По умолчанию — про Enter и Shift+Enter. */
  hint?: ReactNode
  /**
   * Почему поле выключено: квота исчерпана, нет прав, сервис недоступен.
   * Показывается вместо подсказки, ввод и отправка недоступны.
   */
  disabledReason?: string | null

  files?: BrainFile[]
  /** Без обработчика скрепки, вставки и перетаскивания файлов нет. */
  onAddFiles?: (files: File[]) => void
  onRemoveFile?: (id: string) => void
  /** Почему файл не добавился — показывается под полем. */
  fileError?: string | null
  accept?: string
  maxFiles?: number

  /** «+» — добавить контекст (раздел, запись, человек). Пикер даёт хост. */
  onContext?: () => void
  /** «@» — упомянуть запись, человека или агента. */
  onMention?: () => void
  /** «/» — навык. */
  onSkill?: () => void
  /**
   * Навыки для меню «/»: пока весь текст — это одно слово, начинающееся с «/», под полем
   * появляется список (↑/↓ — выбор, Enter/Tab — вставить `/команду `, Esc — закрыть).
   * Пока список с вариантами открыт, Enter не отправляет вопрос. Источник — `useSlashSkills`.
   */
  skills?: SlashSkill[]
  /** Свои кнопки в панели инструментов (после стандартных). */
  tools?: ReactNode

  /** Ставить курсор в поле при появлении и после ответа. По умолчанию да. */
  autoFocus?: boolean
  /** Выше поле не растёт — дальше прокрутка внутри него. */
  maxHeight?: number
  ariaLabel?: string
  className?: string
}

const DEFAULT_HINT = 'Enter — отправить, Shift+Enter — новая строка'
const SLASH_HINT = '↑↓ — выбрать, Enter или Tab — вставить, Esc — закрыть'
const SLASH_MAX = 8

/** Что набрано после «/», если весь текст — одно слово с «/» в начале; иначе `null`. */
export function slashQuery(value: string): string | null {
  const m = /^\/(\S*)$/.exec(value)
  return m ? m[1]! : null
}

/** Подходящие навыки: сначала те, чья команда начинается с введённого, затем где оно встречается. */
export function matchSlashSkills(skills: SlashSkill[], query: string): SlashSkill[] {
  const q = query.toLowerCase()
  if (!q) return skills.slice(0, SLASH_MAX)
  const starts: SlashSkill[] = []
  const contains: SlashSkill[] = []
  for (const s of skills) {
    const slash = s.slash.toLowerCase()
    if (slash.startsWith(q)) starts.push(s)
    else if (slash.includes(q) || s.name.toLowerCase().includes(q)) contains.push(s)
  }
  return [...starts, ...contains].slice(0, SLASH_MAX)
}

/**
 * Поле вопроса. Перенесено из wh24-ai-web/src/components/ChatComposer.tsx.
 *
 * Высота подстраивается под текст; рамка фокуса — у всей карточки; пока идёт
 * ответ, поле не выключается (блокируется только отправка). Файлы: скрепка,
 * вставка картинки из буфера (Ctrl+V скриншота) и перетаскивание на карточку.
 */
export function BrainComposer({
  value,
  onChange,
  onSend,
  busy = false,
  onStop,
  placeholder = 'Спросите или найдите в портале…',
  hint = DEFAULT_HINT,
  disabledReason,
  files = [],
  onAddFiles,
  onRemoveFile,
  fileError,
  accept = ACCEPT,
  maxFiles,
  onContext,
  onMention,
  onSkill,
  skills,
  tools,
  autoFocus = true,
  maxHeight = 180,
  ariaLabel = 'Сообщение ассистенту',
  className,
}: BrainComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const disabled = Boolean(disabledReason)
  const listId = useId()
  const optId = (i: number) => `${listId}-o${i}`
  const [active, setActive] = useState(0)
  // Esc закрывает список до следующей правки текста.
  const [dismissedFor, setDismissedFor] = useState<string | null>(null)
  const query = skills && skills.length > 0 && !disabled ? slashQuery(value) : null
  const menuOpen = query !== null && dismissedFor !== value
  const matches = useMemo(() => (menuOpen && skills ? matchSlashSkills(skills, query ?? '') : []), [menuOpen, skills, query])
  const hasOptions = menuOpen && matches.length > 0
  const activeIdx = Math.min(active, Math.max(0, matches.length - 1))
  useEffect(() => setActive(0), [query])
  const canAttach = Boolean(onAddFiles) && !disabled && (maxFiles == null || files.length < maxFiles)
  const canSend = !busy && !disabled && (value.trim().length > 0 || files.length > 0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const h = Math.min(el.scrollHeight, maxHeight)
    el.style.height = `${h}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [value, maxHeight])

  // Курсор — в поле: при появлении (первый вопрос переводит пустой экран в
  // диалог, и композер монтируется заново) и после ответа.
  useLayoutEffect(() => {
    if (autoFocus && !disabled) ref.current?.focus({ preventScroll: true })
  }, [busy, autoFocus, disabled])

  const send = () => {
    if (canSend) onSend()
  }

  const insertSkill = (sk: SlashSkill) => {
    const text = `/${sk.slash} `
    onChange(text)
    requestAnimationFrame(() => {
      const el = ref.current
      if (!el) return
      el.focus()
      el.setSelectionRange(text.length, text.length)
    })
  }

  const addFiles = (list: File[]) => {
    if (!onAddFiles || !canAttach || list.length === 0) return
    const room = maxFiles == null ? list.length : Math.max(0, maxFiles - files.length)
    onAddFiles(list.slice(0, room))
  }

  const hasTools = Boolean(onContext || onMention || onSkill || tools || canAttach)

  return (
    <div
      className={[styles.composer, className].filter(Boolean).join(' ')}
      data-dragging={dragging || undefined}
      data-disabled={disabled || undefined}
      onClick={() => ref.current?.focus()}
      onDragOver={(e) => {
        if (!canAttach || !e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
      }}
      onDrop={(e) => {
        if (!canAttach) return
        e.preventDefault()
        setDragging(false)
        addFiles(Array.from(e.dataTransfer.files ?? []))
      }}
    >
      {files.length > 0 && (
        <div className={styles.files}>
          {files.map((f) => (
            <span key={f.id} className={styles.fileChip} title={`${f.name} · ${formatSize(f.size)}`}>
              {f.previewUrl ? (
                <img src={f.previewUrl} alt="" className={styles.thumb} />
              ) : (
                <span className={styles.fileIcon}>
                  <BrainIcon name="file" size={16} />
                </span>
              )}
              <span className={styles.fileName}>{f.name}</span>
              {onRemoveFile && (
                <button
                  type="button"
                  className={styles.fileRemove}
                  aria-label={`Убрать «${f.name}»`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemoveFile(f.id)
                  }}
                >
                  <Icon name="close" size={12} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      <textarea
        ref={ref}
        className={styles.input}
        aria-label={ariaLabel}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onPaste={(e) => {
          // Скриншот из буфера — сразу вложением. Текст вставляется как обычно.
          const pasted = Array.from(e.clipboardData?.files ?? [])
          if (pasted.length && canAttach) {
            e.preventDefault()
            addFiles(pasted)
          }
        }}
        aria-autocomplete={hasOptions ? 'list' : undefined}
        aria-controls={hasOptions ? listId : undefined}
        aria-activedescendant={hasOptions ? optId(activeIdx) : undefined}
        onKeyDown={(e) => {
          if (menuOpen && !e.nativeEvent.isComposing) {
            if (hasOptions && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
              e.preventDefault()
              const n = matches.length
              setActive((i) => (e.key === 'ArrowDown' ? (Math.min(i, n - 1) + 1) % n : (Math.min(i, n - 1) - 1 + n) % n))
              return
            }
            if (hasOptions && ((e.key === 'Enter' && !e.shiftKey) || (e.key === 'Tab' && !e.shiftKey))) {
              e.preventDefault()
              insertSkill(matches[activeIdx]!)
              return
            }
            if (e.key === 'Escape') {
              // Esc, закрывающий список, не должен закрыть ещё и панель хоста.
              e.preventDefault()
              e.stopPropagation()
              setDismissedFor(value)
              return
            }
          }
          // isComposing — набор через IME: Enter подтверждает слово.
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            send()
          }
        }}
        placeholder={placeholder}
        rows={1}
      />
      {menuOpen && (
        <div className={styles.slashMenu} onMouseDown={(e) => e.preventDefault()} onClick={(e) => e.stopPropagation()}>
          {matches.length > 0 ? (
            <ul id={listId} role="listbox" aria-label="Навыки" className={styles.slashList}>
              {matches.map((sk, i) => (
                <li
                  key={sk.slash}
                  id={optId(i)}
                  role="option"
                  aria-selected={i === activeIdx}
                  className={styles.slashOption}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => insertSkill(sk)}
                >
                  <span className={styles.slashCmd}>/{sk.slash}</span>
                  <span className={styles.slashName}>{sk.name}</span>
                  {sk.description && <span className={styles.slashDesc}>{sk.description}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p role="status" className={styles.slashEmpty}>
              Нет навыка с такой командой — вопрос уйдёт как есть.
            </p>
          )}
        </div>
      )}
      {fileError && (
        <div role="alert" className={styles.fileError}>
          {fileError}
        </div>
      )}
      <div className={styles.bar}>
        {hasTools && (
          <div className={styles.tools} onClick={(e) => e.stopPropagation()}>
            {onContext && (
              <button
                type="button"
                className={styles.tool}
                aria-label="Добавить контекст"
                title="Добавить контекст: раздел, запись, человек"
                disabled={disabled}
                onClick={onContext}
              >
                <Icon name="plus" size={17} />
              </button>
            )}
            {canAttach && (
              <>
                <button
                  type="button"
                  className={styles.tool}
                  aria-label="Приложить файл"
                  title="Приложить файл: картинки, PDF, Excel, Word, текст. Можно вставить скриншот Ctrl+V или перетащить файл сюда."
                  onClick={() => fileRef.current?.click()}
                >
                  <Icon name="clip" size={17} />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  multiple={maxFiles !== 1}
                  accept={accept}
                  hidden
                  onChange={(e) => {
                    const list = Array.from(e.target.files ?? [])
                    // Сброс: иначе повторный выбор того же файла не даёт change.
                    e.target.value = ''
                    addFiles(list)
                  }}
                />
              </>
            )}
            {onMention && (
              <button
                type="button"
                className={styles.tool}
                aria-label="Упомянуть"
                title="Упомянуть запись, человека или агента"
                disabled={disabled}
                onClick={onMention}
              >
                <Icon name="at" size={17} />
              </button>
            )}
            {onSkill && (
              <button
                type="button"
                className={styles.tool}
                aria-label="Навык"
                title="Навык (/команда)"
                disabled={disabled}
                onClick={onSkill}
              >
                <BrainIcon name="slash" size={17} />
              </button>
            )}
            {tools}
          </div>
        )}
        <span
          className={styles.hint}
          data-tone={disabled ? 'warn' : undefined}
          role={disabled ? 'status' : undefined}
        >
          {disabled ? disabledReason : dragging ? 'Отпустите, чтобы приложить' : hasOptions ? SLASH_HINT : hint}
        </span>
        {busy && onStop ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onStop()
            }}
            className={`btn btn-secondary ${styles.send}`}
            aria-label="Остановить"
            title="Остановить"
          >
            <span className={styles.stopIcon} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              send()
            }}
            className={`btn btn-primary ${styles.send}`}
            aria-label={busy ? 'Ассистент отвечает' : 'Отправить'}
            disabled={!canSend}
          >
            <Icon name="send" size={17} />
          </button>
        )}
      </div>
    </div>
  )
}
