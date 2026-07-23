import { render, screen, act, waitFor } from '@testing-library/react'
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

// Мок IntersectionObserver. triggerIntersect — ручное «показать сентинел».
// autoFire=true — сентинел всегда в кадре: observe() сам зовёт колбэк (как в
// коротком списке, который целиком помещается на экран).
let triggerIntersect: (() => void) | null = null
let autoFire = false
beforeEach(() => {
  localStorage.clear()
  triggerIntersect = null
  autoFire = false
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      cb: (entries: { isIntersecting: boolean }[]) => void
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        this.cb = cb
        triggerIntersect = () => act(() => this.cb([{ isIntersecting: true }]))
      }
      observe() {
        // Реальный observer зовёт колбэк асинхронно — синхронный act во время
        // commit'а React ломает. Откладываем в микротаску, тест ждёт waitFor.
        if (autoFire) queueMicrotask(() => this.cb([{ isIntersecting: true }]))
      }
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

  it('пока сентинел в кадре — догружает всё, а не застревает на второй порции', async () => {
    // Регрессия: observer срабатывает только на СМЕНУ видимости. После первой
    // подгрузки сентинел оставался виден и повторно не триггерил — показ вставал
    // на 40 (20 + 20). Теперь observer пересоздаётся и догружает до конца.
    autoFire = true
    renderList()
    await userEvent.click(screen.getByTitle('Карточки'))
    await waitFor(() => expect(screen.getAllByTestId('card')).toHaveLength(55))
  })

  it('defaultView="cards" открывает список сразу карточками', () => {
    render(
      <ListPage<Row>
        title="Проекты"
        data={rows}
        getId={(r) => r.id}
        columns={[{ key: 'name', label: 'Название', render: (r) => r.name }]}
        filterConfig={filterConfig}
        pageSize={20}
        renderCard={(r) => <div data-testid="card">{r.name}</div>}
        defaultView="cards"
      />,
    )
    expect(screen.getAllByTestId('card').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /Далее/ })).toBeNull()
  })
})
