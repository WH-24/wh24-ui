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
