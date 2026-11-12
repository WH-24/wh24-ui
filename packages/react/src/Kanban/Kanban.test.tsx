import { createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Kanban, type KanbanColumn } from './Kanban'

interface Item {
  id: string
  title: string
  col: string
}

const columns: KanbanColumn[] = [
  { id: 'todo', title: 'Ждёт выполнения' },
  { id: 'doing', title: 'Выполняется', tone: 'info' },
  { id: 'done', title: 'Завершена', tone: 'good' },
]

const items: Item[] = [
  { id: '1', title: 'Смета', col: 'todo' },
  { id: '2', title: 'Чертежи', col: 'doing' },
]

function setup(extra: Partial<Parameters<typeof Kanban<Item>>[0]> = {}) {
  const onMove = vi.fn()
  const onOpen = vi.fn()
  render(
    <Kanban<Item>
      columns={columns}
      items={items}
      getId={(i) => i.id}
      getColumn={(i) => i.col}
      getLabel={(i) => i.title}
      renderCard={(i) => <span>{i.title}</span>}
      onMove={onMove}
      onOpen={onOpen}
      {...extra}
    />,
  )
  return { onMove, onOpen }
}

describe('Kanban', () => {
  it('раскладывает карточки по колонкам и считает их', () => {
    setup()
    const todo = screen.getByRole('listitem', { name: 'Ждёт выполнения: 1' })
    expect(within(todo).getByText('Смета')).toBeTruthy()
    expect(screen.getByRole('listitem', { name: 'Завершена: 0' })).toBeTruthy()
    expect(screen.getByText('Пусто')).toBeTruthy()
  })

  it('открывает карточку по клику', async () => {
    const { onOpen } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Смета' }))
    expect(onOpen).toHaveBeenCalledWith(items[0])
  })

  it('переносит без мыши: меню «Переместить в» только с разрешёнными колонками', async () => {
    const { onMove } = setup({ canMove: (_i, to) => to !== 'done' })
    await userEvent.click(screen.getByRole('button', { name: 'Переместить «Смета»' }))
    const menu = screen.getByRole('menu')
    const opts = within(menu).getAllByRole('menuitem').map((b) => b.textContent)
    expect(opts).toEqual(['Выполняется'])
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Выполняется' }))
    expect(onMove).toHaveBeenCalledWith(items[0], 'doing')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('Escape закрывает меню и возвращает фокус на кнопку', async () => {
    setup()
    const btn = screen.getByRole('button', { name: 'Переместить «Смета»' })
    await userEvent.click(btn)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(btn)
  })

  it('перенос мышью: бросок в разрешённую колонку зовёт onMove, в запрещённую — нет', () => {
    const { onMove } = setup({ canMove: (_i, to) => to === 'doing' })
    const card = screen.getByRole('button', { name: 'Смета' }).closest('li')!
    const dt = { setData: vi.fn(), effectAllowed: '', dropEffect: '' }
    fireEvent.dragStart(card, { dataTransfer: dt })
    fireEvent.drop(screen.getByRole('listitem', { name: 'Завершена: 0' }), { dataTransfer: dt })
    expect(onMove).not.toHaveBeenCalled()
    fireEvent.dragStart(card, { dataTransfer: dt })
    fireEvent.drop(screen.getByRole('listitem', { name: 'Выполняется: 1' }), { dataTransfer: dt })
    expect(onMove).toHaveBeenCalledWith(items[0], 'doing')
  })

  it('пока перенос идёт, карточка занята', async () => {
    let resolve!: () => void
    const onMove = vi.fn(() => new Promise<void>((r) => (resolve = r)))
    setup({ onMove })
    await userEvent.click(screen.getByRole('button', { name: 'Переместить «Смета»' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Выполняется' }))
    const card = screen.getByRole('button', { name: 'Смета' }).closest('li')!
    expect(card.getAttribute('aria-busy')).toBe('true')
    resolve()
    await waitFor(() => expect(card.getAttribute('aria-busy')).toBeNull())
  })

  it('без onMove — только чтение: нет меню и переноса', () => {
    setup({ onMove: undefined })
    expect(screen.queryByRole('button', { name: /Переместить/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Смета' }).closest('li')!.getAttribute('draggable')).toBe('false')
  })

  describe('порядок внутри колонки', () => {
    const three: Item[] = [
      { id: 'a', title: 'Первая', col: 'todo' },
      { id: 'b', title: 'Вторая', col: 'todo' },
      { id: 'c', title: 'Третья', col: 'todo' },
    ]

    it('меню «Выше»/«Ниже»: соседи в колонке, у крайних — только своё направление', async () => {
      const onReorder = vi.fn()
      setup({ items: three, onReorder })
      await userEvent.click(screen.getByRole('button', { name: 'Переместить «Вторая»' }))
      const menu = screen.getByRole('menu')
      await userEvent.click(within(menu).getByRole('menuitem', { name: '↑ Выше' }))
      expect(onReorder).toHaveBeenCalledWith(three[1], 'a')
      await userEvent.click(screen.getByRole('button', { name: 'Переместить «Вторая»' }))
      await userEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: '↓ Ниже' }))
      expect(onReorder).toHaveBeenLastCalledWith(three[1], null)
      await userEvent.click(screen.getByRole('button', { name: 'Переместить «Первая»' }))
      expect(within(screen.getByRole('menu')).queryByRole('menuitem', { name: '↑ Выше' })).toBeNull()
    })

    it('мышью: бросок на верхнюю половину карточки — перед ней', () => {
      const onReorder = vi.fn()
      setup({ items: three, onReorder })
      const card = (t: string) => screen.getByRole('button', { name: t }).closest('li')!
      fireEvent.dragStart(card('Третья'), { dataTransfer: { setData: () => {}, effectAllowed: '' } })
      const target = card('Первая')
      target.getBoundingClientRect = () => ({ top: 0, height: 40 }) as DOMRect
      // jsdom не передаёт clientY в DragEvent — ставим вручную.
      const over = createEvent.dragOver(target, { dataTransfer: { dropEffect: '' } })
      Object.defineProperty(over, 'clientY', { value: 5 })
      fireEvent(target, over)
      fireEvent.drop(target.closest('section')!, { dataTransfer: {} })
      expect(onReorder).toHaveBeenCalledWith(three[2], 'a')
    })

    it('без onReorder пунктов порядка нет', async () => {
      setup({ items: three })
      await userEvent.click(screen.getByRole('button', { name: 'Переместить «Вторая»' }))
      expect(within(screen.getByRole('menu')).queryByRole('menuitem', { name: '↑ Выше' })).toBeNull()
    })
  })
})
