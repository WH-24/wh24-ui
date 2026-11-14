import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { RecordCard, type Stage } from './RecordCard'

const right = {
  label: 'Поля',
  tabs: [
    { id: 'fields', label: 'Поля' },
    { id: 'team', label: 'Команда', count: 3 },
  ],
  render: (tab: string) => <div>вкладка {tab}</div>,
}

const stages: Stage[] = [
  { value: 'new', label: 'Новый', group: 'incoming' },
  { value: 'work', label: 'В работе', group: 'work' },
  { value: 'lost', label: 'Дорого', group: 'fail' },
]

describe('RecordCard', () => {
  it('шапка, путь, показатели, Pyrus, меню «⋯»; вкладки правой колонки переключаются', async () => {
    const user = userEvent.setup()
    const back = vi.fn()
    const remove = vi.fn()
    render(
      <RecordCard
        crumbs={[{ label: 'Лиды', onClick: back }, { label: 'Лид' }]}
        title="Офис на Тверской"
        idLabel="Pyrus 301"
        kpis={[{ label: 'Сумма', value: '1 млн' }]}
        pyrusUrl="https://pyrus.com/t#id301"
        menu={[{ id: 'del', label: 'Удалить', danger: true, onSelect: remove }]}
        left={{
          label: 'Лента',
          bare: true,
          tabs: [{ id: 'feed', label: 'Лента' }],
          render: () => <div>сообщения</div>,
        }}
        right={right}
      />,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Офис на Тверской')
    expect(screen.getByText('Pyrus 301')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Открыть в Pyrus/ })).toHaveAttribute('href', 'https://pyrus.com/t#id301')
    await user.click(screen.getByRole('button', { name: 'Лиды' }))
    expect(back).toHaveBeenCalled()

    expect(screen.getByRole('region', { name: 'Лента' })).toHaveTextContent('сообщения')
    const fields = screen.getByRole('region', { name: 'Поля' })
    expect(within(fields).getByRole('tabpanel')).toHaveTextContent('вкладка fields')
    await user.click(within(fields).getByRole('tab', { name: /Команда/ }))
    expect(within(fields).getByRole('tabpanel')).toHaveTextContent('вкладка team')

    await user.click(screen.getByRole('button', { name: 'Ещё действия' }))
    await user.click(screen.getByRole('menuitem', { name: 'Удалить' }))
    expect(remove).toHaveBeenCalledTimes(1)
  })

  it('без ленты — одна колонка и нет вкладок телефона; без aiMenu нет кнопки «Спросить ИИ»', () => {
    render(<RecordCard crumbs={[{ label: 'Запись' }]} title="Запись" right={right} />)
    expect(screen.queryByRole('tablist', { name: 'Разделы карточки' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Спросить ИИ' })).toBeNull()
  })

  it('aiMenu — кнопка «Спросить ИИ» с пунктами хоста', async () => {
    const user = userEvent.setup()
    const ask = vi.fn()
    render(
      <RecordCard
        crumbs={[{ label: 'Лид' }]}
        title="Лид"
        aiMenu={[{ id: 'a', label: 'Кратко о лиде', onSelect: ask }]}
        right={right}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Спросить ИИ' }))
    await user.click(screen.getByRole('menuitem', { name: 'Кратко о лиде' }))
    expect(ask).toHaveBeenCalledTimes(1)
  })

  it('стадии: без failMenu отказ — обычный сегмент; с failMenu — сегмент «Отказ» с причинами хоста', async () => {
    const user = userEvent.setup()
    const onStage = vi.fn()
    const { rerender } = render(
      <RecordCard crumbs={[{ label: 'Лид' }]} title="Лид" stages={stages} stage="work" onStage={onStage} right={right} />,
    )
    const strip = screen.getByRole('navigation', { name: 'Стадия' })
    expect(within(strip).getByRole('button', { name: 'В работе' })).toHaveAttribute('aria-current', 'step')
    await user.click(within(strip).getByRole('button', { name: 'Дорого' }))
    expect(onStage).toHaveBeenCalledWith('lost')

    rerender(
      <RecordCard
        crumbs={[{ label: 'Лид' }]}
        title="Лид"
        stages={stages}
        stage="lost"
        onStage={onStage}
        right={right}
        failMenu={({ items, trigger }) => (
          <span>
            {trigger(() => undefined)}
            <ul>
              {items.map((it) => (
                <li key={it.label}>
                  {it.section} · {it.label} · {String(it.checked)}
                </li>
              ))}
            </ul>
          </span>
        )}
      />,
    )
    expect(within(strip).queryByRole('button', { name: 'Дорого' })).toBeNull()
    expect(within(strip).getByRole('button', { name: /Отказ: Дорого/ })).toHaveAttribute('aria-current', 'step')
    expect(within(strip).getByText('Причина отказа · Дорого · true')).toBeInTheDocument()
  })
})
