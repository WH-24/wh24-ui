import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DirectoryPicker } from './DirectoryPicker'

const tabs = [
  {
    key: 'people',
    label: 'Сотрудники',
    items: [
      { id: 'p1', title: 'Анисимова Анна' },
      { id: 'p2', title: 'Бабошин Борис' },
    ],
  },
  {
    key: 'depts',
    label: 'Отделы',
    tree: true,
    items: [
      { id: 'd1', title: 'Проектный отдел' },
      { id: 'd2', title: 'Группа Б', parentId: 'd1' },
    ],
  },
]

describe('DirectoryPicker: клавиатура (аудит 12.11)', () => {
  it('строки не в обходе Tab; вкладки — стрелками, Tab только на активную', async () => {
    const user = userEvent.setup()
    render(<DirectoryPicker tabs={tabs} onSelect={() => {}} autoFocus />)
    for (const o of screen.getAllByRole('option')) expect(o).toHaveAttribute('tabindex', '-1')
    const [t1, t2] = screen.getAllByRole('tab')
    expect(t1).toHaveAttribute('tabindex', '0')
    expect(t2).toHaveAttribute('tabindex', '-1')
    t1!.focus()
    await user.keyboard('{ArrowDown}')
    expect(t2).toHaveFocus()
    expect(t2).toHaveAttribute('aria-selected', 'true')
  })

  it('дерево: → раскрывает отдел, ↓ — подотдел, ← — к родителю, Enter выбирает', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<DirectoryPicker tabs={tabs} defaultTabKey="depts" onSelect={onSelect} autoFocus />)
    expect(screen.queryByText('Группа Б')).toBeNull()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByText('Группа Б')).toBeInTheDocument()
    await user.keyboard('{ArrowDown}{ArrowLeft}{Enter}')
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'd1' }), expect.anything())
  })
})
