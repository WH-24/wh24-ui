import { useEffect, useId, type RefObject } from 'react'

/**
 * Ловушка фокуса для модальных диалогов — один приём на все окна.
 *
 * `role="dialog" aria-modal="true"` обещает вспомогательным технологиям,
 * что пока окно открыто, фокус из него не уходит. Оверлей с `onClick`
 * держит только мышь; клавиатуру он не держит вовсе. Без ловушки
 * атрибут врёт, а под окном остаётся живая страница: wh24-wiki-web#174
 * (палитра блоков) и #203 (диалог выхода) — один и тот же дефект,
 * найденный дважды. Поэтому приём здесь, а не в каждом окне заново.
 *
 * Перенесено из вики (`src/shared/ui/useFocusTrap.ts`) в общую библиотеку:
 * им пользуются `Modal`, `Drawer` и подтверждение стандарта.
 *
 * Что делает:
 *   • Tab / Shift+Tab ходят по кругу внутри контейнера;
 *   • Esc зовёт `onEscape` (если он дан);
 *   • при открытии фокус переносится внутрь окна — но только если он
 *     ещё не там (иначе украли бы `autoFocus` у поля внутри диалога);
 *   • при закрытии фокус возвращается на элемент-инициатор;
 *   • Esc, уже обработанный внутри окна (открытый список, календарь,
 *     фильтр звали `preventDefault`), окно не закрывает — закрывается
 *     только верхний слой, а введённое в форму не теряется.
 *
 * 🔴 Про возврат фокуса. Наивное «всегда возвращать инициатору» дерётся
 * с собственной передачей фокуса приложения: палитра блоков закрывается
 * и в том же коммите отдаёт фокус только что вставленному блоку
 * (`pendingFocusId` → `autoFocus`). Такой возврат сломал бы вставку —
 * поймано полным прогоном в #193. Поэтому возвращаем, только если фокус
 * ушёл в никуда: удаление узла диалога из DOM само сбрасывает
 * `document.activeElement` на `<body>`, и это и есть признак, что
 * перехватывать не у кого.
 *
 * 🔴 Про вложенные окна. Диалог поверх диалога (подтверждение над
 * `EditLockedView`, `useConfirm` над админской панелью) — это две живые
 * ловушки сразу, и они бы дрались за Tab. Держим стек: клавиши
 * обрабатывает только верхняя открытая ловушка, нижние молчат.
 */

/** Открытые ловушки в порядке появления; клавиши обрабатывает последняя. */
const openTraps: string[] = []

export interface FocusTrapOptions {
  /**
   * Открыт ли диалог. `false` (и размонтирование) обязаны ловушку
   * снимать: ловушка, которая держит фокус при закрытом окне, — это не
   * работающая ловушка, а сломанная страница.
   */
  open: boolean
  /** Корень диалога — за его пределы фокус не выпускается. */
  containerRef: RefObject<HTMLElement | null>
  /**
   * Реакция на Esc. Не дан — Esc не обрабатывается (окно, которое
   * закрывать нечем: `EditLockedView` держит редактор осознанно).
   *
   * ⚠️ Закрытие модалки — это отмена, а не согласие. Сюда идёт
   * «Отмена»/«Закрыть», но никогда не «Выйти без сохранения».
   */
  onEscape?: () => void
}

/** Интерактивные элементы, минус выключенные и вынутые из обхода. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * Элемент виден и доступен: не внутри `hidden`/`inert`, ни один предок до
 * контейнера не `display: none`, сам не `visibility: hidden`. Иначе
 * скрытая кнопка оказывалась «последней», Tab с настоящей последней не
 * заворачивался и фокус утекал на страницу под окном.
 */
function isReachable(el: HTMLElement, container: HTMLElement): boolean {
  if (el.closest('[hidden], [inert]')) return false
  if (getComputedStyle(el).visibility === 'hidden') return false
  for (let n: HTMLElement | null = el; n && n !== container; n = n.parentElement) {
    if (getComputedStyle(n).display === 'none') return false
  }
  return true
}

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) =>
    isReachable(el, container),
  )
}

/** Сколько окон держат прокрутку страницы; снимаем с последним. */
let scrollLocks = 0
let savedScroll: { overflow: string; paddingRight: string } | null = null

/**
 * Страница под модальным окном не прокручивается: колесо над подложкой
 * уводило список под окном на тысячи пикселей. Счётчик общий — окно над
 * окном не снимает блокировку раньше времени. Ширину исчезнувшей полосы
 * прокрутки возвращаем отступом, чтобы страница не дёргалась вбок.
 */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    const body = document.body
    if (scrollLocks === 0) {
      const gap = window.innerWidth - document.documentElement.clientWidth
      savedScroll = { overflow: body.style.overflow, paddingRight: body.style.paddingRight }
      body.style.overflow = 'hidden'
      if (gap > 0) body.style.paddingRight = `${gap}px`
    }
    scrollLocks++
    return () => {
      scrollLocks--
      if (scrollLocks === 0 && savedScroll) {
        body.style.overflow = savedScroll.overflow
        body.style.paddingRight = savedScroll.paddingRight
        savedScroll = null
      }
    }
  }, [active])
}

export function useFocusTrap({ open, containerRef, onEscape }: FocusTrapOptions): void {
  // Опознавалка ловушки в стеке — стабильная на всю жизнь хука и разная
  // у двух ловушек одного компонента (вложенные окна `EditLockedView`).
  const id = useId()

  // Стек открытых ловушек + запоминание инициатора и возврат фокуса.
  // Зависимость ровно одна — `open`: иначе очистка (а с ней возврат
  // фокуса) срабатывала бы на каждом перерисовывании с новым `onEscape`.
  useEffect(() => {
    if (!open) return
    openTraps.push(id)
    const opener = document.activeElement as HTMLElement | null
    return () => {
      const at = openTraps.lastIndexOf(id)
      if (at >= 0) openTraps.splice(at, 1)
      // Инициатор мог исчезнуть (пункт меню строки) — фокусировать нечего.
      if (!opener || !opener.isConnected) return
      const active = document.activeElement
      // Окно с анимацией выхода ещё в DOM, и фокус может стоять внутри
      // него — это тоже «в никуда»: пользователь окно уже закрыл.
      const inClosing = !!active && !!containerRef.current?.contains(active)
      if (!active || active === document.body || inClosing) opener.focus()
    }
    // containerRef стабилен (useRef) — в зависимостях не нужен.
  }, [open, id])

  // Клавиши. Слушаем на документе: фокус может стоять где угодно, в том
  // числе снаружи (диалог только что открылся) — и первый же Tab обязан
  // затащить его внутрь, а не выпустить дальше по странице.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      // Верхнее окно перекрывает нижние: вложенный диалог забирает
      // клавиши себе целиком.
      if (openTraps[openTraps.length - 1] !== id) return
      if (e.key === 'Escape') {
        // Esc уже съел вложенный слой (список, календарь, фильтр) — окно
        // остаётся открытым, введённое не теряется.
        if (!onEscape || e.defaultPrevented) return
        e.preventDefault()
        onEscape()
        return
      }
      if (e.key !== 'Tab') return
      const container = containerRef.current
      if (!container) return
      const focusable = getFocusableElements(container)
      if (focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      const active = document.activeElement as HTMLElement | null
      const inside = !!active && container.contains(active)
      // Сам контейнер (он держит фокус сразу после открытия) идёт
      // отдельной веткой: `contains` считает его «внутри», но ни первым,
      // ни последним элементом он не является — без этой ветки Shift+Tab
      // с него утекал бы на страницу под окном.
      if (!inside || active === container) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
        return
      }
      if (e.shiftKey ? active === first : active === last) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onEscape, containerRef, id])

  // Перенос фокуса внутрь при открытии. Если он уже внутри — не трогаем:
  // у половины окон внутри есть поле с `autoFocus`, и красть у него
  // фокус значит чинить доступность, ломая ввод.
  useEffect(() => {
    if (!open) return
    const container = containerRef.current
    if (!container) return
    if (container.contains(document.activeElement)) return
    // Фокусируем сам контейнер, а не первую кнопку: первой кнопкой в
    // окне бывает разрушительное действие («Всё равно выйти»), и
    // подставлять его под Enter нельзя. С `tabindex="-1"` контейнер
    // фокусируется программно, но в обход Tab'ом не попадает.
    if (!container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1')
    container.focus()
  }, [open, containerRef])
}
