/**
 * «Одна реализация на элемент»: места, переведённые на общие компоненты,
 * по-прежнему рисуются и работают.
 */
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { DirectoryPicker } from './DirectoryPicker/DirectoryPicker'
import { Combobox } from './list/Combobox'
import { FieldEditor } from './list/filter/FieldEditor'
import { FilterBar } from './list/filter/FilterBar'
import type { FilterBarConfig, FilterState, FilterValue } from './list/filter/types'
import { Drawer } from './overlay/Drawer'
import { RecordTabs, RecordTabPanel } from './record/RecordTabs'

describe('фильтр: общие поля вместо своих', () => {
  it('диапазон дат — два DateField, нативного input[type=date] нет', async () => {
    const onChange = vi.fn()
    const { container } = render(<FieldEditor type="daterange" value={null} onChange={onChange} />)
    expect(container.querySelector('input[type="date"]')).toBeNull()
    const from = screen.getByRole('textbox', { name: 'С' })
    expect(screen.getByRole('textbox', { name: 'По' })).toBeInTheDocument()
    await userEvent.type(from, '01.11.2026')
    fireEvent.blur(from)
    expect(onChange).toHaveBeenLastCalledWith({ from: '2026-11-01', to: '' })
  })

  it('мультивыбор — общий MultiCombobox: выбор отдаёт массив, пустой — null', async () => {
    function Host() {
      const [v, setV] = useState<FilterValue>(null)
      return (
        <>
          <FieldEditor
            type="multiselect"
            value={v}
            onChange={setV}
            options={[
              { value: 'a', label: 'Анна' },
              { value: 'b', label: 'Борис' },
            ]}
          />
          <output>{JSON.stringify(v)}</output>
        </>
      )
    }
    render(<Host />)
    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.click(screen.getByRole('option', { name: 'Борис' }))
    expect(screen.getByRole('status')).toHaveTextContent('["b"]')
    await userEvent.click(screen.getByRole('button', { name: 'Убрать «Борис»' }))
    expect(screen.getByRole('status')).toHaveTextContent('null')
  })

  it('применённое условие — общий Chip с «сбросить»', async () => {
    const config: FilterBarConfig<{ name: string }> = {
      scope: 'one-impl-chip',
      fields: [{ key: 'name', label: 'Имя', type: 'text', get: (r) => r.name }],
    }
    function Host() {
      const [state, setState] = useState<FilterState>({ name: 'Анна' })
      const [fields, setFields] = useState<string[]>(['name'])
      return <FilterBar config={config} state={state} setState={setState} fields={fields} setFields={setFields} />
    }
    render(<Host />)
    const reset = screen.getByRole('button', { name: /Сбросить условие/ })
    await userEvent.click(reset)
    expect(screen.queryByRole('button', { name: /Сбросить условие/ })).toBeNull()
  })
})

describe('аватар — один на библиотеку', () => {
  it('Combobox: у варианта без фото — инициалы из подписи', async () => {
    render(
      <Combobox
        value=""
        onChange={() => {}}
        options={[{ value: '1', label: 'Анна Соколова', avatar: null }]}
        inputAriaLabel="Сотрудник"
      />,
    )
    await userEvent.click(screen.getByRole('combobox', { name: 'Сотрудник' }))
    const option = screen.getByRole('option', { name: 'Анна Соколова' })
    expect(within(option).getByText('АС')).toBeInTheDocument()
  })

  it('DirectoryPicker: строка без своего аватара — инициалы из названия', async () => {
    render(
      <DirectoryPicker
        tabs={[{ key: 'p', label: 'Люди', items: [{ id: '1', title: 'Пётр Иванов' }] }]}
        onSelect={() => {}}
      />,
    )
    await userEvent.click(screen.getByRole('combobox'))
    expect(screen.getByText('ПИ')).toBeInTheDocument()
  })
})

describe('вкладки записи — общий Tabs', () => {
  it('роли, стрелки и перенос строк вместо прокрутки', async () => {
    function Host() {
      const [tab, setTab] = useState('a')
      return (
        <>
          <RecordTabs
            tabs={[
              { id: 'a', label: 'Поля' },
              { id: 'b', label: 'Команда', count: 3 },
            ]}
            value={tab}
            onChange={setTab}
            ariaLabel="Разделы"
            idPrefix="rec"
          />
          <RecordTabPanel idPrefix="rec" id={tab}>
            панель {tab}
          </RecordTabPanel>
        </>
      )
    }
    render(<Host />)
    const list = screen.getByRole('tablist', { name: 'Разделы' })
    expect(list).toHaveAttribute('data-wrap')
    screen.getByRole('tab', { name: 'Поля' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: /Команда/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('панель b')
  })
})

describe('окна — общие части', () => {
  it('Drawer: действия шапки и «Закрыть» на общем IconButton', async () => {
    const onClose = vi.fn()
    render(
      <Drawer open onClose={onClose} title="Карточка" actions={<button type="button">Изменить</button>}>
        тело
      </Drawer>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Карточка' })
    expect(within(dialog).getByRole('button', { name: 'Изменить' })).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Закрыть' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
