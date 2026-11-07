import { useLayoutEffect, useRef } from 'react'

/**
 * Куда вернуть фокус после того, как элемент списка исчез (удалили запись,
 * убрали условие). Без этого фокус падает в начало страницы: клавиатура и
 * скринридер теряют место. `after(find)` зовут в обработчике ДО смены списка;
 * `find` выполняется уже на новой разметке (когда изменилась длина `count`).
 */
export function useFocusAfterChange(count: number): (find: () => HTMLElement | null | undefined) => void {
  const pending = useRef<(() => HTMLElement | null | undefined) | null>(null)
  useLayoutEffect(() => {
    const find = pending.current
    if (!find) return
    pending.current = null
    find()?.focus()
  }, [count])
  return (find) => {
    pending.current = find
  }
}

/** Первое доступное поле или кнопка внутри блока. */
export function firstFocusable(root: Element | null | undefined): HTMLElement | null {
  return (
    root?.querySelector<HTMLElement>('input:not([disabled]), textarea:not([disabled])') ??
    root?.querySelector<HTMLElement>('button:not([disabled])') ??
    null
  )
}
