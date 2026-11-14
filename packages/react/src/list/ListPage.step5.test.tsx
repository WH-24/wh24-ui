import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ListPage, type ListColumn, type ListPageProps, type ListSavedView } from './ListPage'
import { FilterBar } from './filter/FilterBar'
import { conditionText } from './filter/FilterChips'
import type { FilterBarConfig, FilterState } from './filter/types'

interface Row {
  id: string
  name: string
  dept: string
  pos: string
  date: string
  remote: boolean
  skills: string[]
}

const DEPTS = [
  { value: 'arch', label: 'Архитектура' },
  { value: 'bim', label: 'BIM' },
]

const rows: Row[] = [
  { id: '1', name: 'Анна', dept: 'arch', pos: 'Архитектор', date: '2026-01-10', remote: true, skills: ['revit'] },
  { id: '2', name: 'Борис', dept: 'bim', pos: 'BIM-менеджер', date: '2026-03-02', remote: false, skills: ['revit', 'cad'] },
  { id: '3', name: 'Вера', dept: 'arch', pos: 'Главный архитектор', date: '2026-05-20', remote: false, skills: [] },
]

const filterConfig: FilterBarConfig<Row> = {
  scope: 'step5',
  search: { placeholder: 'Поиск', get: (r) => r.name },
  fields: [
    { key: 'dept', label: 'Отдел', type: 'select', options: DEPTS, get: (r) => r.dept },
    { key: 'pos', label: 'Должность', type: 'text', get: (r) => r.pos },
    { key: 'date', label: 'Принят', type: 'daterange', get: (r) => r.date },
    { key: 'remote', label: 'Удалённо', type: 'boolean', get: (r) => r.remote },
    {
      key: 'skills',
      label: 'Навыки',
      type: 'multiselect',
      options: [
        { value: 'revit', label: 'Revit' },
        { value: 'cad', label: 'AutoCAD' },
      ],
      get: (r) => r.skills,
    },
  ],
}

const columns: ListColumn<Row>[] = [
  { key: 'name', label: 'Сотрудник', render: (r) => r.name, sortValue: (r) => r.name },
  { key: 'dept', label: 'Отдел', render: (r) => DEPTS.find((d) => d.value === r.dept)?.label ?? r.dept },
  { key: 'pos', label: 'Должность', render: (r) => r.pos },
]

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  )
})
afterEach(() => vi.unstubAllGlobals())

function List(props: Partial<ListPageProps<Row>>) {
  return (
    <ListPage<Row> title="Сотрудники" data={rows} getId={(r) => r.id} columns={columns} filterConfig={filterConfig} {...props} />
  )
}

const bodyRows = () => screen.getAllByRole('row').slice(1)

describe('ListPage: без новых пропсов ничего не меняется', () => {
  it('нет вкладок видов, панели действий, плашек и правимых ячеек', () => {
    const { container } = render(<List selectable />)
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument()
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('Поиск')).toHaveAttribute('aria-haspopup', 'dialog')
    expect(screen.queryByRole('button', { name: 'Фильтр' })).not.toBeInTheDocument()
    expect(container.querySelector('[data-flip-id]')).toBeNull()
    // Ячейки — простой текст, кнопок правки нет.
    expect(within(bodyRows()[0]!).queryAllByRole('button')).toHaveLength(0)
  })
})

describe('ListPage: виды-вкладки', () => {
  const views: ListSavedView[] = [
    { id: 'all', label: 'Все', state: {} },
    { id: 'arch', label: 'Архитекторы', state: { dept: 'arch' } },
  ]

  function Host({ onSave }: { onSave?: (name: string, state: FilterState) => void }) {
    const [list, setList] = useState(views)
    return (
      <List
        views={list}
        filterVariant="chips"
        onSaveView={(name, state) => {
          onSave?.(name, state)
          setList((l) => [...l, { id: `v${l.length}`, label: name, state }])
        }}
      />
    )
  }

  it('вкладки со счётчиками; выбор применяет условия вида; содержимое — панель вкладки', async () => {
    render(<Host />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual(['Все3', 'Архитекторы2'])
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(tabs[1]!)
    expect(bodyRows()).toHaveLength(2)
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
    const panel = screen.getByRole('tabpanel')
    expect(panel).toHaveAttribute('aria-labelledby', tabs[1]!.id)
    expect(tabs[1]).toHaveAttribute('aria-controls', panel.id)
    // Стрелка — следующая вкладка, без мыши.
    tabs[1]!.focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(bodyRows()).toHaveLength(3)
  })

  it('условия разошлись с видом — «Сохранить вид» отдаёт имя и условия, новая вкладка выбрана', async () => {
    const onSave = vi.fn()
    render(<Host onSave={onSave} />)
    expect(screen.queryByRole('button', { name: 'Сохранить вид' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Фильтр' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Отдел' }))
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'BIM' }))
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить вид' }))
    const name = screen.getByRole('textbox', { name: 'Название вида' })
    expect(name).toHaveFocus()
    await userEvent.type(name, 'Только BIM{Enter}')
    expect(onSave).toHaveBeenCalledWith('Только BIM', { dept: 'bim' })
    const fresh = await screen.findByRole('tab', { name: /Только BIM/ })
    await waitFor(() => expect(fresh).toHaveAttribute('aria-selected', 'true'))
    expect(screen.queryByRole('button', { name: 'Сохранить вид' })).not.toBeInTheDocument()
  })
})

describe('Фильтр плашками', () => {
  function Bar({ initial = {} }: { initial?: FilterState }) {
    const [state, setState] = useState<FilterState>(initial)
    const [fields, setFields] = useState<string[]>([])
    return (
      <>
        <FilterBar config={filterConfig} state={state} setState={setState} fields={fields} setFields={setFields} variant="chips" />
        <output data-testid="state">{JSON.stringify(state)}</output>
      </>
    )
  }
  const state = () => JSON.parse(screen.getByTestId('state').textContent ?? '{}') as FilterState

  it('добавление: поле → значение; значение меняется в меню; «×» снимает условие', async () => {
    render(<Bar />)
    await userEvent.click(screen.getByRole('button', { name: 'Фильтр' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Отдел' }))
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Архитектура' }))
    expect(state()).toEqual({ dept: 'arch' })
    const chip = screen.getByRole('button', { name: /Отдел:\s*Архитектура/ })
    await userEvent.click(chip)
    expect(screen.getByRole('menuitemcheckbox', { name: 'Архитектура' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'BIM' }))
    expect(state()).toEqual({ dept: 'bim' })
    await userEvent.click(screen.getByRole('button', { name: 'Снять условие «Отдел»' }))
    expect(state()).toEqual({})
    expect(screen.queryByRole('button', { name: /Отдел:/ })).not.toBeInTheDocument()
  })

  it('с клавиатуры: меню полей и значений, Esc без выбора убирает пустую плашку и возвращает фокус', async () => {
    render(<Bar />)
    const add = screen.getByRole('button', { name: 'Фильтр' })
    add.focus()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('menuitem', { name: 'Отдел' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('menuitemcheckbox', { name: 'Архитектура' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('button', { name: /Отдел:/ })).not.toBeInTheDocument()
    await waitFor(() => expect(add).toHaveFocus())
    expect(state()).toEqual({})
  })

  it('все типы полей: текст, да/нет, мультивыбор, даты — в том же FilterState', async () => {
    render(<Bar initial={{ remote: false, skills: ['revit'], date: { from: '2026-01-01', to: '' } }} />)
    expect(screen.getByRole('button', { name: /Удалённо:\s*Нет/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Принят:\s*с 01\.01\.2026/ })).toBeInTheDocument()
    // Мультивыбор: меню не закрывается, значения копятся.
    await userEvent.click(screen.getByRole('button', { name: /Навыки:\s*Revit/ }))
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'AutoCAD' }))
    expect(state().skills).toEqual(['revit', 'cad'])
    await userEvent.keyboard('{Escape}')
    // Да/нет.
    await userEvent.click(screen.getByRole('button', { name: /Удалённо:/ }))
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Да' }))
    expect(state().remote).toBe(true)
    // Текст: панель с полем, Enter закрывает.
    await userEvent.click(screen.getByRole('button', { name: 'Фильтр' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Должность' }))
    const input = screen.getByRole('textbox', { name: 'Должность' })
    expect(input).toHaveFocus()
    await userEvent.type(input, 'арх{Enter}')
    expect(state().pos).toBe('арх')
    expect(screen.queryByRole('textbox', { name: 'Должность' })).not.toBeInTheDocument()
    // В меню добавления — только поля без условия.
    await userEvent.click(screen.getByRole('button', { name: 'Фильтр' }))
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Отдел'])
  })

  it('conditionText: подписи значений и устойчивость к чужому типу', () => {
    const [dept, , date, , skills] = filterConfig.fields
    expect(conditionText(dept!, 'arch')).toBe('Архитектура')
    expect(conditionText(dept!, 'нет-такого')).toBe('нет-такого')
    expect(conditionText(skills!, 'revit')).toBe('Revit')
    expect(conditionText(date!, { from: '2026-01-01', to: '2026-02-01' })).toBe('01.01.2026 – 01.02.2026')
    expect(conditionText(dept!, null)).toBe('')
  })
})

describe('ListPage: панель массовых действий', () => {
  it('выезжает при выборе, отдаёт ids действию и варианту, снимает выбор', async () => {
    const remove = vi.fn()
    const setDept = vi.fn()
    render(
      <List
        selectable
        bulkActions={[
          { label: 'Изменить отдел', choices: DEPTS, onRun: setDept },
          { label: 'Удалить', tone: 'danger', icon: 'trash', onRun: remove },
        ]}
      />,
    )
    const bar = document.querySelector<HTMLElement>('[role="toolbar"]')!
    expect(bar).toHaveAttribute('aria-label', 'Действия с выбранными')
    expect(bar).toHaveAttribute('inert')
    expect(bar).not.toHaveAttribute('data-open')
    expect(bar).toHaveAttribute('aria-hidden', 'true')
    const boxes = screen.getAllByRole('checkbox', { name: 'Выбрать строку' })
    await userEvent.click(boxes[0]!)
    await userEvent.click(boxes[2]!)
    expect(bar).toHaveAttribute('data-open')
    expect(bar).not.toHaveAttribute('aria-hidden')
    expect(bar).not.toHaveAttribute('inert')
    expect(within(bar).getByRole('status')).toHaveTextContent('Выбрано: 2')
    await userEvent.click(within(bar).getByRole('button', { name: 'Изменить отдел' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'BIM' }))
    expect(setDept).toHaveBeenCalledWith(['1', '3'], 'bim')
    expect(bar).not.toHaveAttribute('data-open')

    await userEvent.click(boxes[1]!)
    await userEvent.click(within(bar).getByRole('button', { name: 'Удалить' }))
    expect(remove).toHaveBeenCalledWith(['2'], undefined)
    await userEvent.click(boxes[1]!)
    await userEvent.click(within(bar).getByRole('button', { name: 'Снять выбор' }))
    expect(bar).not.toHaveAttribute('data-open')
  })

  it('действие-Promise: панель занята; ошибка — выбор остаётся, зовётся onBulkError', async () => {
    let fail!: (e: Error) => void
    const onBulkError = vi.fn()
    render(
      <List
        selectable
        onBulkError={onBulkError}
        bulkActions={[{ label: 'Архив', onRun: () => new Promise<void>((_, rej) => (fail = rej)) }]}
      />,
    )
    await userEvent.click(screen.getAllByRole('checkbox', { name: 'Выбрать строку' })[0]!)
    const bar = screen.getByRole('toolbar')
    await userEvent.click(within(bar).getByRole('button', { name: 'Архив' }))
    expect(within(bar).getByRole('button', { name: 'Архив' })).toBeDisabled()
    await act(async () => fail(new Error('нет связи')))
    expect(onBulkError).toHaveBeenCalledTimes(1)
    expect(bar).toHaveAttribute('data-open')
    expect(within(bar).getByRole('button', { name: 'Архив' })).toBeEnabled()
  })

  it('слот selectionActions работает как раньше', async () => {
    render(<List selectable selectionActions={({ selected }) => <span>слот: {selected.length}</span>} />)
    await userEvent.click(screen.getAllByRole('checkbox', { name: 'Выбрать строку' })[0]!)
    expect(screen.getByText('1 выбрано')).toBeInTheDocument()
    expect(screen.getByText('слот: 1')).toBeInTheDocument()
  })
})

describe('ListPage: правка в ячейке', () => {
  function Host({ commit, onEditError }: { commit: (row: Row, v: string) => void | Promise<void>; onEditError?: () => void }) {
    const [data, setData] = useState(rows)
    const onRowClick = vi.fn()
    const cols: ListColumn<Row>[] = [
      columns[0]!,
      {
        ...columns[1]!,
        edit: { type: 'select', options: DEPTS, getValue: (r) => r.dept, onCommit: commit },
      },
      {
        ...columns[2]!,
        edit: {
          type: 'text',
          getValue: (r) => r.pos,
          onCommit: async (row, v) => {
            await commit(row, v)
            setData((d) => d.map((x) => (x.id === row.id ? { ...x, pos: v } : x)))
          },
        },
      },
    ]
    return (
      <>
        <List data={data} columns={cols} onRowClick={onRowClick} onEditError={onEditError} />
        <button onClick={() => expect(onRowClick).not.toHaveBeenCalled()}>проверить</button>
      </>
    )
  }

  it('текст: щелчок открывает поле, Enter сохраняет, Esc отменяет; строка не открывается', async () => {
    const commit = vi.fn()
    render(<Host commit={commit} />)
    const cell = within(bodyRows()[0]!).getByRole('button', { name: /Должность:\s*Архитектор/ })
    await userEvent.click(cell)
    const input = screen.getByRole('textbox', { name: 'Должность' })
    expect(input).toHaveFocus()
    expect(input).toHaveValue('Архитектор')
    await userEvent.clear(input)
    await userEvent.type(input, 'Ведущий архитектор{Enter}')
    expect(commit).toHaveBeenCalledWith(rows[0], 'Ведущий архитектор')
    expect(await within(bodyRows()[0]!).findByRole('button', { name: /Ведущий архитектор/ })).toBeInTheDocument()
    // Esc — без сохранения.
    await userEvent.click(within(bodyRows()[1]!).getByRole('button', { name: /Должность:/ }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Должность' }), 'xxx{Escape}')
    expect(commit).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'проверить' }))
  })

  it('с клавиатуры: F2 начинает правку, после Enter фокус возвращается в ячейку', async () => {
    const commit = vi.fn()
    render(<Host commit={commit} />)
    const cell = within(bodyRows()[2]!).getByRole('button', { name: /Должность:/ })
    cell.focus()
    await userEvent.keyboard('{F2}')
    const input = screen.getByRole('textbox', { name: 'Должность' })
    await userEvent.type(input, ' проекта{Enter}')
    expect(commit).toHaveBeenCalledWith(rows[2], 'Главный архитектор проекта')
    await waitFor(() =>
      expect(within(bodyRows()[2]!).getByRole('button', { name: /Должность:/ })).toHaveFocus(),
    )
  })

  it('список: меню значений с отметкой текущего; пока сохраняется — ячейка занята; ошибка откатывает', async () => {
    let fail!: (e: Error) => void
    const onEditError = vi.fn()
    const commit = vi.fn(() => new Promise<void>((_, rej) => (fail = rej)))
    render(<Host commit={commit} onEditError={onEditError} />)
    const cell = within(bodyRows()[0]!).getByRole('button', { name: /Отдел:\s*Архитектура/ })
    await userEvent.click(cell)
    expect(screen.getByRole('menuitemcheckbox', { name: 'Архитектура' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'BIM' }))
    expect(commit).toHaveBeenCalledWith(rows[0], 'bim')
    const busy = within(bodyRows()[0]!).getByRole('button', { name: /Отдел:\s*BIM/ })
    expect(busy).toHaveAttribute('aria-busy', 'true')
    await act(async () => fail(new Error('нет прав')))
    expect(onEditError).toHaveBeenCalledWith(expect.any(Error), { row: rows[0], columnKey: 'dept', value: 'bim' })
    expect(within(bodyRows()[0]!).getByRole('button', { name: /Отдел:\s*Архитектура/ })).not.toHaveAttribute('aria-busy')
  })
})
