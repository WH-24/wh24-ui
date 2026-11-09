import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { SegmentedControl } from './SegmentedControl'
import { TabPanel, Tabs } from './Tabs'

function Harness() {
  const [v, setV] = useState<'routes' | 'progress' | 'rules'>('routes')
  return (
    <>
      <Tabs
        ariaLabel="Ознакомление"
        idPrefix="ob"
        value={v}
        onChange={setV}
        tabs={[
          { id: 'routes', label: 'Маршруты', count: 0 },
          { id: 'progress', label: 'Прогресс' },
          { id: 'rules', label: 'Правила' },
        ]}
      />
      <TabPanel idPrefix="ob" id={v}>
        панель {v}
      </TabPanel>
    </>
  )
}

describe('Tabs', () => {
  it('стрелки, Home/End переключают; в обходе Tab — только активная', async () => {
    render(<Harness />)
    const first = screen.getByRole('tab', { name: 'Маршруты 0' })
    expect(first).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Прогресс' })).toHaveAttribute('tabindex', '-1')
    first.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Прогресс' })).toHaveFocus()
    expect(screen.getByRole('tabpanel', { name: 'Прогресс' })).toHaveTextContent('панель progress')
    await userEvent.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Правила' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Маршруты 0' })).toHaveFocus()
  })
})

describe('SegmentedControl', () => {
  it('выбранный — aria-pressed, клик меняет значение', async () => {
    const onChange = vi.fn()
    render(
      <SegmentedControl
        ariaLabel="Вид"
        value="list"
        onChange={onChange}
        options={[
          { value: 'list', label: 'Список', icon: 'list' },
          { value: 'cards', label: 'Карточки', icon: 'cards' },
        ]}
      />,
    )
    expect(screen.getByRole('button', { name: 'Список' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Карточки' }))
    expect(onChange).toHaveBeenCalledWith('cards')
  })
})
