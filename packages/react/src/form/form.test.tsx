import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'

import { Combobox } from '../list/Combobox'
import { DateField } from './DateField'
import { FieldGrid, FieldRow } from './Field'
import { FileDrop } from './FileDrop'
import { Input } from './Input'
import { MultiCombobox } from './MultiCombobox'
import { Textarea } from './Textarea'

describe('FieldRow / FieldGrid', () => {
  it('ошибка вытесняет подсказку, а не добавляется к ней', () => {
    const { rerender } = render(
      <FieldRow label="Сумма" hint="Без НДС">
        <Input />
      </FieldRow>,
    )
    expect(screen.getByText('Без НДС')).toBeInTheDocument()

    rerender(
      <FieldRow label="Сумма" hint="Без НДС" error="Обязательное поле">
        <Input />
      </FieldRow>,
    )
    expect(screen.getByText('Обязательное поле')).toBeInTheDocument()
    expect(screen.queryByText('Без НДС')).not.toBeInTheDocument()
  })

  it('required рисует звёздочку, label связан с контролом через htmlFor', () => {
    render(
      <FieldRow label="Название" htmlFor="f1" required>
        <Input id="f1" />
      </FieldRow>,
    )
    const label = screen.getByText('Название').closest('label')!
    expect(label).toHaveAttribute('for', 'f1')
    expect(label.textContent).toBe('Название*')
    expect(screen.getByLabelText('Название*')).toBeInstanceOf(HTMLInputElement)
  })

  it('span уходит в data-span; по умолчанию 6', () => {
    const { container } = render(
      <FieldGrid>
        <FieldRow label="a">
          <Input />
        </FieldRow>
        <FieldRow label="b" span={12}>
          <Input />
        </FieldRow>
      </FieldGrid>,
    )
    const rows = container.querySelectorAll('[data-span]')
    expect(rows[0]).toHaveAttribute('data-span', '6')
    expect(rows[1]).toHaveAttribute('data-span', '12')
  })
})

describe('Input / Textarea', () => {
  it('invalid ставит aria-invalid, без него атрибута нет', () => {
    const { rerender } = render(<Input aria-label="x" />)
    expect(screen.getByLabelText('x')).not.toHaveAttribute('aria-invalid')
    rerender(<Input aria-label="x" invalid />)
    expect(screen.getByLabelText('x')).toHaveAttribute('aria-invalid', 'true')
  })

  it('Textarea: invalid и rows пробрасываются', () => {
    render(<Textarea aria-label="t" invalid rows={5} />)
    const ta = screen.getByLabelText('t')
    expect(ta).toHaveAttribute('aria-invalid', 'true')
    expect(ta).toHaveAttribute('rows', '5')
  })
})

const opts = [
  { value: 'a', label: 'Альфа' },
  { value: 'b', label: 'Бета', hint: 'B-01' },
  { value: 'c', label: 'Гамма' },
]

function MultiHarness({ initial = [] as string[] }) {
  const [v, setV] = useState<string[]>(initial)
  return (
    <>
      <MultiCombobox options={opts} values={v} onChange={setV} placeholder="Выбрать" />
      <output data-testid="out">{v.join(',')}</output>
    </>
  )
}

describe('MultiCombobox', () => {
  it('клик по пункту добавляет значение, повторный — убирает, меню не закрывается', async () => {
    const user = userEvent.setup()
    render(<MultiHarness />)
    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByRole('option', { name: /Бета/ }))
    expect(screen.getByTestId('out').textContent).toBe('b')
    // Меню всё ещё открыто — можно выбрать второе без повторного открытия.
    await user.click(screen.getByRole('option', { name: /Альфа/ }))
    expect(screen.getByTestId('out').textContent).toBe('b,a')
    await user.click(screen.getByRole('option', { name: /Бета/ }))
    expect(screen.getByTestId('out').textContent).toBe('a')
  })

  it('крестик на чипе и Backspace на пустом вводе убирают значения', async () => {
    const user = userEvent.setup()
    render(<MultiHarness initial={['a', 'c']} />)
    await user.click(screen.getByRole('button', { name: 'Убрать «Альфа»' }))
    expect(screen.getByTestId('out').textContent).toBe('c')
    await user.click(screen.getByRole('combobox'))
    await user.keyboard('{Backspace}')
    expect(screen.getByTestId('out').textContent).toBe('')
  })

  it('неизвестный id показывается как чип с самим id, а не теряется', () => {
    render(<MultiHarness initial={['zzz']} />)
    expect(screen.getByRole('button', { name: 'Убрать «zzz»' })).toBeInTheDocument()
    expect(screen.getByTestId('out').textContent).toBe('zzz')
  })

  it('поиск фильтрует по label и hint', async () => {
    const user = userEvent.setup()
    render(<MultiHarness />)
    await user.type(screen.getByRole('combobox'), 'b-01')
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(screen.getByRole('option', { name: /Бета/ })).toBeInTheDocument()
  })
})

function DateHarness({ initial = '', min, max }: { initial?: string; min?: string; max?: string }) {
  const [v, setV] = useState(initial)
  return (
    <>
      <DateField value={v} onChange={setV} min={min} max={max} ariaLabel="Дата" />
      <output data-testid="out">{v}</output>
    </>
  )
}

describe('DateField', () => {
  it('ручной ввод цифр маскируется в дд.мм.гггг и коммитит ISO', async () => {
    const user = userEvent.setup()
    render(<DateHarness />)
    const input = screen.getByLabelText('Дата') as HTMLInputElement
    await user.type(input, '15032026')
    expect(input.value).toBe('15.03.2026')
    expect(screen.getByTestId('out').textContent).toBe('2026-03-15')
  })

  it('несуществующая дата не коммитится и на blur откатывается к прежнему значению', async () => {
    const user = userEvent.setup()
    render(<DateHarness initial="2026-01-10" />)
    const input = screen.getByLabelText('Дата') as HTMLInputElement
    await user.clear(input)
    await user.type(input, '31022026')
    expect(input.value).toBe('31.02.2026')
    // Очистка поля дала onChange('') — это ожидаемо; несуществующая дата — нет.
    expect(screen.getByTestId('out').textContent).toBe('')
    await user.tab()
    expect(input.value).toBe('')
  })

  it('дата вне min/max не принимается ни вводом, ни из календаря', async () => {
    const user = userEvent.setup()
    render(<DateHarness min="2026-03-01" max="2026-03-31" />)
    const input = screen.getByLabelText('Дата') as HTMLInputElement
    await user.type(input, '15042026')
    expect(screen.getByTestId('out').textContent).toBe('')
    await user.click(screen.getByRole('button', { name: 'Открыть календарь' }))
    // Календарь открылся на текущем месяце; «Сегодня» вне диапазона — кнопка выключена.
    expect(screen.getByRole('button', { name: 'Сегодня' })).toBeDisabled()
  })

  it('клик по дню в календаре выбирает дату и закрывает поповер', async () => {
    const user = userEvent.setup()
    render(<DateHarness initial="2026-03-10" />)
    await user.click(screen.getByRole('button', { name: 'Открыть календарь' }))
    expect(screen.getByText('Март 2026')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '20' }))
    expect(screen.getByTestId('out').textContent).toBe('2026-03-20')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('переход по месяцам через границу года', async () => {
    const user = userEvent.setup()
    render(<DateHarness initial="2026-01-10" />)
    await user.click(screen.getByRole('button', { name: 'Открыть календарь' }))
    await user.click(screen.getByRole('button', { name: 'Предыдущий месяц' }))
    expect(screen.getByText('Декабрь 2025')).toBeInTheDocument()
  })
})

describe('FileDrop', () => {
  const mkFile = (name: string) => new File(['x'], name, { type: 'text/plain' })

  it('onAdd получает не больше, чем осталось до maxFiles; при заполнении зона исчезает', () => {
    const onAdd = vi.fn()
    const { container, rerender } = render(
      <FileDrop files={[{ id: '1', name: 'a.txt' }]} onAdd={onAdd} maxFiles={2} />,
    )
    const input = container.querySelector('input[type=file]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [mkFile('b.txt'), mkFile('c.txt')] } })
    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onAdd.mock.calls[0]![0].map((f: File) => f.name)).toEqual(['b.txt'])

    rerender(
      <FileDrop
        files={[
          { id: '1', name: 'a.txt' },
          { id: '2', name: 'b.txt' },
        ]}
        onAdd={onAdd}
        maxFiles={2}
      />,
    )
    expect(screen.queryByRole('button', { name: /Перетащите/ })).not.toBeInTheDocument()
  })

  it('без onAdd зоны нет; без onRemove нет крестиков; onOpen по клику на имя без href', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<FileDrop files={[{ id: '1', name: 'a.txt', size: 2048 }]} onOpen={onOpen} />)
    expect(screen.queryByRole('button', { name: /Перетащите/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Открепить/ })).not.toBeInTheDocument()
    expect(screen.getByText('2 КБ')).toBeInTheDocument()
    await user.click(screen.getByText('a.txt'))
    expect(onOpen).toHaveBeenCalledWith({ id: '1', name: 'a.txt', size: 2048 })
  })

  it('onRemove получает элемент; disabled прячет крестики', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    const { rerender } = render(
      <FileDrop files={[{ id: '1', name: 'a.txt' }]} onRemove={onRemove} />,
    )
    await user.click(screen.getByRole('button', { name: 'Открепить «a.txt»' }))
    expect(onRemove).toHaveBeenCalledWith({ id: '1', name: 'a.txt' })
    rerender(<FileDrop files={[{ id: '1', name: 'a.txt' }]} onRemove={onRemove} disabled />)
    expect(screen.queryByRole('button', { name: /Открепить/ })).not.toBeInTheDocument()
  })

  it('href рисуется ссылкой в новой вкладке', () => {
    render(<FileDrop files={[{ id: '1', name: 'a.txt', href: 'https://s3/x' }]} />)
    const a = screen.getByText('a.txt')
    expect(a).toHaveAttribute('href', 'https://s3/x')
    expect(a).toHaveAttribute('target', '_blank')
  })
})

describe('Combobox (общий из list/)', () => {
  const grouped = [
    { value: 'p1', label: 'Проект А', group: 'Проекты' },
    { value: 'p2', label: 'Проект Б', group: 'Проекты' },
    { value: 't1', label: 'Задание В', group: 'Задания' },
  ]

  it('заголовок группы рисуется один раз перед первой опцией группы', async () => {
    const user = userEvent.setup()
    render(<Combobox options={grouped} value="" onChange={() => {}} />)
    await user.click(screen.getByRole('combobox'))
    expect(screen.getAllByText('Проекты')).toHaveLength(1)
    expect(screen.getAllByText('Задания')).toHaveLength(1)
    expect(screen.getAllByRole('option')).toHaveLength(3)
  })

  it('опция сброса есть только при выбранном значении', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <Combobox options={grouped} value="" onChange={() => {}} placeholder="— нет —" />,
    )
    await user.click(screen.getByRole('combobox'))
    expect(screen.queryByRole('option', { name: '— нет —' })).not.toBeInTheDocument()
    rerender(<Combobox options={grouped} value="p1" onChange={() => {}} placeholder="— нет —" />)
    expect(screen.getByRole('option', { name: '— нет —' })).toBeInTheDocument()
  })

  it('searchable=false делает поле только для чтения и не фильтрует', async () => {
    const user = userEvent.setup()
    render(<Combobox options={grouped} value="" onChange={() => {}} searchable={false} />)
    const input = screen.getByRole('combobox') as HTMLInputElement
    expect(input).toHaveAttribute('readonly')
    await user.click(input)
    expect(screen.getAllByRole('option')).toHaveLength(3)
  })

  it('аватар: фото по URL, иначе инициалы из label', async () => {
    const user = userEvent.setup()
    render(
      <Combobox
        options={[
          { value: 'u1', label: 'Иван Петров', avatar: null },
          { value: 'u2', label: 'Анна', avatar: 'https://img/a.png' },
        ]}
        value=""
        onChange={() => {}}
      />,
    )
    await user.click(screen.getByRole('combobox'))
    expect(screen.getByText('ИП')).toBeInTheDocument()
    expect(document.querySelector('img[src="https://img/a.png"]')).not.toBeNull()
  })

  it('invalid ставит aria-invalid на поле', () => {
    render(<Combobox options={grouped} value="" onChange={() => {}} invalid />)
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true')
  })
})
