// «Худшие данные»: логика, которая раньше ломалась на несовпавшем значении,
// дате со временем, вопросе без подписи кнопки и справочнике на тысячи строк.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { DateField } from './form/DateField'
import { FieldGrid, FieldRow } from './form/Field'
import { MultiCombobox } from './form/MultiCombobox'
import { limitOptions, moreOptionsText, OPTION_LIMIT } from './list/popover'
import { ConfirmProvider, useConfirm } from './overlay/Confirm'
import { Tabs } from './tabs/Tabs'

function Ask({ tone }: { tone?: 'primary' | 'danger' }) {
  const confirm = useConfirm()
  return <button onClick={() => void confirm({ message: 'Отправить отчёт?', tone })}>Спросить</button>
}

describe('Confirm: подпись кнопки по тону', () => {
  it('обычный вопрос без confirmLabel — «Подтвердить», а не «Удалить»', async () => {
    render(
      <ConfirmProvider>
        <Ask tone="primary" />
      </ConfirmProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Спросить' }))
    expect(screen.getByRole('button', { name: 'Подтвердить' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Удалить' })).toBeNull()
  })

  it('разрушительный вопрос (по умолчанию) — «Удалить»', async () => {
    render(
      <ConfirmProvider>
        <Ask />
      </ConfirmProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Спросить' }))
    expect(screen.getByRole('button', { name: 'Удалить' })).toBeInTheDocument()
  })
})

describe('DateField: значение со временем', () => {
  it('ISO с временем показывается датой, а не пустым полем', () => {
    render(<DateField value="2026-11-14T00:00:00Z" onChange={() => {}} ariaLabel="Срок" />)
    expect(screen.getByLabelText('Срок')).toHaveValue('14.11.2026')
  })

  it('выбранный день в календаре отмечен', async () => {
    render(<DateField value="2026-11-14T09:30:00+03:00" onChange={() => {}} ariaLabel="Срок" />)
    await userEvent.click(screen.getByRole('button', { name: /календарь/i }))
    const pressed = screen.getAllByRole('button', { pressed: true })
    expect(pressed).toHaveLength(1)
    expect(pressed[0]).toHaveTextContent('14')
  })

  it('обычная дата и мусор — как раньше', () => {
    const { rerender } = render(<DateField value="2026-03-05" onChange={() => {}} ariaLabel="Срок" />)
    expect(screen.getByLabelText('Срок')).toHaveValue('05.03.2026')
    rerender(<DateField value="завтра" onChange={() => {}} ariaLabel="Срок" />)
    expect(screen.getByLabelText('Срок')).toHaveValue('')
  })
})

describe('Tabs: value не совпал ни с одной вкладкой', () => {
  const tabs = [
    { id: 'a', label: 'Общее' },
    { id: 'b', label: 'Файлы' },
  ]

  it('первая вкладка достижима с клавиатуры', () => {
    render(<Tabs tabs={tabs} value="нет-такой" onChange={() => {}} ariaLabel="Разделы" />)
    const all = screen.getAllByRole('tab')
    expect(all[0]).toHaveAttribute('tabindex', '0')
    expect(all[1]).toHaveAttribute('tabindex', '-1')
  })

  it('value совпал — в обходе только выбранная', () => {
    render(<Tabs tabs={tabs} value="b" onChange={() => {}} ariaLabel="Разделы" />)
    const all = screen.getAllByRole('tab')
    expect(all[0]).toHaveAttribute('tabindex', '-1')
    expect(all[1]).toHaveAttribute('tabindex', '0')
  })
})

describe('Списки выбора: предел вариантов', () => {
  it('limitOptions режет до предела и считает остаток', () => {
    const all = Array.from({ length: 5000 }, (_, i) => i)
    const { shown, rest } = limitOptions(all)
    expect(shown).toHaveLength(OPTION_LIMIT)
    expect(rest).toBe(5000 - OPTION_LIMIT)
    expect(moreOptionsText(shown.length, rest)).toBe('Показаны первые 200 из 5000 — уточните запрос')
  })

  it('короткий список не трогает', () => {
    const all = [1, 2, 3]
    const { shown, rest } = limitOptions(all)
    expect(shown).toBe(all)
    expect(rest).toBe(0)
  })

  it('MultiCombobox: 5000 вариантов — 200 строк и подсказка; поиск находит остальное', async () => {
    const many = Array.from({ length: 5000 }, (_, i) => ({ value: `t${i}`, label: `Тег ${i}` }))
    render(<MultiCombobox options={many} values={[]} onChange={() => {}} placeholder="Теги" />)
    const input = screen.getByRole('combobox')
    await userEvent.click(input)
    expect(screen.getAllByRole('option')).toHaveLength(200)
    expect(screen.getByText('Показаны первые 200 из 5000 — уточните запрос')).toBeInTheDocument()
    await userEvent.type(input, '4999')
    expect(screen.getAllByRole('option')).toHaveLength(1)
  })

  it('MultiCombobox: подпись чипа — отдельный элемент с полным текстом в подсказке', () => {
    const long = 'customer-feedback-from-enterprise-onboarding'
    render(<MultiCombobox options={[{ value: 'x', label: long }]} values={['x']} onChange={() => {}} />)
    expect(screen.getByText(long)).toHaveAttribute('title', long)
  })
})

describe('FieldGrid', () => {
  it('сетка стоит в обёртке-контейнере; className и style — на самой сетке', () => {
    const { container } = render(
      <FieldGrid className="my-grid" style={{ rowGap: 4 }}>
        <FieldRow label="Поле">
          <input />
        </FieldRow>
      </FieldGrid>,
    )
    const grid = container.querySelector('.my-grid') as HTMLElement
    expect(grid).not.toBeNull()
    expect(grid.style.rowGap).toBe('4px')
    expect(grid.parentElement).toBe(container.firstElementChild)
    expect(grid.querySelector('[data-span="6"]')).not.toBeNull()
  })
})
