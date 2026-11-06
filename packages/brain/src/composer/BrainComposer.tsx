import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from '@wowhaus-24/ui-react'

import { BrainIcon } from '../icons.js'
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
        onKeyDown={(e) => {
          // isComposing — набор через IME: Enter подтверждает слово.
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            send()
          }
        }}
        placeholder={placeholder}
        rows={1}
      />
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
          {disabled ? disabledReason : dragging ? 'Отпустите, чтобы приложить' : hint}
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
