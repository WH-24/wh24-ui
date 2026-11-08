/*
 * Разметка ответов ассистента. Перенесено из wh24-ai-web/src/components/
 * Markdown.tsx, плюс цитаты `[n]` → CitationChip и внутренние ссылки через
 * onNavigate (портал не перезагружает страницу).
 *
 * Сырой HTML НЕ включаем (никакого rehype-raw): текст приходит от нейросети, а
 * значит частично управляется тем, что попало в промпт. react-markdown без
 * этого плагина не создаёт HTML-узлы из текста — теги остаются текстом, и
 * внедрить <script> или обработчик события через ответ модели нельзя.
 *
 * remark-gfm нужен для таблиц, зачёркивания и списков задач: без него модель
 * рисует таблицу палками, а пользователь видит кашу.
 *
 * Файлы из ответа (владелец, 07.10.2026: «создай файл excel…»): под таблицей —
 * «Скачать .xlsx», под блоком кода — «Скачать файл».
 */
import { useMemo, type MouseEvent, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { BrainIcon } from '../icons.js'
import { buildXlsx, downloadBytes, XLSX_MIME } from '../xlsx.js'
import { CitationChip } from './CitationChip.js'
import { CITATION_TAG, remarkCitations } from './citations.js'
import styles from './markdown.module.css'

/** Узел разбора (hast) — нужен только текст и дети. */
type HastNode = {
  type: string
  tagName?: string
  value?: string
  children?: HastNode[]
  properties?: Record<string, unknown>
}

function textOf(n: HastNode | undefined): string {
  if (!n) return ''
  if (n.type === 'text') return n.value ?? ''
  if (n.tagName === 'br') return '\n'
  return (n.children ?? []).map(textOf).join('')
}

/** Строки таблицы из её узла: шапка и тело в порядке следования. */
export function tableRows(table: HastNode | undefined): string[][] {
  const rows: string[][] = []
  const walk = (n: HastNode) => {
    if (n.tagName === 'tr') {
      rows.push(
        (n.children ?? [])
          .filter((c) => c.tagName === 'td' || c.tagName === 'th')
          .map((c) => textOf(c).trim()),
      )
      return
    }
    for (const c of n.children ?? []) walk(c)
  }
  if (table) walk(table)
  return rows
}

const EXT: Record<string, string> = {
  csv: 'csv',
  json: 'json',
  python: 'py',
  py: 'py',
  javascript: 'js',
  js: 'js',
  typescript: 'ts',
  ts: 'ts',
  sql: 'sql',
  xml: 'xml',
  html: 'html',
  markdown: 'md',
  md: 'md',
  yaml: 'yaml',
  yml: 'yml',
  bash: 'sh',
  sh: 'sh',
  shell: 'sh',
  text: 'txt',
  txt: 'txt',
  go: 'go',
  css: 'css',
  ini: 'ini',
}

const MIME: Record<string, string> = {
  csv: 'text/csv;charset=utf-8',
  json: 'application/json',
  html: 'text/html;charset=utf-8',
  xml: 'application/xml',
}

function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`
}

/** Внутренняя ссылка портала: путь от корня. `//host` — внешняя. */
export function isInternalHref(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//')
}

export interface MarkdownCitation {
  n: number
  title?: string
}

export interface MarkdownProps {
  text: string
  /**
   * Источники ответа: `[n]` с таким номером рисуется чипом. Без списка чипами
   * становятся все `[n]`, если задан `onCitationClick`; иначе текст как есть.
   */
  citations?: MarkdownCitation[]
  /** Подсветить чип выбранного источника. */
  activeCitation?: number
  onCitationClick?: (n: number) => void
  /** Внутренние ссылки (`/oup/leads/…`) — навигация хоста без перезагрузки. */
  onNavigate?: (path: string) => void
  className?: string
}

export function Markdown({
  text,
  citations,
  activeCitation,
  onCitationClick,
  onNavigate,
  className,
}: MarkdownProps) {
  const titles = useMemo(() => {
    const m = new Map<number, string | undefined>()
    for (const c of citations ?? []) m.set(c.n, c.title)
    return m
  }, [citations])

  const plugins = useMemo(() => {
    const keep = citations ? (n: number) => titles.has(n) : () => Boolean(onCitationClick)
    return [remarkGfm, remarkCitations(keep)]
  }, [citations, titles, onCitationClick])

  const components = useMemo(() => {
    const c: Record<string, unknown> = {
      // Внешние ссылки — в новой вкладке. noreferrer обязателен: целевая
      // страница не должна получить адрес портала. Внутренние — через хост.
      // node из пропсов убираем: react-markdown передаёт им узел разбора, и
      // при переносе остатка в DOM он оседает атрибутом node="[object Object]".
      a: ({
        children,
        node: _node,
        href,
        ...props
      }: {
        children?: ReactNode
        node?: unknown
        href?: string
      }) => {
        if (href && onNavigate && isInternalHref(href)) {
          return (
            <a
              {...props}
              href={href}
              onClick={(e: MouseEvent<HTMLAnchorElement>) => {
                if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
                e.preventDefault()
                onNavigate(href)
              }}
            >
              {children}
            </a>
          )
        }
        return (
          <a {...props} href={href} target="_blank" rel="noreferrer noopener">
            {children}
          </a>
        )
      },
      // Картинку из ответа НЕ загружаем, а показываем ссылкой: адрес пишет
      // модель, а значит его можно подсунуть через промпт, и браузер сам сходил
      // бы по нему с данными в адресе (аудит 07.10.2026).
      img: ({ src, alt }: { src?: unknown; alt?: string }) =>
        typeof src === 'string' && src ? (
          <a href={src} target="_blank" rel="noreferrer noopener">
            {alt || 'изображение'}
          </a>
        ) : null,
      // Таблица заворачивается в контейнер с прокруткой: широкая таблица
      // иначе растягивает всю ленту. Под ней — скачать .xlsx.
      table: ({ children, node, ...props }: { children?: ReactNode; node?: unknown }) => (
        <>
          <div className={styles.tablewrap}>
            <table {...props}>{children}</table>
          </div>
          <button
            type="button"
            className={styles.dl}
            onClick={() => {
              const rows = tableRows(node as HastNode)
              if (rows.length) {
                downloadBytes(buildXlsx(rows, 'Таблица'), `таблица_${stamp()}.xlsx`, XLSX_MIME)
              }
            }}
          >
            <BrainIcon name="table" size={15} />
            Скачать .xlsx
          </button>
        </>
      ),
      // Блок кода — файлом с расширением по языку (```csv → .csv).
      pre: ({ children, node, ...props }: { children?: ReactNode; node?: unknown }) => {
        const code = (node as HastNode | undefined)?.children?.find((c) => c.tagName === 'code')
        const cls = code?.properties?.className
        const lang = (Array.isArray(cls) ? cls : [])
          .map(String)
          .find((x) => x.startsWith('language-'))
          ?.slice('language-'.length)
          .toLowerCase()
        const ext = (lang && EXT[lang]) || 'txt'
        return (
          <>
            <pre {...props}>{children}</pre>
            <button
              type="button"
              className={styles.dl}
              onClick={() => {
                const body = textOf(code).replace(/\n$/, '')
                // BOM для CSV: иначе Excel откроет кириллицу кракозябрами.
                const data = ext === 'csv' ? '﻿' + body : body
                downloadBytes(data, `файл_${stamp()}.${ext}`, MIME[ext] ?? 'text/plain;charset=utf-8')
              }}
            >
              <BrainIcon name="file" size={15} />
              Скачать .{ext}
            </button>
          </>
        )
      },
      [CITATION_TAG]: ({
        'data-n': raw,
        'data-lead': lead,
      }: {
        'data-n'?: string | number
        'data-lead'?: string
      }) => {
        const n = Number(raw)
        if (!Number.isFinite(n)) return null
        const chip = (
          <CitationChip n={n} title={titles.get(n)} active={activeCitation === n} onClick={onCitationClick} />
        )
        // Слово перед номером и сам чип — неразрывно (см. remarkCitations).
        return lead ? (
          <span className={styles.citeGroup}>
            {lead}
            {'\u00a0'}
            {chip}
          </span>
        ) : (
          chip
        )
      },
    }
    return c as Components
  }, [onNavigate, titles, activeCitation, onCitationClick])

  return (
    <div className={[styles.md, className].filter(Boolean).join(' ')}>
      <ReactMarkdown remarkPlugins={plugins} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  )
}
