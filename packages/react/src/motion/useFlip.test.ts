import { describe, expect, it } from 'vitest'

import { flipMoves } from './useFlip'

const at = (left: number, top: number) => ({ left, top })

describe('flipMoves', () => {
  it('оставшиеся едут из старого места, новые проявляются, стоящие на месте — не трогаются', () => {
    const prev = new Map([
      ['a', at(0, 0)],
      ['b', at(0, 40)],
      ['c', at(0, 80)],
    ])
    const next = new Map([
      ['a', at(0, 0)],
      ['c', at(0, 40)],
      ['d', at(0, 80)],
    ])
    expect(flipMoves(prev, next)).toEqual([
      { id: 'c', dx: 0, dy: 40, enter: false },
      { id: 'd', dx: 0, dy: 0, enter: true },
    ])
  })

  it('сдвиг меньше пикселя — не движение', () => {
    expect(flipMoves(new Map([['a', at(0, 0)]]), new Map([['a', at(0.6, 0.4)]]))).toEqual([])
  })
})
