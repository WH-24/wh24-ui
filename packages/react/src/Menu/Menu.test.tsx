import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { IconButton } from '../IconButton/IconButton'
import { Menu, MenuItem, MenuLabel, MenuSeparator } from './Menu'

function setup(extra: { onEdit?: () => void; onRemove?: () => void } = {}) {
  const onEdit = extra.onEdit ?? vi.fn()
  const onRemove = extra.onRemove ?? vi.fn()
  render(
    <>
      <Menu label="Действия" trigger={<IconButton ariaLabel="Ещё">⋯</IconButton>}>
        <MenuLabel>Запись</MenuLabel>
        <MenuItem onSelect={onEdit} shortcut="E">
          Изменить
        </MenuItem>
        <MenuItem disabled>Архивировать</MenuItem>
        <MenuItem hint="копия">Дублировать</MenuItem>
        <MenuSeparator />
        <MenuItem danger onSelect={onRemove}>
          Удалить
        </MenuItem>
      </Menu>
      <button type="button">Дальше</button>
    </>,
  )
  return { onEdit, onRemove, btn: screen.getByRole('button', { name: 'Ещё' }) }
}

describe('Menu — роли и связь с кнопкой', () => {
  it('кнопка объявляет меню, меню — в портале с role=menu и пунктами menuitem', async () => {
    const { btn } = setup()
    expect(btn).toHaveAttribute('aria-haspopup', 'menu')
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).toBeNull()

    await userEvent.click(btn)
    const menu = screen.getByRole('menu', { name: 'Действия' })
    expect(btn).toHaveAttribute('aria-expanded', 'true')
    expect(btn).toHaveAttribute('aria-controls', menu.id)
    expect(menu.parentElement).toBe(document.body)
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(4)
    expect(within(menu).getByRole('separator')).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'Архивировать' })).toBeDisabled()
  })

  it('выбор пункта зовёт onSelect, закрывает меню и возвращает фокус на кнопку', async () => {
    const { btn, onRemove } = setup()
    await userEvent.click(btn)
    await userEvent.click(screen.getByRole('menuitem', { name: 'Удалить' }))
    expect(onRemove).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(btn).toHaveFocus()
  })

  it('клик мимо закрывает меню', async () => {
    const { btn } = setup()
    await userEvent.click(btn)
    await userEvent.click(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

describe('Menu — клавиатура', () => {
  it('фокус — в первый пункт; ↓/↑ по кругу мимо недоступного, Home/End', async () => {
    const { btn } = setup()
    await userEvent.click(btn)
    const item = (name: string) => screen.getByRole('menuitem', { name: new RegExp(name) })
    expect(item('Изменить')).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(item('Дублировать')).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(item('Удалить')).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(item('Изменить')).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    expect(item('Удалить')).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(item('Изменить')).toHaveFocus()
    await userEvent.keyboard('{End}')
    expect(item('Удалить')).toHaveFocus()
  })

  it('буква ведёт к пункту на эту букву', async () => {
    const { btn } = setup()
    await userEvent.click(btn)
    await userEvent.keyboard('у')
    expect(screen.getByRole('menuitem', { name: 'Удалить' })).toHaveFocus()
    await userEvent.keyboard('д')
    // «уд» — всё ещё «Удалить»: быстрый набор копится в слово.
    expect(screen.getByRole('menuitem', { name: 'Удалить' })).toHaveFocus()
  })

  it('Esc закрывает и возвращает фокус; ↓ на кнопке открывает; Enter выбирает', async () => {
    const { btn, onEdit } = setup()
    await userEvent.click(btn)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(btn).toHaveFocus()

    await userEvent.keyboard('{ArrowDown}')
    // Открыто с клавиатуры — без анимации.
    expect(screen.getByRole('menu')).toHaveAttribute('data-instant')
    await userEvent.keyboard('{Enter}')
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('Tab закрывает меню и ведёт дальше по странице', async () => {
    const { btn } = setup()
    await userEvent.click(btn)
    await userEvent.tab()
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByRole('button', { name: 'Дальше' })).toHaveFocus()
  })
})

describe('Menu — пункты-флажки и управляемое состояние', () => {
  it('checked даёт menuitemcheckbox; keepOpen не закрывает меню', async () => {
    function Cols() {
      const [on, setOn] = useState(true)
      return (
        <Menu label="Колонки" trigger={<button type="button">Колонки</button>}>
          <MenuItem checked={on} keepOpen onSelect={() => setOn((v) => !v)}>
            Сумма
          </MenuItem>
        </Menu>
      )
    }
    render(<Cols />)
    await userEvent.click(screen.getByRole('button', { name: 'Колонки' }))
    const item = screen.getByRole('menuitemcheckbox', { name: 'Сумма' })
    expect(item).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(item)
    expect(screen.getByRole('menuitemcheckbox', { name: 'Сумма' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('open/onOpenChange — состояние ведёт хозяин', async () => {
    const onOpenChange = vi.fn()
    render(
      <Menu label="М" open onOpenChange={onOpenChange} trigger={<button type="button">Открыть</button>}>
        <MenuItem>Пункт</MenuItem>
      </Menu>,
    )
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Пункт' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('свои обработчики кнопки-якоря сохраняются', async () => {
    const onClick = vi.fn()
    render(
      <Menu
        label="М"
        trigger={
          <button type="button" onClick={onClick}>
            Открыть
          </button>
        }
      >
        <MenuItem>Пункт</MenuItem>
      </Menu>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Открыть' }))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })
})
