import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { ApproverPicker } from './ApproverPicker.js'
import { staffIndex } from './logic.js'

const staff = [
  { id: 's1', label: 'Анисимова Анна', hint: 'Бухгалтер' },
  { id: 's2', label: 'Бабошин Борис', hint: 'Юрист' },
]
const departments = [{ id: 'd1', label: 'Бухгалтерия' }]

function Host({ initial = [] as string[] }) {
  const [values, setValues] = useState(initial)
  return (
    <>
      <ApproverPicker staff={staff} departments={departments} values={values} onChange={setValues} ariaLabel="Этап 1" />
      <output data-testid="values">{values.join(',')}</output>
    </>
  )
}

describe('ApproverPicker — согласующие этапа (17.11.2026)', () => {
  it('сотрудник и отдел из справочника с вкладками; выбранные — плашками, убираются крестиком', async () => {
    const user = userEvent.setup()
    render(<Host initial={['s1']} />)
    expect(screen.getByText('Анисимова Анна')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Согласующий/ }))
    // Уже выбранного в списке нет.
    expect(screen.queryByRole('option', { name: /Анисимова/ })).toBeNull()
    await user.click(screen.getByRole('tab', { name: /Отделы/ }))
    await user.click(screen.getByRole('option', { name: /Бухгалтерия/ }))
    expect(screen.getByTestId('values')).toHaveTextContent('s1,dept:d1')
    expect(screen.getByText('Отдел «Бухгалтерия»')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Убрать: Анисимова Анна' }))
    expect(screen.getByTestId('values')).toHaveTextContent('dept:d1')
  })

  it('имя согласующего-отдела в ленте — «отдел «…»»', () => {
    const people = staffIndex(staff, departments)
    expect(people.name('dept:d1')).toBe('отдел «Бухгалтерия»')
    expect(people.name('s2')).toBe('Бабошин Борис')
  })
})
