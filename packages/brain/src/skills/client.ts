/**
 * Клиент навыков: маршруты и формы тел из docs/API.md wh24-brain-api.
 * Строится поверх `request` из `createBrainApi` — те же заголовки и ошибки.
 */
import type { Requester } from '../agents/client.js'
import type { Skill, SkillDraft, SkillList, SkillPatch, SkillScope, SkillSuggestions } from './types.js'

export interface SkillsApi {
  /** Свои навыки (любого статуса) и чужие общие включённые. */
  list(scope?: SkillScope): Promise<SkillList>
  create(body: SkillDraft): Promise<Skill>
  update(id: string, patch: SkillPatch): Promise<Skill>
  remove(id: string): Promise<void>
  /** «Найти в чатах»: модель читает ваши последние вопросы и предлагает до трёх навыков. Ничего не сохраняет. */
  suggest(): Promise<SkillSuggestions>
}

export interface SkillsClient {
  skills: SkillsApi
}

const seg = encodeURIComponent

export function createSkillsClient(request: Requester): SkillsClient {
  return {
    skills: {
      async list(scope) {
        const q = scope && scope !== 'all' ? `?scope=${seg(scope)}` : ''
        const res = await request<Partial<SkillList> | undefined>('GET', `/skills${q}`)
        return { skills: res?.skills ?? [], can_publish: res?.can_publish === true }
      },
      async create(body) {
        return (await request<{ skill: Skill }>('POST', '/skills', body)).skill
      },
      async update(id, patch) {
        return (await request<{ skill: Skill }>('PATCH', `/skills/${seg(id)}`, patch)).skill
      },
      async remove(id) {
        await request<unknown>('DELETE', `/skills/${seg(id)}`)
      },
      async suggest() {
        const res = await request<Partial<SkillSuggestions> | undefined>('POST', '/skills/suggestions', {})
        return {
          suggestions: res?.suggestions ?? [],
          analyzed: res?.analyzed ?? 0,
          ...(res?.reason ? { reason: res.reason } : {}),
        }
      },
    },
  }
}
