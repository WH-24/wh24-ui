import { useCallback, useEffect, useState } from 'react'

import type { SkillsApi } from './client.js'
import type { SlashSkill } from './types.js'

export interface UseSlashSkillsOptions {
  /** `false` — ни одного запроса (нет доступа к модулю ИИ, список не нужен). По умолчанию `true`. */
  enabled?: boolean
}

export interface UseSlashSkillsResult {
  /** Включённые навыки (свои и общие) для меню «/» в `BrainComposer`. */
  skills: SlashSkill[]
  loading: boolean
  /** Перечитать (после создания или правки навыка). */
  reload: () => void
}

/**
 * Навыки для меню «/»: активные (свои и общие чужие) из `api.skills.list()`.
 * Сбой загрузки молча даёт пустой список — композер просто работает без меню.
 */
export function useSlashSkills(api: { skills: Pick<SkillsApi, 'list'> }, opts: UseSlashSkillsOptions = {}): UseSlashSkillsResult {
  const enabled = opts.enabled !== false
  const [skills, setSkills] = useState<SlashSkill[]>([])
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setSkills([])
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    api.skills
      .list()
      .then((res) => {
        if (!alive) return
        const list = res.skills
          .filter((s) => s.status === 'active')
          .map<SlashSkill>((s) => ({ slash: s.slash, name: s.name, ...(s.description ? { description: s.description } : {}) }))
          .sort((a, b) => a.slash.localeCompare(b.slash, 'ru'))
        setSkills(list)
      })
      .catch(() => {
        if (alive) setSkills([])
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [api, enabled, tick])

  const reload = useCallback(() => setTick((n) => n + 1), [])
  return { skills, loading, reload }
}
