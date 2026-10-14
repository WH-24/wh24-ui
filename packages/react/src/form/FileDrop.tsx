import { useRef, useState, type DragEvent, type CSSProperties } from 'react'

import { Icon } from '../list/Icon.js'

import styles from './form.module.css'

export interface FileDropItem {
  /** Идентификатор вложения на стороне сервиса. */
  id: string
  name: string
  /** Размер в байтах. Не задан — строка размера не рисуется. */
  size?: number
  /**
   * Прямая ссылка на файл. Задавать ТОЛЬКО если она уже получена: у вложений
   * форм публичного URL не бывает, presigned-GET живёт минуты — обычно ссылку
   * берут по клику, через `onOpen`, а не держат в списке заранее.
   */
  href?: string
}

export interface FileDropProps {
  /** Уже прикреплённые файлы. */
  files: FileDropItem[]
  /** Пользователь выбрал или перетащил файлы. Без обработчика зона не рисуется. */
  onAdd?: (files: File[]) => void
  /** Открепить файл. Без обработчика крестик не рисуется. */
  onRemove?: (item: FileDropItem) => void
  /** Клик по имени файла, когда ссылки в `href` нет (её нужно ещё получить). */
  onOpen?: (item: FileDropItem) => void
  /** Фильтр диалога выбора файла (атрибут accept). */
  accept?: string
  /** Потолок количества файлов. По достижении зона скрывается. */
  maxFiles?: number
  disabled?: boolean
  id?: string
  className?: string
  style?: CSSProperties
}

function formatSize(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} МБ`
  if (n >= 1024) return `${Math.round(n / 1024)} КБ`
  return `${n} Б`
}

/**
 * FileDrop — вложения поля типа «файлы»: зона перетаскивания плюс список
 * прикреплённого.
 *
 * Загрузку и получение ссылок компонент НЕ делает: он отдаёт выбранные `File`
 * наверх и показывает то, что ему дали. Так он одинаково работает и в карточке
 * записи (файл уходит в S3 сразу), и в превью редактора схемы (не уходит
 * никуда).
 */
export function FileDrop({
  files,
  onAdd,
  onRemove,
  onOpen,
  accept,
  maxFiles,
  disabled = false,
  id,
  className,
  style,
}: FileDropProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const full = maxFiles != null && files.length >= maxFiles
  const canAdd = Boolean(onAdd) && !disabled && !full

  const add = (list: FileList | null) => {
    if (!list || !onAdd) return
    const picked = Array.from(list)
    // Лишнее отрезаем здесь, а не молча отправляем на сервер: там это 400,
    // и пользователь узнает о потолке после ожидания загрузки.
    const room = maxFiles == null ? picked.length : Math.max(0, maxFiles - files.length)
    if (room > 0) onAdd(picked.slice(0, room))
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setOver(false)
    if (canAdd) add(e.dataTransfer.files)
  }

  return (
    <div className={[styles.fd, className].filter(Boolean).join(' ')} style={style}>
      {files.length > 0 && (
        <ul className={styles.fdList}>
          {files.map((f) => (
            <li key={f.id} className={styles.fdItem}>
              {f.href ? (
                <a
                  className={styles.fdName}
                  href={f.href}
                  title={f.name}
                  target="_blank"
                  rel="noreferrer"
                >
                  {f.name}
                </a>
              ) : onOpen ? (
                <a
                  className={styles.fdName}
                  href="#"
                  title={f.name}
                  onClick={(e) => {
                    e.preventDefault()
                    onOpen(f)
                  }}
                >
                  {f.name}
                </a>
              ) : (
                <span className={styles.fdName} title={f.name}>
                  {f.name}
                </span>
              )}
              {f.size != null && <span className={styles.fdSize}>{formatSize(f.size)}</span>}
              {onRemove && !disabled && (
                <button
                  type="button"
                  className={styles.fdRm}
                  aria-label={`Открепить «${f.name}»`}
                  onClick={() => onRemove(f)}
                >
                  <Icon name="close" size={12} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {onAdd && !full && (
        <div
          className={styles.fdZone}
          data-over={over || undefined}
          data-disabled={disabled || undefined}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled || undefined}
          onClick={() => canAdd && inputRef.current?.click()}
          onKeyDown={(e) => {
            if (!canAdd) return
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              inputRef.current?.click()
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault()
            if (canAdd) setOver(true)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            if (canAdd) setOver(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            setOver(false)
          }}
          onDrop={onDrop}
        >
          <span className={styles.fdIcon} aria-hidden>
            <Icon name="upload" size={18} />
          </span>
          <span className={styles.fdTitle}>Перетащите файлы сюда</span>
          <span className={styles.fdSub}>
            или <span className={styles.fdLink}>выберите вручную</span>
            {maxFiles != null && ` · не больше ${maxFiles}`}
          </span>
          <input
            id={id}
            ref={inputRef}
            type="file"
            multiple={maxFiles !== 1}
            accept={accept}
            disabled={disabled}
            style={{ display: 'none' }}
            onChange={(e) => {
              add(e.target.files)
              // Сброс, иначе повторный выбор того же файла не даст change.
              e.target.value = ''
            }}
          />
        </div>
      )}
    </div>
  )
}
