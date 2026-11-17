import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ListPage, type ListColumn, type ListRemote } from './ListPage'
import type { FilterBarConfig } from './filter/types'

// Серверный режим (страницы записей форм, 17.11.2026): условия считает сервер,
// список только сообщает их и просит следующую порцию.

interface Row {
  id: string
  name: string
  kind: string
}

const config: FilterBarConfig<Row> = {
  scope: 'remote',
  search: { placeholder: 'Поиск', get: (r) => r.name },
  fields: [
    {
      key: 'kind',
      label: 'Вид',
      type: 'multiselect',
      options: [
        { value: 'it', label: 'ИТ' },
        { value: 'hr', label: 'Кадры' },
      ],
      get: (r) => r.kind,
    },
  ],
}
const columns: ListColumn<Row>[] = [
  { key: 'name', label: 'Название', render: (r) => r.name, sortValue: (r) => r.name },
  { key: 'kind', label: 'Вид', render: (r) => r.kind },
]
const rows: Row[] = [
  { id: '1', name: 'Бета', kind: 'it' },
  { id: '2', name: 'Альфа', kind: 'hr' },
]

let ioCallback: ((entries: { isIntersecting: boolean }[]) => void) | null = null
beforeEach(() => {
  localStorage.clear()
  ioCallback = null
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        ioCallback = cb
      }
      observe() {}
      disconnect() {}
    },
  )
})
afterEach(() => vi.unstubAllGlobals())

function setup(remote: Partial<ListRemote> = {}) {
  const r: ListRemote = { total: 120, hasMore: true, onLoadMore: vi.fn(), onQueryChange: vi.fn(), searchDelay: 0, ...remote }
  render(
    <ListPage<Row>
      title="Записи"
      data={rows}
      getId={(x) => x.id}
      columns={columns}
      filterConfig={config}
      filterVariant="chips"
      defaultSort={{ key: 'name', dir: 'desc' }}
      views={[{ id: 'all', label: 'Все', state: {} }, { id: 'it', label: 'ИТ', state: { kind: ['it'] } }]}
      remote={r}
    />,
  )
  return r
}
const bodyRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)

describe('ListPage — серверный режим', () => {
  it('строки как пришли (без своего поиска и сортировки), первый запрос сразу, счётчик — у выбранного вида', async () => {
    const r = setup()
    await act(async () => {})
    expect(r.onQueryChange).toHaveBeenCalledWith({ filter: {}, sort: { key: 'name', dir: 'desc' } })
    expect(bodyRows().map((x) => x.textContent)).toEqual(['Бетаit', 'Альфаhr'])
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Все120', 'ИТ'])
  })

  it('поиск, вид и сортировка уходят серверу', async () => {
    const r = setup()
    await act(async () => {})
    await userEvent.type(screen.getByPlaceholderText('Поиск'), 'ал')
    await act(async () => {})
    expect(r.onQueryChange).toHaveBeenLastCalledWith({ filter: { q: 'ал' }, sort: { key: 'name', dir: 'desc' } })
    // Строки не отфильтрованы списком: это работа сервера.
    expect(bodyRows()).toHaveLength(2)
    await userEvent.click(screen.getAllByRole('tab')[1]!)
    await act(async () => {})
    expect(vi.mocked(r.onQueryChange).mock.lastCall?.[0].filter).toMatchObject({ kind: ['it'] })
    await userEvent.click(screen.getByRole('button', { name: /Название/ }))
    await act(async () => {})
    expect(vi.mocked(r.onQueryChange).mock.lastCall?.[0].sort).toEqual({ key: 'name', dir: 'asc' })
  })

  it('низ виден — просим следующую порцию; пока грузится или больше нет — не просим', async () => {
    const r = setup()
    act(() => ioCallback?.([{ isIntersecting: true }]))
    expect(r.onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('идёт догрузка — повторно не просим', () => {
    const r = setup({ loadingMore: true })
    act(() => ioCallback?.([{ isIntersecting: true }]))
    expect(r.onLoadMore).not.toHaveBeenCalled()
  })
})
