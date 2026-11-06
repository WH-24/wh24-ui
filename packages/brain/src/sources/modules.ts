import type { IconName } from '@wowhaus-24/ui-react'

export interface ModuleMeta {
  icon: IconName
  label: string
}

export type ModuleMetaMap = Record<string, Partial<ModuleMeta>>

/** Модули портала: иконка и подпись у карточки источника. Хост может дополнить через `modules`. */
export const DEFAULT_MODULES: Record<string, ModuleMeta> = {
  oup: { icon: 'briefcase', label: 'ОУП' },
  hr: { icon: 'users', label: 'HR' },
  wiki: { icon: 'book', label: 'Вики' },
  tasks: { icon: 'check', label: 'Задачи' },
  forms: { icon: 'list', label: 'Формы' },
  finance: { icon: 'chart', label: 'Финансы' },
  board: { icon: 'board', label: 'Доска' },
  aho: { icon: 'home', label: 'АХО' },
  presentations: { icon: 'presentations', label: 'Презентации' },
  time: { icon: 'timer', label: 'Отчёты времени' },
  notify: { icon: 'bell', label: 'Уведомления' },
  ai: { icon: 'bolt', label: 'ИИ' },
}

const FALLBACK: ModuleMeta = { icon: 'folder', label: '' }

export function moduleMeta(module: string | undefined, extra?: ModuleMetaMap): ModuleMeta {
  if (!module) return FALLBACK
  const base = DEFAULT_MODULES[module]
  const over = extra?.[module]
  return {
    icon: over?.icon ?? base?.icon ?? FALLBACK.icon,
    label: over?.label ?? base?.label ?? module,
  }
}

/** «5 ноя» / «5 ноя 2025» — дата обновления источника. Невалидную дату не показываем. */
export function shortDate(iso: string | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}
