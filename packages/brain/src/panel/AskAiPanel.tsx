import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { Icon, type IconName } from '@wowhaus-24/ui-react'

import { BrainIcon } from '../icons.js'
import { SourceList, type NumberedSource } from '../sources/SourceList.js'
import type { ModuleMetaMap } from '../sources/modules.js'
import type { BrainSource } from '../types.js'
import styles from './panel.module.css'

export type BrainMode = 'search' | 'ask'

export interface AskAiPreset {
  label: string
  /** Что отправить по клику. Нет — отправляется `label`. */
  prompt?: string
  icon?: IconName
}

export interface AskAiPanelProps {
  /** `side` — панель 440px справа (позиционирует хост), `page` — страница хаба и телефон. */
  layout: 'side' | 'page'
  title?: string
  mode: BrainMode
  /** Без обработчика переключателя «Найти | Спросить» нет. */
  onModeChange?: (mode: BrainMode) => void

  /** Чип контекста («Лид: Офис на Мясницкой ×», «Искать только здесь»). */
  contextSlot?: ReactNode
  /** Выбор модели (`Combobox` хоста). */
  modelSlot?: ReactNode
  onNewChat?: () => void
  /** «⤢» — открыть разговор страницей хаба. */
  onExpand?: () => void
  onClose?: () => void

  /** Пустое состояние: нет сообщений. По умолчанию — когда `children` пуст. */
  empty?: boolean
  emptyTitle?: string
  emptyText?: ReactNode
  presets?: AskAiPreset[]
  onPreset?: (preset: AskAiPreset) => void

  /** Лента сообщений (`UserMessage`, `AssistantMessage`…). */
  children?: ReactNode
  /** Источники последнего ответа или результаты поиска — всегда видны под лентой. */
  sources?: NumberedSource[]
  sourcesTitle?: string
  activeSource?: number
  onOpenSource?: (url: string, source: BrainSource) => void
  modules?: ModuleMetaMap

  /** Поле ввода (`BrainComposer`). */
  composer?: ReactNode
  /** Под полем: `UsageMeter`, `PrivacyNotice`. */
  footer?: ReactNode
  /** Ответ в работе — лента держится у низа. */
  busy?: boolean
  error?: string | null
  onDismissError?: () => void
  className?: string
}

/**
 * Контейнер панели «Спросить ИИ». Состояние разговора снаружи: панель не знает
 * про треды, модели и запросы — только раскладывает то, что ей дали, и держит
 * ленту у последнего сообщения.
 */
export function AskAiPanel({
  layout,
  title = 'Спросить ИИ',
  mode,
  onModeChange,
  contextSlot,
  modelSlot,
  onNewChat,
  onExpand,
  onClose,
  empty,
  emptyTitle,
  emptyText,
  presets,
  onPreset,
  children,
  sources,
  sourcesTitle,
  activeSource,
  onOpenSource,
  modules,
  composer,
  footer,
  busy,
  error,
  onDismissError,
  className,
}: AskAiPanelProps) {
  const isEmpty =
    empty ?? (children == null || children === false || (Array.isArray(children) && children.length === 0))
  const bodyRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)

  // Пока пользователь читает ленту выше, новые куски ответа её не дёргают;
  // у самого низа — лента едет за ответом.
  const onScroll = () => {
    const el = bodyRef.current
    if (!el) return
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
  }
  useLayoutEffect(() => {
    const el = bodyRef.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  })
  useEffect(() => {
    stickToBottom.current = true
  }, [isEmpty])

  // Модель — во второй строке, рядом с режимом: в первой ей с заголовком и
  // кнопками не хватало места, и шапка переносилась в три строки.
  const secondRow = Boolean(contextSlot || onModeChange)

  const heading = (
    <>
      <span className={styles.titleIcon}>
        <BrainIcon name="sparkle" size={16} />
      </span>
      <h2 className={styles.title}>{title}</h2>
    </>
  )

  const defaultEmptyTitle = mode === 'search' ? 'Найти в портале' : 'Чем помочь?'
  const defaultEmptyText =
    mode === 'search'
      ? 'Поиск по карточкам, записям, вики и задачам — только среди того, к чему у вас есть доступ.'
      : 'Ответ опирается на данные портала, к которым у вас есть доступ. Источники — под каждым ответом.'

  return (
    <section
      className={[styles.panel, layout === 'side' ? styles.side : styles.page, className]
        .filter(Boolean)
        .join(' ')}
      aria-label={title}
      aria-busy={busy || undefined}
    >
      <header className={styles.head}>
        <div className={styles.headRow}>
          {heading}
          <div className={styles.headActions}>
            {modelSlot && !secondRow && <div className={styles.model}>{modelSlot}</div>}
            {onNewChat && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={onNewChat}>
                <Icon name="plus" size={14} />
                Новый чат
              </button>
            )}
            {onExpand && (
              <button
                type="button"
                className={styles.iconBtn}
                aria-label="Открыть на всю страницу"
                onClick={onExpand}
              >
                <BrainIcon name="expand" size={15} />
              </button>
            )}
            {onClose && (
              <button type="button" className={styles.iconBtn} aria-label="Закрыть" onClick={onClose}>
                <Icon name="close" size={15} />
              </button>
            )}
          </div>
        </div>
        {secondRow && (
          <div className={styles.headRow}>
            {onModeChange && (
              <div className={styles.modes} role="group" aria-label="Режим">
                <button
                  type="button"
                  className={styles.modeBtn}
                  aria-pressed={mode === 'search'}
                  onClick={() => onModeChange('search')}
                >
                  <Icon name="search" size={13} />
                  Найти
                </button>
                <button
                  type="button"
                  className={styles.modeBtn}
                  aria-pressed={mode === 'ask'}
                  onClick={() => onModeChange('ask')}
                >
                  <BrainIcon name="sparkle" size={13} />
                  Спросить
                </button>
              </div>
            )}
            {contextSlot && <div className={styles.context}>{contextSlot}</div>}
            {modelSlot && <div className={styles.model}>{modelSlot}</div>}
          </div>
        )}
      </header>

      <div ref={bodyRef} className={styles.body} onScroll={onScroll}>
        {isEmpty ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <BrainIcon name="sparkle" size={22} />
            </div>
            <div className={styles.emptyTitle}>{emptyTitle ?? defaultEmptyTitle}</div>
            <div className={styles.emptyText}>{emptyText ?? defaultEmptyText}</div>
            {presets && presets.length > 0 && onPreset && (
              <div className={styles.presets} aria-label="Подсказки">
                {presets.map((p, i) => (
                  <button
                    key={`${i}-${p.label}`}
                    type="button"
                    className={styles.preset}
                    onClick={() => onPreset(p)}
                  >
                    {p.icon && <Icon name={p.icon} size={14} />}
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className={styles.messages}>{children}</div>
        )}
        {sources && (
          <SourceList
            className={styles.sources}
            sources={sources}
            title={sourcesTitle ?? (mode === 'search' ? 'Найдено' : 'Источники')}
            activeN={activeSource}
            onOpen={onOpenSource}
            modules={modules}
            emptyText={mode === 'search' ? 'Ничего не найдено среди доступного вам.' : undefined}
          />
        )}
        {error && (
          <div className={styles.error} role="alert">
            <span className={styles.errorText}>{error}</span>
            {onDismissError && (
              <button
                type="button"
                className={styles.iconBtn}
                aria-label="Скрыть ошибку"
                onClick={onDismissError}
              >
                <Icon name="close" size={13} />
              </button>
            )}
          </div>
        )}
      </div>

      {(composer || footer) && (
        <footer className={styles.foot}>
          {composer}
          {footer && <div className={styles.footMeta}>{footer}</div>}
        </footer>
      )}
    </section>
  )
}
