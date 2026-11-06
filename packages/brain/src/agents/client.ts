/**
 * Клиент «Агентов ИИ»: маршруты и формы тел из docs/API.md wh24-brain-api.
 * Строится поверх `request` из `createBrainApi` — те же заголовки, разбор
 * ошибок (`BrainApiError`) и экранирование id.
 *
 * Все методы отдают уже развёрнутые данные (`Agent[]`, а не `{agents: […]}`).
 */
import type {
  Agent,
  AgentCreateBody,
  AgentDraftRequest,
  AgentDraftResult,
  AgentListParams,
  AgentMemoryItem,
  AgentPreset,
  AgentRun,
  AgentRunAccepted,
  AgentRunsParams,
  AgentToolInfo,
  AgentUpdateBody,
} from './types.js'

export type Requester = <T>(method: string, path: string, body?: unknown) => Promise<T>

export interface AgentsApi {
  /** `scope`: `mine` — мои, `shared` — общие; без него — все видимые. */
  list(params?: AgentListParams): Promise<Agent[]>
  get(id: string): Promise<Agent>
  /** Поля агента или `{preset_key, name?}` из каталога. */
  create(body: AgentCreateBody): Promise<Agent>
  update(id: string, patch: AgentUpdateBody): Promise<Agent>
  remove(id: string): Promise<void>
  /** Копия: личная, черновик, расписание выключено. */
  duplicate(id: string): Promise<Agent>
  /** «Запустить сейчас» правами нажавшего → `run_id`; дальше `getAgentRun`/`waitForRun`. */
  run(id: string, body?: { input?: string }): Promise<AgentRunAccepted>
  /** Журнал одного агента. */
  runs(id: string, params?: Omit<AgentRunsParams, 'agent_id'>): Promise<AgentRun[]>
  /** Ваша память этого агента (чужая не видна). */
  memory(id: string): Promise<AgentMemoryItem[]>
  deleteMemory(id: string, memoryId: string): Promise<void>
}

export interface AgentRunsApi {
  /** Журнал запусков: свои и своих агентов; управляющий — все, но без содержимого чужих. */
  list(params?: AgentRunsParams): Promise<AgentRun[]>
}

export interface AgentsClient {
  agents: AgentsApi
  agentRuns: AgentRunsApi
  /** Каталог готовых агентов. */
  agentPresets(): Promise<AgentPreset[]>
  /** Инструменты, доступные вам. */
  agentTools(): Promise<AgentToolInfo[]>
  /** Конструктор диалогом: реплика + правка профиля. Ничего не сохраняет. */
  agentDraft(req: AgentDraftRequest): Promise<AgentDraftResult>
}

const seg = encodeURIComponent

/** `?a=1&b=2` без пустых значений; для пустого набора — пустая строка. */
function query(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export function createAgentsClient(request: Requester): AgentsClient {
  return {
    agents: {
      async list(params = {}) {
        const res = await request<{ agents?: Agent[] }>('GET', `/agents${query({ scope: params.scope })}`)
        return res?.agents ?? []
      },
      async get(id) {
        return (await request<{ agent: Agent }>('GET', `/agents/${seg(id)}`)).agent
      },
      async create(body) {
        return (await request<{ agent: Agent }>('POST', '/agents', body)).agent
      },
      async update(id, patch) {
        return (await request<{ agent: Agent }>('PATCH', `/agents/${seg(id)}`, patch)).agent
      },
      async remove(id) {
        await request<unknown>('DELETE', `/agents/${seg(id)}`)
      },
      async duplicate(id) {
        return (await request<{ agent: Agent }>('POST', `/agents/${seg(id)}/duplicate`, {})).agent
      },
      run: (id, body = {}) => request<AgentRunAccepted>('POST', `/agents/${seg(id)}/run`, body),
      async runs(id, params = {}) {
        const res = await request<{ runs?: AgentRun[] }>(
          'GET',
          `/agents/${seg(id)}/runs${query({ status: params.status, limit: params.limit, before: params.before })}`,
        )
        return res?.runs ?? []
      },
      async memory(id) {
        const res = await request<{ memory?: AgentMemoryItem[] }>('GET', `/agents/${seg(id)}/memory`)
        return res?.memory ?? []
      },
      async deleteMemory(id, memoryId) {
        await request<unknown>('DELETE', `/agents/${seg(id)}/memory/${seg(memoryId)}`)
      },
    },
    agentRuns: {
      async list(params = {}) {
        const res = await request<{ runs?: AgentRun[] }>(
          'GET',
          `/agent-runs${query({
            agent_id: params.agent_id,
            status: params.status,
            limit: params.limit,
            before: params.before,
          })}`,
        )
        return res?.runs ?? []
      },
    },
    async agentPresets() {
      return (await request<{ presets?: AgentPreset[] }>('GET', '/agent-presets'))?.presets ?? []
    },
    async agentTools() {
      return (await request<{ tools?: AgentToolInfo[] }>('GET', '/agent-tools'))?.tools ?? []
    },
    agentDraft: (req) => request<AgentDraftResult>('POST', '/agent-draft', req),
  }
}
