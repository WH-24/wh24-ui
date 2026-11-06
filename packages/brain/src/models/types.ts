/**
 * Модели ИИ, провайдер эмбеддингов и состояние индекса — то, что настраивает
 * администратор (роль `manage`). Форма — по docs/API.md wh24-brain-api.
 */

export interface BrainModel {
  id: string
  label: string
}

export interface ModelList {
  models: BrainModel[]
  /** Модель по умолчанию для «Спросить ИИ» и агентов. */
  default_model: string
}

export type EmbeddingProvider = 'local' | 'relay'

export interface EmbeddingCoverage {
  model: string
  embedded: number
  total: number
  pending: number
  failed: number
}

export interface EmbeddingsState {
  provider: EmbeddingProvider
  /** Модель, векторами которой размечен индекс; по ней ищем. */
  active_model: string
  /** Модель, которую считаем для новых фрагментов. */
  target_model: string
  /** Смена провайдера идёт: цель ≠ активная, пока переиндексация не досчитается. */
  switching: boolean
  /** Какие провайдеры настроены в окружении сервиса. */
  available: Record<EmbeddingProvider, boolean>
  coverage: EmbeddingCoverage[]
}

export interface EmbeddingsCheck {
  provider: EmbeddingProvider
  model: string
  dims: number
  ms: number
}

export interface IndexConnector {
  connector: string
  cursor?: string
  last_ok_at?: string | null
  last_error?: string
  backfill_done?: boolean
  docs_total?: number
  last_reconcile_at?: string | null
}

export interface IndexModuleCount {
  module: string
  entity_type: string
  documents: number
  chunks: number
  newest_at?: string | null
}

export interface IndexStatus {
  connectors: IndexConnector[]
  modules: IndexModuleCount[]
}
