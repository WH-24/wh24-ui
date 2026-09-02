import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ListPage, needsPxWidths } from './ListPage'
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

  it('колонке названия (primary) достаётся минимум 350px, остальным — 150px', () => {
    // Минимум колонки видно в min-width таблицы: это сумма минимумов видимых
    // колонок плюс служебная колонка с шестерёнкой (44). Регрессия: без primary
    // название получало общие 150px и обрезалось многоточием, хотя соседние
    // колонки стояли свободно.
    render(
      <ListPage<Row>
        title="Проекты"
        data={rows}
        getId={(r) => r.id}
        columns={[
          { key: 'name', label: 'Название', primary: true, render: (r) => r.name },
          { key: 'city', label: 'Город', render: () => 'Москва' },
        ]}
        filterConfig={filterConfig}
        pageSize={20}
        renderCard={(r) => <div data-testid="card">{r.name}</div>}
      />,
    )
    // 350 (название) + 150 (город) + 44 (шестерёнка).
    expect(screen.getByRole('table')).toHaveStyle({ minWidth: '544px' })
  })

  it('явный minWidth сильнее primary', () => {
    render(
      <ListPage<Row>
        title="Проекты"
        data={rows}
        getId={(r) => r.id}
        columns={[
          { key: 'name', label: 'Название', primary: true, minWidth: 200, render: (r) => r.name },
        ]}
        filterConfig={filterConfig}
        pageSize={20}
        renderCard={(r) => <div data-testid="card">{r.name}</div>}
      />,
    )
    expect(screen.getByRole('table')).toHaveStyle({ minWidth: '244px' })
  })

  // Переход «проценты → px» проверяем на функции, а не на DOM: в jsdom ширина
  // контейнера всегда 0, и ResizeObserver'а нет — режим просто не включится.
  it('на узком контейнере уходит в px, чтобы название не сжалось процентом', () => {
    const name = { key: 'name', label: 'Название', width: '34%', primary: true, render: () => null }
    const city = { key: 'city', label: 'Город', width: '20%', render: () => null }
    const cols = [name, city]
    // 34% от 990 — это ~337px, меньше минимума названия (350).
    expect(needsPxWidths(cols, 990, 544)).toBe(true)
    // 34% от 1400 — 476px, минимум перекрыт, проценты остаются.
    expect(needsPxWidths(cols, 1400, 544)).toBe(false)
    // Сумма минимумов не влезает — прежнее условие продолжает работать.
    expect(needsPxWidths(cols, 400, 544)).toBe(true)
    // Ширина контейнера ещё не измерена — режим не включаем.
    expect(needsPxWidths(cols, 0, 544)).toBe(false)
    // Колонка без primary процентом не проверяется.
    expect(needsPxWidths([city], 990, 194)).toBe(false)
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

describe('ListPage — доска', () => {
  const renderBoard = (props: { defaultView?: 'list' | 'cards' | 'board' } = {}) =>
    render(
      <ListPage<Row>
        title="Проекты"
        data={rows.slice(0, 3)}
        getId={(r) => r.id}
        columns={[{ key: 'name', label: 'Название', render: (r) => r.name }]}
        filterConfig={filterConfig}
        pageSize={20}
        renderBoard={(list) => <div data-testid="board">доска: {list.length}</div>}
        {...props}
      />,
    )

  it('доска получает ВСЕ отфильтрованные строки, а не страницу', async () => {
    renderBoard({ defaultView: 'board' })
    expect(await screen.findByTestId('board')).toHaveTextContent('доска: 3')
    // Таблицы в этом режиме нет — иначе строки показывались бы дважды.
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('переключатель появляется даже без карточек', async () => {
    renderBoard()
    expect(screen.getByRole('table')).toBeTruthy()
    await userEvent.click(screen.getByTitle('Доска'))
    expect(await screen.findByTestId('board')).toBeTruthy()
  })

  it('вид, исчезнувший у списка на ходу, откатывается к таблице', async () => {
    // Доску потребитель может отдавать не всегда (права, ещё не загруженная
    // схема). Без отката экран остался бы пустым: режим 'board' есть, рисовать
    // его нечем.
    const view = (withBoard: boolean) => (
      <ListPage<Row>
        title="Проекты"
        data={rows.slice(0, 3)}
        getId={(r) => r.id}
        columns={[{ key: 'name', label: 'Название', render: (r) => r.name }]}
        filterConfig={filterConfig}
        renderBoard={withBoard ? (list) => <div data-testid="board">доска: {list.length}</div> : undefined}
      />
    )
    const { rerender } = render(view(true))
    await userEvent.click(screen.getByTitle('Доска'))
    expect(screen.getByTestId('board')).toBeTruthy()

    rerender(view(false))
    await waitFor(() => expect(screen.getByRole('table')).toBeTruthy())
    expect(screen.queryByTestId('board')).toBeNull()
  })
})
