import { createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { Kanban, type KanbanColumn, type KanbanProps } from './Kanban'

interface Item {
  id: string
  title: string
  col: string
  sum: number
}

const columns: KanbanColumn[] = [
  { id: 'todo', title: 'Ждёт выполнения' },
  { id: 'doing', title: 'Выполняется', tone: 'info' },
  { id: 'done', title: 'Завершена', tone: 'good' },
]

const items: Item[] = [
  { id: '1', title: 'Смета', col: 'todo', sum: 100 },
  { id: '2', title: 'Чертежи', col: 'todo', sum: 250 },
  { id: '3', title: 'Макет', col: 'doing', sum: 40 },
]

function Board(extra: Partial<KanbanProps<Item>> = {}) {
  return (
    <Kanban<Item>
      columns={columns}
      items={items}
      getId={(i) => i.id}
      getColumn={(i) => i.col}
      getLabel={(i) => i.title}
      renderCard={(i) => <span>{i.title}</span>}
      {...extra}
    />
  )
}

/** Событие переноса с подставным dataTransfer (в jsdom его нет). */
function drag(type: 'dragStart' | 'dragOver' | 'drop' | 'dragEnd', el: Element, init: { clientY?: number } = {}) {
  const ev = createEvent[type](el, init)
  Object.defineProperty(ev, 'dataTransfer', { value: { setData() {}, effectAllowed: '', dropEffect: '' } })
  if (init.clientY !== undefined) Object.defineProperty(ev, 'clientY', { value: init.clientY })
  fireEvent(el, ev)
}

describe('Kanban: без новых пропсов ничего не меняется', () => {
  it('нет суммы, кнопок сворачивания, быстрого добавления и ключей переезда', () => {
    const { container } = render(<Board onMove={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Свернуть колонку/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Добавить' })).not.toBeInTheDocument()
    expect(container.querySelector('[data-flip-id]')).toBeNull()
    expect(container.querySelector('[data-kanban-col]')).toBeNull()
  })
})

describe('Kanban: сумма колонки', () => {
  it('columnSummary получает колонку и её карточки', () => {
    render(<Board columnSummary={(_, list) => `${list.reduce((a, i) => a + i.sum, 0)} ₽`} />)
    expect(within(screen.getByRole('listitem', { name: 'Ждёт выполнения: 2' })).getByText('350 ₽')).toBeInTheDocument()
    expect(within(screen.getByRole('listitem', { name: 'Завершена: 0' })).getByText('0 ₽')).toBeInTheDocument()
  })
})

describe('Kanban: сворачивание колонок', () => {
  it('свернуть и развернуть; фокус переходит на кнопку-замену; onCollapsedChange', async () => {
    const onCollapsedChange = vi.fn()
    render(<Board collapsible onCollapsedChange={onCollapsedChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Свернуть колонку «Ждёт выполнения»' }))
    expect(onCollapsedChange).toHaveBeenLastCalledWith(['todo'])
    const expand = screen.getByRole('button', { name: 'Развернуть колонку «Ждёт выполнения»' })
    expect(expand).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => expect(expand).toHaveFocus())
    // Карточки свёрнутой колонки не показаны, счётчик остаётся.
    expect(screen.queryByText('Смета')).not.toBeInTheDocument()
    expect(within(screen.getByRole('listitem', { name: 'Ждёт выполнения: 2' })).getByText('2')).toBeInTheDocument()
    await userEvent.keyboard('{Enter}')
    expect(onCollapsedChange).toHaveBeenLastCalledWith([])
    expect(screen.getByText('Смета')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Свернуть колонку «Ждёт выполнения»' })).toHaveFocus())
  })

  it('управляемо: collapsed задаёт хост; свёрнутая колонка принимает карточку', () => {
    const onMove = vi.fn()
    render(<Board collapsible collapsed={['done']} onMove={onMove} />)
    const done = screen.getByRole('listitem', { name: 'Завершена: 0' })
    expect(within(done).getByRole('button', { name: 'Развернуть колонку «Завершена»' })).toBeInTheDocument()
    const card = screen.getByText('Смета').closest('li')!
    drag('dragStart', card)
    drag('dragOver', done)
    drag('drop', done)
    expect(onMove).toHaveBeenCalledWith(items[0], 'done')
  })
})

describe('Kanban: быстрое добавление', () => {
  it('«Добавить» → поле; Enter добавляет в свою колонку и возвращает кнопку; Esc отменяет', async () => {
    const onQuickAdd = vi.fn()
    render(<Board onQuickAdd={onQuickAdd} />)
    const doing = screen.getByRole('listitem', { name: 'Выполняется: 1' })
    await userEvent.click(within(doing).getByRole('button', { name: 'Добавить' }))
    const input = within(doing).getByRole('textbox', { name: 'Новая карточка в колонке «Выполняется»' })
    expect(input).toHaveFocus()
    await userEvent.type(input, '  Планировки {Enter}')
    expect(onQuickAdd).toHaveBeenCalledTimes(1)
    expect(onQuickAdd).toHaveBeenCalledWith('doing', 'Планировки')
    const again = await within(doing).findByRole('button', { name: 'Добавить' })
    await waitFor(() => expect(again).toHaveFocus())
    await userEvent.keyboard('{Enter}')
    await userEvent.type(within(doing).getByRole('textbox'), 'черновик{Escape}')
    expect(onQuickAdd).toHaveBeenCalledTimes(1)
    expect(within(doing).getByRole('button', { name: 'Добавить' })).toBeInTheDocument()
  })

  it('пустое название не добавляется', async () => {
    const onQuickAdd = vi.fn()
    render(<Board onQuickAdd={onQuickAdd} />)
    await userEvent.click(screen.getAllByRole('button', { name: 'Добавить' })[0]!)
    await userEvent.keyboard('   {Enter}')
    expect(onQuickAdd).not.toHaveBeenCalled()
  })
})

describe('Kanban: место вставки при переносе', () => {
  function Sortable(props: Partial<KanbanProps<Item>>) {
    const [list] = useState(items)
    return <Board items={list} onMove={vi.fn()} {...props} />
  }

  it('dropPlaceholder: в своей колонке — заготовка перед карточкой; onReorder получает то же, что раньше', () => {
    const onReorder = vi.fn()
    const { container } = render(<Sortable dropPlaceholder onReorder={onReorder} />)
    const first = screen.getByText('Смета').closest('li')!
    const second = screen.getByText('Чертежи').closest('li')!
    drag('dragStart', second)
    drag('dragOver', first, { clientY: -5 })
    const ph = container.querySelector('li[aria-hidden="true"]')!
    expect(ph).toBeInTheDocument()
    expect(ph.nextElementSibling).toBe(first)
    drag('drop', first.closest('section')!)
    expect(onReorder).toHaveBeenCalledWith(items[1], '1')
    expect(container.querySelector('li[aria-hidden="true"]')).toBeNull()
  })

  it('dropPlaceholder: в чужой колонке заготовка — в конце, «Пусто» на время скрыто', () => {
    const { container } = render(<Sortable dropPlaceholder />)
    const done = screen.getByRole('listitem', { name: 'Завершена: 0' })
    drag('dragStart', screen.getByText('Смета').closest('li')!)
    drag('dragOver', done)
    expect(done.querySelector('li[aria-hidden="true"]')).toBeInTheDocument()
    expect(within(done).queryByText('Пусто')).not.toBeInTheDocument()
    drag('dragEnd', screen.getByText('Смета').closest('li')!)
    expect(container.querySelector('li[aria-hidden="true"]')).toBeNull()
  })

  it('без dropPlaceholder заготовки нет', () => {
    const { container } = render(<Sortable onReorder={vi.fn()} />)
    drag('dragStart', screen.getByText('Чертежи').closest('li')!)
    drag('dragOver', screen.getByRole('listitem', { name: 'Завершена: 0' }))
    expect(container.querySelector('li[aria-hidden="true"]')).toBeNull()
  })
})
