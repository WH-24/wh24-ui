/** Человеческие подписи и форматы экрана «Агенты». Сырые коды сервера пользователю не показываем. */
import type { RunStatus } from '../types.js'
import type { AgentStatus, MemoryKind, TriggerKind, WritePolicy } from './types.js'

export const TRIGGER_KIND_LABEL: Record<TriggerKind, string> = {
  manual: 'Вручную',
  schedule: 'По расписанию',
  event: 'По событию',
}

export const AGENT_STATUS_LABEL: Record<AgentStatus, string> = {
  draft: 'Черновик',
  active: 'Включён',
  paused: 'Выключен',
}

/** «В очереди» и «В работе» для человека одно и то же — агент ещё думает. */
export const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  queued: 'В работе',
  running: 'В работе',
  completed: 'Готово',
  skipped: 'Пропущен',
  failed: 'Ошибка',
  cancelled: 'Отменён',
}

export const MEMORY_KIND_LABEL: Record<MemoryKind, string> = {
  preference: 'Предпочтение',
  fact: 'Факт',
  recent: 'Недавнее',
}

export const WRITE_POLICY_LABEL: Record<WritePolicy, { title: string; text: string }> = {
  ask: {
    title: 'Только с подтверждением',
    text: 'Агент готовит запись (создать лид, задачу…) предпросмотром, а выполняет её человек кнопкой «Подтвердить».',
  },
  deny: {
    title: 'Только читать',
    text: 'Инструменты записи агенту не выдаются: он ищет и отвечает, но ничего не меняет в портале.',
  },
}

const SKIP_REASON_TEXT: Record<string, string> = {
  budget: 'Исчерпан дневной бюджет агента',
  delegation_unavailable:
    'Не удалось запустить от имени владельца: у него нет доступа к модулю ИИ или его права не подтвердились',
  no_manage_role: 'Событие обрабатывается только от имени сотрудника с ролью «Управление» в модуле ИИ',
  condition_false: 'Условие запуска не выполнено — запуск не нужен',
  condition_error: 'Не удалось проверить условие запуска, поэтому запуск пропущен',
}

/** Причина пропуска человеческим текстом; незнакомый код — общая фраза, а не сырой код. */
export function skipReasonText(reason: string | undefined | null): string {
  if (!reason) return 'Запуск пропущен'
  return SKIP_REASON_TEXT[reason] ?? 'Запуск пропущен'
}

/** «0,03 $», «< 0,01 $», «—» (стоимости нет или запуск ничего не стоил). */
export function formatCost(usd: number | null | undefined): string {
  if (usd == null || !Number.isFinite(usd) || usd <= 0) return '—'
  if (usd < 0.01) return '< 0,01 $'
  return `${usd.toFixed(2).replace('.', ',')} $`
}

/** «12 с», «1 мин 5 с», «—» (нет времени начала или конца). */
export function formatDuration(from: string | undefined | null, to: string | undefined | null): string {
  if (!from || !to) return '—'
  const ms = new Date(to).getTime() - new Date(from).getTime()
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const s = Math.round(ms / 1000)
  if (s < 1) return '< 1 с'
  if (s < 60) return `${s} с`
  const m = Math.floor(s / 60)
  if (m < 60) return s % 60 ? `${m} мин ${s % 60} с` : `${m} мин`
  const h = Math.floor(m / 60)
  return m % 60 ? `${h} ч ${m % 60} мин` : `${h} ч`
}

/** «6 ноя, 09:30»; год добавляется для чужого года. Невалидное — пустая строка. */
export function formatDateTime(iso: string | undefined | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Число знаков: «1 запуск», «2 запуска», «5 запусков». */
export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return many
  if (b > 1 && b < 5) return few
  if (b === 1) return one
  return many
}
