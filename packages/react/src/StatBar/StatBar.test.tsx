import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StatBar } from './StatBar'

describe('StatBar', () => {
  it('renders one cell per item', () => {
    render(
      <StatBar
        items={[
          { label: 'Сотрудники', value: 42 },
          { label: 'Статьи', value: 318 },
          { label: 'Best practices', value: 9, accent: true },
        ]}
      />,
    )
    expect(screen.getByText('Сотрудники')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('Best practices')).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument()
  })

  it('marks accent items with accent class', () => {
    const { container } = render(
      <StatBar items={[{ label: 'BP', value: 9, accent: true }]} />,
    )
    const dd = container.querySelector('dd')
    expect(dd?.className).toMatch(/accent/)
  })

  it('renders trend text with default tone', () => {
    render(
      <StatBar
        items={[{ label: 'Статей', value: 247, trend: { text: '+12 за месяц' } }]}
      />,
    )
    expect(screen.getByText('+12 за месяц')).toBeInTheDocument()
  })

  it('applies trend tone class', () => {
    const { container } = render(
      <StatBar
        items={[
          { label: 'BP', value: 9, trend: { text: '+1 на этой неделе', tone: 'bp' } },
        ]}
      />,
    )
    const trend = container.querySelector('span')
    expect(trend?.className).toMatch(/bp/)
  })

  it('flat tone renders ink-3 class', () => {
    const { container } = render(
      <StatBar
        items={[{ label: 'Емп', value: 14, trend: { text: 'пишут активно', tone: 'flat' } }]}
      />,
    )
    expect(container.querySelector('span')?.className).toMatch(/flat/)
  })
})
