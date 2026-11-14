import { useEffect, useLayoutEffect, useRef, type MutableRefObject, type RefObject } from 'react'

/** Ширина индикатора в CSS, от которой считается `scaleX` (см. `.ind`). */
const BASE_WIDTH = 100

/**
 * Общий «бегунок» под выбранным элементом (подчёркивание вкладок, фон
 * переключателя вида): один элемент переезжает через `transform`, а не
 * перекрашивается на месте.
 *
 * - `scale` — полоса: `translateX` + `scaleX` (ширина не анимируется);
 * - `size` — плашка со скруглением: `translateX`, ширина ставится сразу
 *   (масштаб исказил бы радиус и тень).
 *
 * Пока место не измерено (нет раскладки: скрытый контейнер, тестовый DOM),
 * контейнер остаётся без `data-indicator`, и CSS рисует выбранный элемент
 * по-старому — на нём самом. Первая постановка и смена с клавиатуры
 * (`instant.current`) — без перехода (`data-instant`).
 */
export function useSlideIndicator(
  containerRef: RefObject<HTMLElement | null>,
  indicatorRef: RefObject<HTMLElement | null>,
  activeSelector: string,
  mode: 'scale' | 'size',
  instant: MutableRefObject<boolean>,
  /** Число элементов: при смене заново подписываемся на их размеры. */
  count: number,
): void {
  const placed = useRef(false)
  const place = useRef<(now: boolean) => void>(() => {})
  place.current = (now) => {
    const container = containerRef.current
    const ind = indicatorRef.current
    if (!container || !ind) return
    const el = container.querySelector<HTMLElement>(activeSelector)
    const width = el?.offsetWidth ?? 0
    if (!el || width === 0) {
      container.removeAttribute('data-indicator')
      placed.current = false
      return
    }
    if (now || !placed.current) ind.setAttribute('data-instant', '')
    else ind.removeAttribute('data-instant')
    if (mode === 'scale') {
      ind.style.transform = `translateX(${el.offsetLeft}px) scaleX(${width / BASE_WIDTH})`
    } else {
      ind.style.width = `${width}px`
      ind.style.transform = `translateX(${el.offsetLeft}px)`
    }
    container.setAttribute('data-indicator', '')
    placed.current = true
  }

  // После каждой отрисовки: сменился выбор, подпись или счётчик.
  useLayoutEffect(() => {
    place.current(instant.current)
    instant.current = false
  })

  // Размеры меняются и без отрисовки (догрузился шрифт, контейнер показали).
  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => place.current(true))
    ro.observe(container)
    Array.from(container.children).forEach((c) => ro.observe(c))
    return () => ro.disconnect()
  }, [containerRef, count])
}
