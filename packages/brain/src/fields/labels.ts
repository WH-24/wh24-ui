import type { AiFieldKind, GeneratorKind } from './types.js'

export const AI_FIELD_KINDS: readonly AiFieldKind[] = [
  'summary',
  'progress',
  'translate',
  'action_items',
  'categorize',
  'sentiment',
  'custom',
]

/** Название вида и пояснение в списке выбора. */
export const AI_FIELD_KIND_LABEL: Record<AiFieldKind, { title: string; hint: string }> = {
  summary: { title: 'Краткое содержание', hint: '1–2 предложения о сути записи' },
  progress: { title: 'Ход работ', hint: 'что сделано и что дальше' },
  translate: { title: 'Перевод', hint: 'название и суть на другом языке' },
  action_items: { title: 'Список действий', hint: 'ближайшие шаги по записи' },
  categorize: { title: 'Категория', hint: 'выбор из ваших вариантов' },
  sentiment: { title: 'Тональность', hint: 'позитивная, нейтральная или негативная' },
  custom: { title: 'Свой промпт', hint: 'любое задание для ячейки' },
}

export const SENTIMENT_OPTIONS = ['Позитивная', 'Нейтральная', 'Негативная'] as const

export const LANGUAGES = [
  'английский',
  'немецкий',
  'французский',
  'испанский',
  'итальянский',
  'китайский',
  'турецкий',
  'арабский',
  'польский',
  'чешский',
] as const

export const GENERATOR_LABEL: Record<GeneratorKind, { title: string; action: string; hint: string }> = {
  week_summary: {
    title: 'Итог недели',
    action: 'Составить итог недели',
    hint: 'Над чем вы работали, что сделано и что дальше — по отчётам времени, задачам и записям.',
  },
  standup: {
    title: 'Стендап',
    action: 'Составить стендап',
    hint: 'По каждому человеку: сделано, дальше, блокеры.',
  },
  project_update: {
    title: 'Дайджест проекта',
    action: 'Составить дайджест',
    hint: 'Статус, что произошло, ближайшие шаги и риски — по карточке проекта и её ленте.',
  },
  exec_summary: {
    title: 'Сводка для руководителя',
    action: 'Составить сводку',
    hint: 'Главное по лидам, проектам, срокам и загрузке за период.',
  },
}

/** Лимит людей в стендапе (сервер: 1–20). */
export const MAX_STANDUP_PEOPLE = 20
