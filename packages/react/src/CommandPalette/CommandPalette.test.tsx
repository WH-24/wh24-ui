import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { CommandPalette, useCommandPaletteShortcut, type CommandItem } from './CommandPalette'

const run = vi.fn()
const ITEMS: CommandItem[] = [
  { id: 'add', group: 'Действия', label: 'Добавить сотрудника', icon: 'plus', shortcut: 'Ctrl N', onSelect: () => run('add') },
  { id: 'theme', group: 'Действия', label: 'Сменить тему', icon: 'sun', onSelect: () => run('theme') },
  { id: 'emp', group: 'Разделы', label: 'Сотрудники', icon: 'users', onSelect: () => run('emp') },
  { id: 'anna', group: 'Сотрудники', label: 'Анна Соколова', subtitle: 'Главный архитектор', avatar: { name: 'Анна Соколова' }, keywords: 'sokolova' },
]

function Harness({ onClose, ...rest }: Partial<React.ComponentProps<typeof CommandPalette>> & { onClose?: () => void }) {
  const [open, setOpen] = useState(false)
  useCommandPaletteShortcut(() => setOpen(true))
  return (
    <>
      <button onClick={() => setOpen(true)}>Поиск</button>
      <CommandPalette
        open={open}
        items={ITEMS}
        {...rest}
        onClose={() => {
          onClose?.()
          setOpen(false)
        }}
      />
    </>
  )
}

describe('CommandPalette', () => {
  it('закрыта — ничего не рисует; открыта — окно, фокус в поле, группы и пункты', async () => {
    render(<Harness />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Поиск' }))
    const dialog = screen.getByRole('dialog', { name: 'Поиск и команды' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    const input = screen.getByRole('combobox')
    expect(input).toHaveFocus()
    expect(screen.getAllByRole('option')).toHaveLength(4)
    expect(screen.getByRole('group', { name: 'Действия' })).toBeInTheDocument()
    // Первый пункт активен и объявлен полю.
    const first = screen.getByRole('option', { name: /Добавить сотрудника/ })
    expect(first).toHaveAttribute('aria-selected', 'true')
    expect(input).toHaveAttribute('aria-activedescendant', first.id)
    expect(first).toHaveTextContent('Ctrl N')
  })

  it('стрелки ходят по кругу, Enter выполняет и закрывает', async () => {
    run.mockClear()
    const onSelect = vi.fn()
    render(<Harness onSelect={onSelect} />)
    await userEvent.click(screen.getByRole('button', { name: 'Поиск' }))
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('option', { name: /Сменить тему/ })).toHaveAttribute('aria-selected', 'true')
    await userEvent.keyboard('{ArrowUp}{ArrowUp}')
    expect(screen.getByRole('option', { name: /Анна Соколова/ })).toHaveAttribute('aria-selected', 'true')
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(run).toHaveBeenCalledWith('theme')
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'theme' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('встроенный поиск: по подписи, второй подписи и keywords; пусто — «Ничего не найдено»', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Поиск' }))
    await userEvent.keyboard('сотрудник')
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      expect.stringContaining('Добавить сотрудника'),
      expect.stringContaining('Сотрудники'),
    ])
    await userEvent.clear(screen.getByRole('combobox'))
    await userEvent.keyboard('архитектор')
    expect(screen.getAllByRole('option')).toHaveLength(1)
    await userEvent.clear(screen.getByRole('combobox'))
    await userEvent.keyboard('SOKOL')
    expect(screen.getByRole('option', { name: /Анна Соколова/ })).toBeInTheDocument()
    await userEvent.keyboard('zzz')
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
    expect(screen.getByText('Ничего не найдено')).toBeInTheDocument()
  })

  it('с onQueryChange поиск ведёт хозяин: список не фильтруется', async () => {
    const onQueryChange = vi.fn()
    render(<Harness onQueryChange={onQueryChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Поиск' }))
    await userEvent.keyboard('zzz')
    expect(onQueryChange).toHaveBeenLastCalledWith('zzz')
    expect(screen.getAllByRole('option')).toHaveLength(4)
  })

  it('Esc закрывает и возвращает фокус; Tab из окна не выходит', async () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    const opener = screen.getByRole('button', { name: 'Поиск' })
    await userEvent.click(opener)
    await userEvent.tab()
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('щелчок по пункту выполняет его; щелчок по подложке закрывает', async () => {
    run.mockClear()
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Поиск' }))
    await userEvent.click(screen.getByRole('option', { name: /Сотрудники/ }))
    expect(run).toHaveBeenCalledWith('emp')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Поиск' }))
    fireEvent.pointerDown(screen.getByRole('dialog').parentElement!)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('выключенный пункт пропускается стрелками и не выполняется', async () => {
    const onSelect = vi.fn()
    render(
      <Harness
        onSelect={onSelect}
        items={[
          { id: 'a', label: 'Первый', disabled: true },
          { id: 'b', label: 'Второй' },
        ]}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Поиск' }))
    expect(screen.getByRole('option', { name: 'Второй' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(screen.getByRole('option', { name: 'Первый' }))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('Ctrl+K открывает — и в русской раскладке («л»)', () => {
    render(<Harness />)
    fireEvent.keyDown(document, { key: 'л', ctrlKey: true })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'k', metaKey: true })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('без Ctrl буква «k» палитру не открывает', () => {
    render(<Harness />)
    fireEvent.keyDown(document, { key: 'k' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
