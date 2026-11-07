import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useSlashSkills } from './useSlashSkills'
import type { Skill } from './types'

const sk = (over: Partial<Skill>): Skill => ({
  id: 'x',
  name: 'Н',
  slash: 'ню',
  description: '',
  instructions: 'и',
  status: 'active',
  visibility: 'private',
  owner_user_id: 'u',
  uses: 0,
  can: { edit: true },
  ...over,
})

describe('useSlashSkills', () => {
  it('грузит активные (свои и общие), сортирует по команде, описание — только если есть', async () => {
    const list = vi.fn().mockResolvedValue({
      skills: [
        sk({ id: '1', slash: 'стендап', name: 'Стендап' }),
        sk({ id: '2', slash: 'архив', status: 'archived' }),
        sk({ id: '3', slash: 'дайджест', name: 'Дайджест', description: 'Сводка', visibility: 'public', can: { edit: false } }),
        sk({ id: '4', slash: 'черновик', status: 'draft' }),
      ],
      can_publish: false,
    })
    const api = { skills: { list } }
    const { result } = renderHook(() => useSlashSkills(api))
    await waitFor(() => expect(result.current.skills).toHaveLength(2))
    expect(result.current.skills).toEqual([
      { slash: 'дайджест', name: 'Дайджест', description: 'Сводка' },
      { slash: 'стендап', name: 'Стендап' },
    ])
    expect(result.current.loading).toBe(false)
  })

  it('enabled=false — запросов нет, список пуст', async () => {
    const list = vi.fn()
    const api = { skills: { list } }
    const { result } = renderHook(() => useSlashSkills(api, { enabled: false }))
    await act(async () => {})
    expect(list).not.toHaveBeenCalled()
    expect(result.current.skills).toEqual([])
  })

  it('сбой загрузки — пустой список без исключения; reload перечитывает', async () => {
    const list = vi
      .fn()
      .mockRejectedValueOnce(new Error('сеть'))
      .mockResolvedValueOnce({ skills: [sk({ slash: 'один' })], can_publish: false })
    const api = { skills: { list } }
    const { result } = renderHook(() => useSlashSkills(api))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.skills).toEqual([])
    act(() => result.current.reload())
    await waitFor(() => expect(result.current.skills).toHaveLength(1))
    expect(list).toHaveBeenCalledTimes(2)
  })
})
