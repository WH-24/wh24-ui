import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ListPage } from './ListPage'
import type { FilterBarConfig } from './filter/types'

interface Row {
  id: string
  name: string
}

const rows: Row[] = Array.from({ length: 55 }, (_, i) => ({
  id: String(i),
  name: `Проект ${i}`,
}))

const filterConfig: FilterBarConfig<Row> = {
  scope: 'test',
  fields: [{ key: 'name', label: 'Название', type: 'text', get: (r) => r.name }],
}

// Управляемый мок IntersectionObserver: тест сам «показывает» сентинел.
let triggerIntersect: (() => void) | null = null
beforeEach(() => {
  triggerIntersect = null
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      cb: (entries: { isIntersecting: boolean }[]) => void
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        this.cb = cb
        triggerIntersect = () => act(() => this.cb([{ isIntersecting: true }]))
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  )
})
afterEach(() => vi.unstubAllGlobals())

function renderList() {
  return render(
    <ListPage<Row>
      title="Проекты"
      data={rows}
      getId={(r) => r.id}
      columns={[{ key: 'name', label: 'Название', render: (r) => r.name }]}
      filterConfig={filterConfig}
      pageSize={20}
      renderCard={(r) => <div data-testid="card">{r.name}</div>}
    />,
  )
}

describe('ListPage — карточки без пагинации', () => {
  it('в режиме карточек показывает первую порцию и догружает по сентинелу', async () => {
    renderList()
    await userEvent.click(screen.getByTitle('Карточки'))

    // Первая порция = pageSize.
    expect(screen.getAllByTestId('card')).toHaveLength(20)
    // Кнопок постраничной навигации в карточках нет.
    expect(screen.queryByRole('button', { name: /Далее/ })).toBeNull()

    triggerIntersect!()
    expect(screen.getAllByTestId('card')).toHaveLength(40)

    triggerIntersect!()
    // Не больше, чем есть всего.
    expect(screen.getAllByTestId('card')).toHaveLength(55)
  })

  it('в таблице пагинация остаётся', async () => {
    renderList()
    // По умолчанию режим — таблица.
    expect(screen.getByRole('button', { name: /Далее/ })).toBeInTheDocument()
  })
})
