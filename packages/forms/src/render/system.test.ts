import { describe, expect, it } from 'vitest'

import { actorLabel } from './system'

describe('actorLabel — автор действия', () => {
  it('пустой UUID — Pyrus; иначе имя из справочника или id', () => {
    expect(actorLabel('00000000-0000-0000-0000-000000000000', () => 'x')).toBe('Pyrus')
    expect(actorLabel('u1', (id) => `Имя ${id}`)).toBe('Имя u1')
    expect(actorLabel('u1')).toBe('u1')
    expect(actorLabel(null)).toBe('—')
  })
})
