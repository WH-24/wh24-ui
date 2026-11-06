import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { KnowledgePicker } from './KnowledgePicker'
import { MemoryEditor } from './MemoryEditor'
import { ToolPicker } from './ToolPicker'
import type { AgentToolInfo } from './types'

const tools: AgentToolInfo[] = [
  {
    name: 'search_workspace',
    title: 'Поиск по данным портала',
    description: 'Находит записи',
    write: false,
    source: 'builtin',
  },
  { name: 'load_object', title: 'Открыть запись', description: 'Полный текст', write: false, source: 'builtin' },
  { name: 'oup_lead_create', title: 'Создать лид', description: 'Готовит карточку лида', write: true, source: 'oup' },
]

function ToolsHost({ initial = [] as string[], onValue }: { initial?: string[]; onValue?: (v: string[]) => void }) {
  const [v, setV] = useState(initial)
  return (
    <ToolPicker
      tools={tools}
      value={v}
      onChange={(n) => {
        setV(n)
        onValue?.(n)
      }}
    />
  )
}

describe('ToolPicker', () => {
  it('«Все доступные» (пусто) включено по умолчанию: все галочки стоят и недоступны', () => {
    render(<ToolsHost />)
    expect(screen.getByRole('switch', { name: 'Все доступные' })).toHaveAttribute('aria-checked', 'true')
    for (const cb of screen.getAllByRole('checkbox')) {
      expect(cb).toBeChecked()
      expect(cb).toBeDisabled()
    }
  })

  it('группы «Чтение» и «Запись», у записи — «требует подтверждения»', () => {
    render(<ToolsHost />)
    const reads = screen.getByRole('region', { name: /Чтение/ })
    const writes = screen.getByRole('region', { name: /Запись/ })
    expect(within(reads).getAllByRole('checkbox')).toHaveLength(2)
    expect(within(writes).getAllByRole('checkbox')).toHaveLength(1)
    expect(within(writes).getByText('требует подтверждения')).toBeInTheDocument()
    expect(within(reads).queryByText('требует подтверждения')).toBeNull()
  })

  it('снять «Все доступные» — явный полный список; выбранное убирается и добавляется', async () => {
    const onValue = vi.fn()
    render(<ToolsHost onValue={onValue} />)
    await userEvent.click(screen.getByRole('switch', { name: 'Все доступные' }))
    expect(onValue).toHaveBeenLastCalledWith(['search_workspace', 'load_object', 'oup_lead_create'])
    await userEvent.click(screen.getByRole('checkbox', { name: /Создать лид/ }))
    expect(onValue).toHaveBeenLastCalledWith(['search_workspace', 'load_object'])
    await userEvent.click(screen.getByRole('checkbox', { name: /Создать лид/ }))
    expect(onValue).toHaveBeenLastCalledWith(['search_workspace', 'load_object', 'oup_lead_create'])
  })

  it('«Все доступные» обратно — пустой список', async () => {
    const onValue = vi.fn()
    render(<ToolsHost initial={['load_object']} onValue={onValue} />)
    expect(screen.getByRole('switch', { name: 'Все доступные' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('checkbox', { name: /Открыть запись/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Создать лид/ })).not.toBeChecked()
    await userEvent.click(screen.getByRole('switch', { name: 'Все доступные' }))
    expect(onValue).toHaveBeenLastCalledWith([])
  })

  it('последний инструмент снять нельзя: пусто значило бы «все»', async () => {
    const onValue = vi.fn()
    render(<ToolsHost initial={['load_object']} onValue={onValue} />)
    await userEvent.click(screen.getByRole('checkbox', { name: /Открыть запись/ }))
    expect(onValue).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent(/Нужен хотя бы один инструмент/)
  })

  it('поиск по названию, имени и описанию', async () => {
    render(<ToolsHost />)
    await userEvent.type(screen.getByLabelText('Найти инструмент'), 'лид')
    expect(screen.getByRole('checkbox', { name: /Создать лид/ })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /Открыть запись/ })).toBeNull()
    await userEvent.clear(screen.getByLabelText('Найти инструмент'))
    await userEvent.type(screen.getByLabelText('Найти инструмент'), 'zzz')
    expect(screen.getByText('Ничего не найдено.')).toBeInTheDocument()
  })

  it('инструмент из профиля, которого вам не видно, не теряется молча', async () => {
    const onValue = vi.fn()
    render(<ToolsHost initial={['load_object', 'hr_secret']} onValue={onValue} />)
    const missing = screen.getByRole('region', { name: 'Сейчас недоступны вам' })
    expect(within(missing).getByText('hr_secret')).toBeInTheDocument()
    await userEvent.click(within(missing).getByRole('checkbox'))
    expect(onValue).toHaveBeenLastCalledWith(['load_object'])
  })

  it('при «Только читать» у записи — пояснение; readOnly всё выключает; пустой и загружаемый список', () => {
    const { rerender } = render(
      <ToolPicker tools={tools} value={['load_object']} onChange={() => {}} writePolicy="deny" readOnly />,
    )
    expect(screen.getByText(/инструменты записи агенту не выдаются/)).toBeInTheDocument()
    for (const cb of screen.getAllByRole('checkbox')) expect(cb).toBeDisabled()
    rerender(<ToolPicker tools={[]} value={[]} onChange={() => {}} loading />)
    expect(screen.getByText('Загружаю инструменты…')).toBeInTheDocument()
    rerender(<ToolPicker tools={[]} value={[]} onChange={() => {}} />)
    expect(screen.getByText('Доступных вам инструментов нет.')).toBeInTheDocument()
    rerender(<ToolPicker tools={[]} value={[]} onChange={() => {}} error="не удалось загрузить" />)
    expect(screen.getByRole('alert')).toHaveTextContent('не удалось загрузить')
  })
})

describe('KnowledgePicker', () => {
  const base = { modules: [] as string[], pinned: [], onModulesChange: () => {}, onRemovePinned: () => {} }

  it('модули — переключатели-чипы; пусто = все модули, доступные запускающему', async () => {
    const onModulesChange = vi.fn()
    render(<KnowledgePicker {...base} moduleKeys={['oup', 'wiki']} onModulesChange={onModulesChange} />)
    expect(screen.getByText(/поиск по всем модулям/)).toBeInTheDocument()
    const oup = screen.getByRole('button', { name: 'ОУП' })
    expect(oup).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(oup)
    expect(onModulesChange).toHaveBeenCalledWith(['oup'])
  })

  it('выбранный модуль снимается; чужой модуль из профиля не пропадает', async () => {
    const onModulesChange = vi.fn()
    render(
      <KnowledgePicker
        {...base}
        modules={['oup', 'legacy']}
        moduleKeys={['oup', 'wiki']}
        onModulesChange={onModulesChange}
      />,
    )
    expect(screen.getByText(/Доступ запускающего при этом не расширяется/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'legacy' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'ОУП' }))
    expect(onModulesChange).toHaveBeenCalledWith(['legacy'])
  })

  it('закреплённые документы: «Убрать», «Закрепить документ» (колбэк хоста), предел 5', async () => {
    const onRemovePinned = vi.fn()
    const onPickDocument = vi.fn()
    const { rerender } = render(
      <KnowledgePicker
        {...base}
        pinned={[{ id: 'd1', title: 'Регламент отпусков', module: 'wiki' }, { id: 'd2' }]}
        onRemovePinned={onRemovePinned}
        onPickDocument={onPickDocument}
      />,
    )
    expect(screen.getByText('2 из 5')).toBeInTheDocument()
    expect(screen.getByText('Регламент отпусков')).toBeInTheDocument()
    expect(screen.getByText('d2')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Убрать документ «Регламент отпусков»' }))
    expect(onRemovePinned).toHaveBeenCalledWith('d1')
    await userEvent.click(screen.getByRole('button', { name: /Закрепить документ/ }))
    expect(onPickDocument).toHaveBeenCalledTimes(1)

    const five = Array.from({ length: 5 }, (_, i) => ({ id: `d${i}`, title: `Документ ${i}` }))
    rerender(<KnowledgePicker {...base} pinned={five} onPickDocument={onPickDocument} />)
    expect(screen.getByRole('button', { name: /Закрепить документ/ })).toBeDisabled()
  })

  it('после «Убрать» фокус остаётся в списке, а у последнего — на «Закрепить документ»', async () => {
    function Host() {
      const [pinned, setPinned] = useState([
        { id: 'd1', title: 'Первый' },
        { id: 'd2', title: 'Второй' },
      ])
      return (
        <KnowledgePicker
          {...base}
          pinned={pinned}
          onRemovePinned={(id) => setPinned((p) => p.filter((d) => d.id !== id))}
          onPickDocument={() => {}}
        />
      )
    }
    render(<Host />)
    await userEvent.click(screen.getByRole('button', { name: 'Убрать документ «Первый»' }))
    expect(screen.getByRole('button', { name: 'Убрать документ «Второй»' })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Убрать документ «Второй»' }))
    expect(screen.getByRole('button', { name: /Закрепить документ/ })).toHaveFocus()
  })

  it('без onPickDocument кнопки закрепления нет; readOnly — ни «Убрать», ни чипов', () => {
    render(<KnowledgePicker {...base} pinned={[{ id: 'd1', title: 'Док' }]} readOnly />)
    expect(screen.queryByRole('button', { name: /Закрепить/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Убрать/ })).toBeNull()
    expect(screen.getAllByRole('button')[0]).toBeDisabled()
  })
})

describe('MemoryEditor', () => {
  const items = [
    { id: 'm1', kind: 'preference' as const, text: 'Любит короткие ответы', created_at: '2026-11-05T09:30:00Z' },
    { id: 'm2', kind: 'fact' as const, text: 'Ведёт проект «Офис»', pinned: true },
    { id: 'm3', kind: 'recent' as const, text: 'Вчера смотрели лид «Склад»' },
  ]

  it('виды памяти, подпись «другие её не видят», «Забыть»', async () => {
    const onForget = vi.fn()
    render(<MemoryEditor items={items} onForget={onForget} />)
    expect(screen.getByText('Это ваша память этого агента: другие её не видят.')).toBeInTheDocument()
    expect(screen.getByText('Предпочтение')).toBeInTheDocument()
    expect(screen.getByText('Факт')).toBeInTheDocument()
    expect(screen.getByText('Недавнее')).toBeInTheDocument()
    expect(screen.getByText('Закреплено')).toBeInTheDocument()
    expect(document.querySelector('time')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Забыть: Любит короткие ответы' }))
    expect(onForget).toHaveBeenCalledWith(items[0])
  })

  it('после «Забыть» фокус остаётся в списке; когда записей нет — на подписи', async () => {
    function Host() {
      const [list, setList] = useState(items.slice(0, 2))
      return <MemoryEditor items={list} onForget={(m) => setList((l) => l.filter((x) => x.id !== m.id))} />
    }
    render(<Host />)
    await userEvent.click(screen.getByRole('button', { name: /Забыть: Любит/ }))
    expect(screen.getByRole('button', { name: /Забыть: Ведёт/ })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: /Забыть: Ведёт/ }))
    expect(screen.getByText('Агент пока ничего не запомнил.')).toHaveFocus()
  })

  it('пусто, загрузка, ошибка, занятая запись', () => {
    const { rerender } = render(<MemoryEditor items={[]} />)
    expect(screen.getByText('Агент пока ничего не запомнил.')).toBeInTheDocument()
    rerender(<MemoryEditor items={[]} loading />)
    expect(screen.getByText('Загружаю…')).toBeInTheDocument()
    rerender(<MemoryEditor items={[]} error="нет связи" />)
    expect(screen.getByRole('alert')).toHaveTextContent('нет связи')
    rerender(<MemoryEditor items={items} onForget={() => {}} busyId="m2" />)
    expect(screen.getByRole('button', { name: /Забыть: Ведёт/ })).toBeDisabled()
    expect(screen.getByText('Забываю…')).toBeInTheDocument()
  })

  it('без onForget кнопок нет', () => {
    render(<MemoryEditor items={items} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
