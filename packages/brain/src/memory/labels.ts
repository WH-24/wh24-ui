import type { UserMemoryKind, MemorySource } from './types.js'

export const USER_MEMORY_KIND_LABEL: Record<UserMemoryKind, string> = {
  preference: 'Предпочтение',
  person: 'Человек',
  fact: 'Факт',
}

export const MEMORY_SOURCE_LABEL: Record<MemorySource, string> = {
  manual: 'Вручную',
  ai: 'Запомнил ИИ',
  import: 'Импорт',
}

/** Сколько строк за один импорт принимает сервер. */
export const IMPORT_MAX_LINES = 50

export interface ParsedImport {
  /** Строки, которые станут записями (после очистки маркеров и дублей). */
  lines: string[]
  /** Строк больше, чем можно за раз: лишние не попадут в импорт. */
  overLimit: number
  /** Строки длиннее лимита текста записи — сервер их обрежет или пропустит. */
  tooLong: number
}

const BULLET = /^\s*(?:[-*•·–—]|\d{1,3}[.)])\s+/

/**
 * Что распознает сервер при импорте: строки и маркированные пункты. Здесь та же
 * очистка — чтобы показать человеку «будет добавлено N» до отправки.
 */
export function parseImportText(text: string, maxText: number): ParsedImport {
  const seen = new Set<string>()
  const lines: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(BULLET, '').trim()
    if (!line) continue
    const key = line.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    lines.push(line)
  }
  return {
    lines: lines.slice(0, IMPORT_MAX_LINES),
    overLimit: Math.max(0, lines.length - IMPORT_MAX_LINES),
    tooLong: lines.slice(0, IMPORT_MAX_LINES).filter((l) => l.length > maxText).length,
  }
}

/** «1 строка», «2 строки», «5 строк». */
export function linesLabel(n: number): string {
  const m10 = n % 10
  const m100 = n % 100
  const word = m10 === 1 && m100 !== 11 ? 'строка' : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'строки' : 'строк'
  return `${n} ${word}`
}
