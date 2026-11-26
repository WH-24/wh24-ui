import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { Modal } from '../../overlay/Modal'
import { FilterBar } from './FilterBar'
import type { FilterState } from './types'

function Harness() {
  const [state, setState] = useState<FilterState>({})
  const [fields, setFields] = useState<string[]>([])
  const [open, setOpen] = useState(true)
  return (
    <Modal open={open} title="Выбор" onClose={() => setOpen(false)}>
      <FilterBar
        config={{ scope: 'test-esc', fields: [] }}
        state={state}
        setState={setState}
        fields={fields}
        setFields={setFields}
      />
    </Modal>
  )
}

describe('FilterBar: Esc', () => {
  it('закрывает только панель фильтра, фокус — в поле поиска, окно остаётся', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const input = screen.getByPlaceholderText('Фильтр и поиск')
    await user.click(input)
    const dialog = screen.getByRole('dialog', { name: 'Выбор' })
    const before = dialog.querySelectorAll('*').length
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: 'Выбор' })).toBeInTheDocument()
    expect(dialog.querySelectorAll('*').length).toBeLessThan(before)
    expect(input).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

function FieldsHarness() {
  const [state, setState] = useState<FilterState>({})
  const [fields, setFields] = useState<string[]>([])
  return (
    <FilterBar
      config={{
        scope: 'test-add-search',
        fields: [
          { key: 'name', label: 'Название', type: 'text', get: () => '' },
          { key: 'status', label: 'Статус', type: 'text', get: () => '' },
          { key: 'kind', label: 'Вид работ', type: 'text', get: () => '' },
          { key: 'cat', label: 'Подкатегория проекта', type: 'text', get: () => '' },
        ],
      }}
      state={state}
      setState={setState}
      fields={fields}
      setFields={setFields}
    />
  )
}

describe('FilterBar: поиск в «Добавить поле»', () => {
  it('отбирает поля по названию, Esc сначала чистит строку, потом закрывает', async () => {
    const user = userEvent.setup()
    render(<FieldsHarness />)
    await user.click(screen.getByPlaceholderText('Фильтр и поиск'))
    await user.click(screen.getByRole('button', { name: /Добавить поле/ }))
    const search = screen.getByRole('searchbox', { name: 'Найти поле' })
    expect(search).toHaveFocus()
    await user.type(search, 'КАТЕГ')
    expect(screen.getByTitle('Подкатегория проекта')).toBeInTheDocument()
    expect(screen.queryByTitle('Статус')).not.toBeInTheDocument()
    await user.click(screen.getByTitle('Подкатегория проекта'))
    expect(screen.getByTitle('Подкатегория проекта')).toHaveAttribute('aria-pressed', 'true')
    await user.clear(search)
    await user.type(search, 'нет такого')
    expect(screen.getByText('Ничего не найдено')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(search).toHaveValue('')
    expect(screen.getByTitle('Статус')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('searchbox', { name: 'Найти поле' })).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('Фильтр и поиск')).toBeInTheDocument()
  })
})
