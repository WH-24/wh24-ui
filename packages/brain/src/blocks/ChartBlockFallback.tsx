/*
 * Запасной вид блока «график» для хоста без Perspective: заголовок, таблица
 * первых строк, «Скачать .xlsx» (та же сборка книги, что у таблиц разметки) и
 * «Что посчитано». Портал рисует блок своим просмотрщиком через `renderBlock`
 * в AssistantMessage; сюда попадают фронты модулей и тесты.
 */
import { BrainIcon } from '../icons.js'
import type { RunBlock, RunBlockCell, RunBlockColumn } from '../types.js'
import { buildXlsx, downloadBytes, XLSX_MIME } from '../xlsx.js'
import { BlockExplain, formatBlockDate } from './BlockExplain.js'
import styles from './blocks.module.css'

export interface ChartBlockFallbackProps {
  block: RunBlock
  /** Сколько строк показать в таблице; остальные — в .xlsx. По умолчанию 20. */
  maxRows?: number
  className?: string
}

export function isNumericColumn(c: RunBlockColumn | undefined): boolean {
  return c?.type === 'integer' || c?.type === 'float'
}

const floatFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 })

/**
 * Значение ячейки текстом для показа: дробные по-русски («1 234,5»), целые как
 * есть (год и номер не группируются), даты дд.мм.гггг, да/нет.
 */
export function formatBlockValue(v: RunBlockCell, column?: RunBlockColumn): string {
  if (v == null) return ''
  if (typeof v === 'boolean') return v ? 'да' : 'нет'
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return ''
    if (column?.type === 'integer') return String(v)
    return Number.isInteger(v) && column?.type !== 'float' ? String(v) : floatFormat.format(v)
  }
  if (column?.type === 'date') return formatBlockDate(v)
  if (column?.type === 'datetime') {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? v : d.toLocaleString('ru-RU')
  }
  return v
}

/** Строки для книги .xlsx: шапка из заголовков колонок, числа — числами. */
export function blockToRows(block: RunBlock): string[][] {
  const head = block.columns.map((c) => c.title)
  const body = block.rows.map((r) =>
    block.columns.map((c, j) => {
      const v = r[j]
      return typeof v === 'number' ? (Number.isFinite(v) ? String(v) : '') : formatBlockValue(v ?? null, c)
    }),
  )
  return [head, ...body]
}

/** Имя файла из заголовка блока: без символов, запрещённых в именах файлов. */
function fileName(title: string): string {
  return title.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'данные'
}

export function ChartBlockFallback({ block, maxRows = 20, className }: ChartBlockFallbackProps) {
  const shown = block.rows.slice(0, Math.max(0, maxRows))
  const download = () => {
    downloadBytes(buildXlsx(blockToRows(block), block.title || 'Данные'), `${fileName(block.title)}.xlsx`, XLSX_MIME)
  }
  return (
    <section className={[styles.block, className].filter(Boolean).join(' ')} aria-label={block.title}>
      <h4 className={styles.title}>{block.title}</h4>
      {block.rows.length === 0 ? (
        <p className={styles.empty}>Нет данных</p>
      ) : (
        <div className={styles.tablewrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {block.columns.map((c, j) => (
                  <th key={j} scope="col" data-num={isNumericColumn(c) || undefined}>
                    {c.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={i}>
                  {block.columns.map((c, j) => {
                    const v = r[j] ?? null
                    return (
                      <td key={j} data-num={isNumericColumn(c) || undefined} data-empty={v == null || undefined}>
                        {v == null ? '—' : formatBlockValue(v, c)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {block.rows.length > 0 && (
        <div className={styles.foot}>
          <button type="button" className={styles.download} onClick={download}>
            <BrainIcon name="table" size={15} />
            Скачать .xlsx
          </button>
          {block.rows.length > shown.length && (
            <span className={styles.more}>
              Показаны первые {shown.length} строк из {block.rows.length}
            </span>
          )}
        </div>
      )}
      <BlockExplain explain={block.explain} />
    </section>
  )
}
