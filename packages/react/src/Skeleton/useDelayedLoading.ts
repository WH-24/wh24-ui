import { useEffect, useRef, useState } from 'react'

export interface DelayedLoadingOptions {
  /** Сколько ждать, прежде чем показать заготовку, мс. Быстрый ответ её не покажет вовсе. */
  delay?: number
  /** Сколько заготовка держится, раз уж показалась, мс — чтобы не мелькнула. */
  minVisible?: number
}

/**
 * Когда показывать заготовку (`Skeleton`). Ответ пришёл быстрее `delay` —
 * заготовки не было вовсе; показалась — стоит не меньше `minVisible`, даже
 * если данные пришли сразу следом. Иначе экран дважды мигает: пусто →
 * заготовка на долю секунды → содержимое.
 *
 * ```tsx
 * const showSkeleton = useDelayedLoading(isLoading)
 * return showSkeleton ? <SkeletonRow /> : isLoading ? null : <Row />
 * ```
 */
export function useDelayedLoading(loading: boolean, { delay = 120, minVisible = 380 }: DelayedLoadingOptions = {}): boolean {
  const [visible, setVisible] = useState(false)
  const shownAt = useRef(0)

  useEffect(() => {
    if (loading) {
      if (visible) return
      const t = setTimeout(() => {
        shownAt.current = Date.now()
        setVisible(true)
      }, Math.max(0, delay))
      return () => clearTimeout(t)
    }
    if (!visible) return
    const rest = Math.max(0, minVisible - (Date.now() - shownAt.current))
    const t = setTimeout(() => setVisible(false), rest)
    return () => clearTimeout(t)
  }, [loading, visible, delay, minVisible])

  return visible
}
