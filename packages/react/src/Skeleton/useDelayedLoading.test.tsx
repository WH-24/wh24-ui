import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useDelayedLoading } from './useDelayedLoading'

describe('useDelayedLoading', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })
  const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms))

  it('быстрый ответ заготовку не показывает', () => {
    const { result, rerender } = renderHook(({ loading }) => useDelayedLoading(loading), {
      initialProps: { loading: true },
    })
    expect(result.current).toBe(false)
    tick(100)
    rerender({ loading: false })
    tick(1000)
    expect(result.current).toBe(false)
  })

  it('показалась — держится не меньше minVisible', () => {
    const { result, rerender } = renderHook(({ loading }) => useDelayedLoading(loading), {
      initialProps: { loading: true },
    })
    tick(120)
    expect(result.current).toBe(true)
    tick(50)
    rerender({ loading: false })
    tick(300)
    expect(result.current).toBe(true)
    tick(40)
    expect(result.current).toBe(false)
  })

  it('долгая загрузка: заготовка уходит сразу, как пришли данные', () => {
    const { result, rerender } = renderHook(
      ({ loading }) => useDelayedLoading(loading, { delay: 0, minVisible: 200 }),
      { initialProps: { loading: true } },
    )
    tick(0)
    expect(result.current).toBe(true)
    tick(1000)
    rerender({ loading: false })
    tick(0)
    expect(result.current).toBe(false)
  })
})
