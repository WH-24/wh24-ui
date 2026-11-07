import { describe, expect, it } from 'vitest'

import { BrainApiError, createBrainApi } from '../api'
import { mockFetch } from '../testing'
import type { Skill } from './types'

const skill: Skill = {
  id: 's1',
  name: 'Дайджест',
  slash: 'дайджест',
  description: '',
  instructions: 'Собери сводку.',
  status: 'active',
  visibility: 'private',
  owner_user_id: 'u1',
  uses: 0,
  can: { edit: true },
}

describe('skills client', () => {
  it('list: без scope — без параметра; развёртывает {skills, can_publish}', async () => {
    const { fn, calls } = mockFetch(() => ({ status: 200, body: { skills: [skill], can_publish: true } }))
    const api = createBrainApi({ base: '/b', fetch: fn })
    const res = await api.skills.list()
    expect(calls[0]!.url).toBe('/b/skills')
    expect(res.skills).toEqual([skill])
    expect(res.can_publish).toBe(true)
    await api.skills.list('mine')
    expect(calls[1]!.url).toBe('/b/skills?scope=mine')
  })

  it('list: пустой ответ даёт пустой список и can_publish=false', async () => {
    const { fn } = mockFetch(() => ({ status: 200, body: {} }))
    expect(await createBrainApi({ base: '/b', fetch: fn }).skills.list()).toEqual({ skills: [], can_publish: false })
  })

  it('create / update / remove: маршруты, тела и развёртка {skill}', async () => {
    const { fn, calls } = mockFetch((_u, init) => ({
      status: init.method === 'DELETE' ? 204 : 200,
      body: init.method === 'DELETE' ? undefined : { skill },
    }))
    const api = createBrainApi({ base: '/b', fetch: fn })
    const draft = { name: 'Дайджест', slash: 'дайджест', instructions: 'Собери сводку.' }
    expect(await api.skills.create(draft)).toEqual(skill)
    expect(calls[0]!.init.method).toBe('POST')
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual(draft)
    await api.skills.update('s/1', { status: 'archived' })
    expect(calls[1]!.url).toBe('/b/skills/s%2F1')
    expect(calls[1]!.init.method).toBe('PATCH')
    expect(JSON.parse(String(calls[1]!.init.body))).toEqual({ status: 'archived' })
    await api.skills.remove('s1')
    expect(calls[2]!.init.method).toBe('DELETE')
  })

  it('suggest: POST /skills/suggestions, дефолты и reason', async () => {
    const { fn, calls } = mockFetch(() => ({
      status: 200,
      body: { suggestions: [{ name: 'А', slash: 'а1', description: '', instructions: 'x', evidence: ['e'] }], analyzed: 12 },
    }))
    const api = createBrainApi({ base: '/b', fetch: fn })
    const res = await api.skills.suggest()
    expect(calls[0]!.url).toBe('/b/skills/suggestions')
    expect(calls[0]!.init.method).toBe('POST')
    expect(res.suggestions).toHaveLength(1)
    expect(res.analyzed).toBe(12)
    expect(res.reason).toBeUndefined()

    const { fn: fn2 } = mockFetch(() => ({ status: 200, body: { suggestions: [], analyzed: 2, reason: 'Мало вопросов' } }))
    expect(await createBrainApi({ base: '/b', fetch: fn2 }).skills.suggest()).toEqual({
      suggestions: [],
      analyzed: 2,
      reason: 'Мало вопросов',
    })
  })

  it('ошибка валидации: BrainApiError с полем и сообщением сервера (409 по slash)', async () => {
    const { fn } = mockFetch(() => ({ status: 409, body: { error: 'Команда /дайджест уже занята.', code: 'conflict', field: 'slash' } }))
    const api = createBrainApi({ base: '/b', fetch: fn })
    const err = await api.skills.create({ name: 'х', slash: 'дайджест', instructions: 'у' }).catch((e) => e)
    expect(err).toBeInstanceOf(BrainApiError)
    expect(err.status).toBe(409)
    expect(err.field).toBe('slash')
    expect(err.message).toBe('Команда /дайджест уже занята.')
  })
})
