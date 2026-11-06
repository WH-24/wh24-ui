/**
 * Клиент моделей и админ-ручек индекса. Админ-ручки (`/admin/*`) работают только
 * с ролью `manage`; остальным сервер ответит 403.
 */
import type { Requester } from '../agents/client.js'
import type {
  EmbeddingProvider,
  EmbeddingsCheck,
  EmbeddingsState,
  IndexStatus,
  ModelList,
} from './types.js'

export interface EmbeddingsAdminApi {
  get(): Promise<EmbeddingsState>
  /** Выбор провайдера; недоступный (не настроен в окружении) сервер отклонит 409. */
  put(provider: EmbeddingProvider): Promise<EmbeddingsState>
  /** Переключить поиск на целевую модель вручную. */
  activate(): Promise<EmbeddingsState>
  /** Пробный вектор целевым провайдером без записи в индекс. */
  check(text?: string): Promise<EmbeddingsCheck>
}

export interface IndexAdminApi {
  status(): Promise<IndexStatus>
  /** Проход синхронизации сейчас. */
  sync(): Promise<void>
  /** Сброс курсоров (всех источников или одного): следующий проход перечитает всё. */
  reindex(source?: string): Promise<void>
}

export interface AdminApi {
  /** Модель по умолчанию для «Спросить ИИ» и агентов. */
  setDefaultModel(model: string): Promise<string>
  embeddings: EmbeddingsAdminApi
  index: IndexAdminApi
}

export interface ModelsApi {
  list(): Promise<ModelList>
}

export interface ModelsClient {
  models: ModelsApi
  admin: AdminApi
}

function embeddingsState(res: Partial<EmbeddingsState> | undefined): EmbeddingsState {
  return {
    provider: res?.provider ?? 'local',
    active_model: res?.active_model ?? '',
    target_model: res?.target_model ?? '',
    switching: res?.switching === true,
    available: { local: res?.available?.local === true, relay: res?.available?.relay === true },
    coverage: res?.coverage ?? [],
  }
}

export function createModelsClient(request: Requester): ModelsClient {
  return {
    models: {
      async list() {
        const res = await request<Partial<ModelList> | undefined>('GET', '/models')
        return { models: res?.models ?? [], default_model: res?.default_model ?? '' }
      },
    },
    admin: {
      async setDefaultModel(model) {
        const res = await request<{ default_model?: string } | undefined>('PUT', '/admin/models', { default_model: model })
        return res?.default_model ?? model
      },
      embeddings: {
        async get() {
          return embeddingsState(await request<Partial<EmbeddingsState> | undefined>('GET', '/admin/embeddings'))
        },
        async put(provider) {
          return embeddingsState(await request<Partial<EmbeddingsState> | undefined>('PUT', '/admin/embeddings', { provider }))
        },
        async activate() {
          return embeddingsState(await request<Partial<EmbeddingsState> | undefined>('POST', '/admin/embeddings/activate'))
        },
        check: (text) =>
          request<EmbeddingsCheck>('POST', '/admin/embeddings/check', text ? { text } : {}),
      },
      index: {
        async status() {
          const res = await request<Partial<IndexStatus> | undefined>('GET', '/admin/index/status')
          return { connectors: res?.connectors ?? [], modules: res?.modules ?? [] }
        },
        async sync() {
          await request<unknown>('POST', '/admin/index/sync', {})
        },
        async reindex(source) {
          await request<unknown>('POST', '/admin/index/reindex', source ? { source } : {})
        },
      },
    },
  }
}
