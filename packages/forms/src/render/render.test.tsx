import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'

import type { Field, RecordData, SchemaDocument } from '../types'
import { FormRenderer, errorsByField, visibleFields } from './FormRenderer'
import { formatDate, formatMoney, formatValue, plural } from './format'
import { fieldRegistry } from './registry'
import { FIELD_TYPES } from '../types'

const f = (over: Partial<Field> & Pick<Field, 'id' | 'type'>): Field => ({
  key: over.id,
  label: over.id,
  section_id: 's1',
  span: 6,
  required: false,
  show_in_list: false,
  filterable: false,
  archived: false,
  ...over,
})

const doc = (
  fields: Field[],
  sections = [{ id: 's1', title: 'Основное', sort: 0 }],
): SchemaDocument => ({
  schema_version: 1,
  title_field: fields[0]?.id ?? '',
  sections,
  fields,
})

function Harness({
  d,
  initial = {},
  mode = 'edit' as const,
  ...rest
}: {
  d: SchemaDocument
  initial?: RecordData
  mode?: 'edit' | 'view'
  newFieldIds?: string[]
}) {
  const [v, setV] = useState<RecordData>(initial)
  return (
    <>
      <FormRenderer
        doc={d}
        values={v}
        mode={mode}
        onChange={(id, val) => setV((p) => ({ ...p, [id]: val }))}
        {...rest}
      />
      <output data-testid="out">{JSON.stringify(v)}</output>
    </>
  )
}

const out = () => JSON.parse(screen.getByTestId('out').textContent || '{}') as RecordData

describe('fieldRegistry', () => {
  it('link во view: http(s) — ссылкой, остальное — текстом', () => {
    const d = doc([f({ id: 'l', type: 'link', label: 'Сайт' })])
    const { rerender } = render(
      <FormRenderer doc={d} values={{ l: 'https://ok.example' }} mode="view" />,
    )
    expect(screen.getByRole('link', { name: 'https://ok.example' })).toHaveAttribute(
      'href',
      'https://ok.example',
    )
    rerender(<FormRenderer doc={d} values={{ l: 'javascript:alert(1)' }} mode="view" />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('javascript:alert(1)')).toBeInTheDocument()
  })

  it('покрывает все типы поля из контракта', () => {
    for (const t of FIELD_TYPES) {
      expect(fieldRegistry[t], t).toBeDefined()
      expect(fieldRegistry[t].Edit, t).toBeTypeOf('function')
      expect(fieldRegistry[t].View, t).toBeTypeOf('function')
    }
  })
})

describe('FormRenderer — структура', () => {
  it('секции в порядке sort, пустая секция не рисуется', () => {
    const d = doc(
      [
        f({ id: 'a', type: 'text', section_id: 'b' }),
        f({ id: 'c', type: 'text', section_id: 'a' }),
      ],
      [
        { id: 'a', title: 'Вторая', sort: 2 },
        { id: 'b', title: 'Первая', sort: 1 },
        { id: 'z', title: 'Пустая', sort: 0 },
      ],
    )
    render(<Harness d={d} />)
    const heads = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(heads).toEqual(['Первая', 'Вторая'])
    expect(screen.queryByText('Пустая')).not.toBeInTheDocument()
  })

  it('label связан с контролом, звёздочка только в edit, ошибка вытесняет подсказку', () => {
    const d = doc([
      f({ id: 'a', type: 'text', label: 'Название', required: true, hint: 'Коротко' }),
    ])
    const { rerender } = render(<Harness d={d} />)
    expect(screen.getByLabelText('Название*')).toBeInstanceOf(HTMLInputElement)
    expect(screen.getByText('Коротко')).toBeInTheDocument()

    rerender(
      <FormRenderer
        doc={d}
        values={{}}
        mode="edit"
        errors={[
          {
            field_id: 'a',
            code: 'required',
            message: 'поле «Название» обязательно для заполнения',
          },
        ]}
      />,
    )
    expect(screen.getByText('поле «Название» обязательно для заполнения')).toBeInTheDocument()
    expect(screen.queryByText('Коротко')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Название*')).toHaveAttribute('aria-invalid', 'true')

    rerender(<FormRenderer doc={d} values={{ a: 'x' }} mode="view" />)
    expect(screen.queryByText('Название*')).not.toBeInTheDocument()
    expect(screen.getByText('Название')).toBeInTheDocument()
  })

  it('условное поле появляется и исчезает вживую; скрытое не рендерится вовсе', async () => {
    const user = userEvent.setup()
    const d = doc([
      f({ id: 'over', type: 'checkbox', label: 'Превышение' }),
      f({
        id: 'reason',
        type: 'text',
        label: 'Причина',
        visible_if: { all: [{ field: 'over', op: 'eq', value: true }] },
      }),
    ])
    render(<Harness d={d} />)
    expect(screen.queryByLabelText('Причина')).not.toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: /Превышение/ }))
    expect(screen.getByLabelText('Причина')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: /Превышение/ }))
    expect(screen.queryByLabelText('Причина')).not.toBeInTheDocument()
  })

  it('архивные поля: только со значением, свёрнуто, только чтение', () => {
    const d = doc([
      f({ id: 'a', type: 'text', label: 'Живое' }),
      f({ id: 'old', type: 'text', label: 'Старое', archived: true }),
      f({ id: 'old2', type: 'text', label: 'Пустое старое', archived: true }),
    ])
    render(<Harness d={d} initial={{ old: 'значение' }} />)
    const details = screen.getByText('Архивные поля · 1').closest('details')!
    expect(details).not.toHaveAttribute('open')
    expect(within(details).getByText('значение')).toBeInTheDocument()
    expect(within(details).queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByText('Пустое старое')).not.toBeInTheDocument()
  })

  it('бейдж НОВОЕ у полей, появившихся после версии записи', () => {
    const d = doc([f({ id: 'a', type: 'text', label: 'Период' })])
    render(<Harness d={d} newFieldIds={['a']} />)
    expect(screen.getByText('НОВОЕ')).toBeInTheDocument()
  })

  it('section и note — презентация на всю ширину, без label и контрола', () => {
    const d = doc([
      f({ id: 'h', type: 'section', label: 'Подзаголовок' }),
      f({ id: 'n', type: 'note', label: 'n', hint: 'Пояснение к блоку' }),
      f({ id: 'a', type: 'text', label: 'Поле' }),
    ])
    render(<Harness d={d} />)
    expect(screen.getByText('Подзаголовок')).toBeInTheDocument()
    expect(screen.getByText('Пояснение к блоку')).toBeInTheDocument()
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
  })
})

describe('FormRenderer — контролы пишут значения нужного типа', () => {
  it('number/money: число, пусто → undefined, мусор остаётся текстом', async () => {
    const user = userEvent.setup()
    const d = doc([
      f({ id: 'n', type: 'number', label: 'Число' }),
      f({ id: 'm', type: 'money', label: 'Сумма', config: { currency: 'RUB' } }),
    ])
    render(<Harness d={d} />)
    await user.type(screen.getByLabelText('Число'), '12,5')
    expect(out().n).toBe(12.5)
    await user.type(screen.getByLabelText('Сумма'), '3200000')
    expect(out().m).toBe(3200000)
    expect(screen.getByText('₽')).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Число'))
    expect(out()).not.toHaveProperty('n')
    await user.type(screen.getByLabelText('Число'), 'abc')
    expect(out().n).toBe('abc')
  })

  it('checkbox: boolean; select: значение из вариантов; multiselect: массив', async () => {
    const user = userEvent.setup()
    const d = doc([
      f({ id: 'c', type: 'checkbox', label: 'Флаг' }),
      f({
        id: 's',
        type: 'select',
        label: 'Стадия',
        config: { options: [{ value: 'rd', label: 'РД' }] },
      }),
      f({
        id: 'm',
        type: 'multiselect',
        label: 'Разделы',
        config: {
          options: [
            { value: 'ar', label: 'АР' },
            { value: 'kr', label: 'КР' },
          ],
        },
      }),
    ])
    render(<Harness d={d} />)
    await user.click(screen.getByRole('checkbox', { name: /Флаг/ }))
    expect(out().c).toBe(true)
    await user.click(screen.getByLabelText('Стадия'))
    await user.click(screen.getByRole('option', { name: 'РД' }))
    expect(out().s).toBe('rd')
    await user.click(screen.getByLabelText('Разделы'))
    await user.click(screen.getByRole('option', { name: /КР/ }))
    expect(out().m).toEqual(['kr'])
  })

  it('date: ISO; datetime: RFC 3339 с локальной зоной', async () => {
    const user = userEvent.setup()
    const d = doc([
      f({ id: 'd', type: 'date', label: 'Дата' }),
      f({ id: 'dt', type: 'datetime', label: 'Когда' }),
    ])
    render(<Harness d={d} />)
    await user.type(screen.getByLabelText('Дата'), '15032026')
    expect(out().d).toBe('2026-03-15')
    await user.type(screen.getByLabelText('Когда'), '15032026')
    // Дата выбрана → время предзаполнено 00:00; пользователь его правит.
    expect(out().dt).toMatch(/^2026-03-15T00:00:00/)
    await user.clear(screen.getByLabelText('Время'))
    await user.type(screen.getByLabelText('Время'), '1030')
    expect(out().dt).toMatch(/^2026-03-15T10:30:00[+-]\d{2}:\d{2}$/)
  })

  it('user: варианты из ctx.staff, значение — id; view показывает подпись и инициалы', async () => {
    const user = userEvent.setup()
    const d = doc([f({ id: 'u', type: 'user', label: 'Ответственный' })])
    const ctx = { staff: [{ id: 'u1', label: 'Иван Петров', hint: 'ГИП' }] }
    const { rerender } = render(
      <FormRenderer doc={d} values={{}} mode="edit" ctx={ctx} onChange={vi.fn()} />,
    )
    await user.click(screen.getByLabelText('Ответственный'))
    expect(screen.getByRole('option', { name: /Иван Петров/ })).toBeInTheDocument()
    rerender(<FormRenderer doc={d} values={{ u: 'u1' }} mode="view" ctx={ctx} />)
    expect(screen.getByText('Иван Петров')).toBeInTheDocument()
    expect(screen.getByText('ИП')).toBeInTheDocument()
    // Без справочника — id, а не пустота.
    rerender(<FormRenderer doc={d} values={{ u: 'u1' }} mode="view" />)
    expect(screen.getByText('u1')).toBeInTheDocument()
  })

  it('table: добавление строки, ввод ячейки, Σ по деньгам, лимит строк, удаление последней → undefined', async () => {
    const user = userEvent.setup()
    const d = doc([
      f({
        id: 't',
        type: 'table',
        label: 'Смета',
        config: {
          max_rows: 2,
          currency: 'RUB',
          columns: [
            { id: 'c1', key: 'name', label: 'Раздел', type: 'text' },
            { id: 'c2', key: 'sum', label: 'Сумма', type: 'money' },
          ],
        },
      }),
    ])
    render(<Harness d={d} />)
    await user.click(screen.getByRole('button', { name: '+ Строка' }))
    await user.click(screen.getByRole('button', { name: '+ Строка' }))
    expect(screen.getByRole('button', { name: '+ Строка' })).toBeDisabled()
    const sums = screen.getAllByRole('textbox', { name: 'Сумма' })
    await user.type(sums[0]!, '3200000')
    // Дробь набирается: «12,» не превращается в 12 на полпути.
    await user.type(sums[1]!, '5400000,5')
    expect(out().t).toEqual([{ c2: 3200000 }, { c2: 5400000.5 }])
    expect((sums[1] as HTMLInputElement).value).toBe('5400000,5')
    await user.clear(sums[1]!)
    await user.type(sums[1]!, '5400000')
    expect(screen.getByText('8 600 000 ₽')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Удалить строку 2' }))
    await user.click(screen.getByRole('button', { name: 'Удалить строку 1' }))
    expect(out()).not.toHaveProperty('t')
  })

  it('file: onUploadFiles получает поле и файлы; view показывает имя из filesById', () => {
    const d = doc([f({ id: 'fl', type: 'file', label: 'Файлы', config: { max_files: 3 } })])
    const onUploadFiles = vi.fn()
    const { container, rerender } = render(
      <FormRenderer doc={d} values={{}} mode="edit" ctx={{ onUploadFiles }} onChange={vi.fn()} />,
    )
    const input = container.querySelector('input[type=file]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['x'], 'смета.pdf')] } })
    expect(onUploadFiles).toHaveBeenCalledTimes(1)
    expect(onUploadFiles.mock.calls[0]![0].id).toBe('fl')
    rerender(
      <FormRenderer
        doc={d}
        values={{ fl: ['f1'] }}
        mode="view"
        ctx={{
          filesById: {
            f1: {
              id: 'f1',
              record_id: 'r',
              field_id: 'fl',
              name: 'смета.pdf',
              size: 2048,
              mime: '',
              uploaded_by: '',
              uploaded_at: '',
              deleted_at: null,
            },
          },
        }}
      />,
    )
    expect(screen.getByText('смета.pdf')).toBeInTheDocument()
    expect(screen.getByText('PDF')).toBeInTheDocument()
  })
})

describe('helpers', () => {
  it('errorsByField склеивает несколько ошибок поля', () => {
    const m = errorsByField([
      { field_id: 'a', code: 'x', message: 'раз' },
      { field_id: 'a', code: 'y', message: 'два' },
      { code: 'z', message: 'без поля' },
    ])
    expect(m.get('a')).toBe('раз; два')
    expect(m.size).toBe(1)
  })

  it('visibleFields не включает архивные и скрытые', () => {
    const d = doc([
      f({ id: 'a', type: 'text' }),
      f({ id: 'b', type: 'text', archived: true }),
      f({ id: 'c', type: 'text', visible_if: { all: [{ field: 'a', op: 'not_empty' }] } }),
    ])
    expect(visibleFields(d, {}).map((x) => x.id)).toEqual(['a'])
    expect(visibleFields(d, { a: 'x' }).map((x) => x.id)).toEqual(['a', 'c'])
  })

  it('форматирование: деньги ru-RU с валютой, даты дд.мм.гггг, плюрализация', () => {
    const nb = '\u00a0'
    expect(formatMoney(3200000)).toBe(`3${nb}200${nb}000${nb}₽`)
    expect(formatMoney(10.5, 'USD')).toBe(`10,5${nb}$`)
    expect(formatDate('2026-03-15')).toBe('15.03.2026')
    expect(plural(1, 'файл', 'файла', 'файлов')).toBe(`1${nb}файл`)
    expect(plural(3, 'файл', 'файла', 'файлов')).toBe(`3${nb}файла`)
    expect(plural(11, 'файл', 'файла', 'файлов')).toBe(`11${nb}файлов`)
    expect(formatValue(f({ id: 'c', type: 'checkbox' }), true)).toBe('Да')
    expect(formatValue(f({ id: 'c', type: 'checkbox' }), false)).toBe('—')
    expect(formatValue(f({ id: 't', type: 'text' }), '')).toBe('—')
  })
})
