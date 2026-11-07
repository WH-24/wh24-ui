import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { BrainApiError } from '../api'
import { SkillCard } from './SkillCard'
import { SkillDialog } from './SkillDialog'
import { SkillSuggestionsDialog } from './SkillSuggestionsDialog'
import { SkillsList } from './SkillsList'
import { SLASH_RE, normalizeSlash, slashProblem, slugify, usesLabel } from './labels'
import type { Skill, SkillSuggestion } from './types'

const base: Skill = {
  id: 's1',
  name: 'Дайджест проекта',
  slash: 'дайджест',
  description: 'Сводка по проекту',
  instructions: 'Собери сводку: что изменилось, что горит.',
  status: 'active',
  visibility: 'private',
  owner_user_id: 'u1',
  uses: 3,
  last_used_at: '2026-11-05T10:00:00Z',
  can: { edit: true },
}
const skill = (over: Partial<Skill> = {}): Skill => ({ ...base, ...over })

describe('labels', () => {
  it('slugify: название → команда (кириллица остаётся, лишнее уходит, ≤30)', () => {
    expect(slugify('Дайджест проекта')).toBe('дайджест-проекта')
    expect(slugify('  Что нового?! ')).toBe('что-нового')
    expect(slugify('Report 2026 / Q4')).toBe('report-2026-q4')
    expect(slugify('???')).toBe('')
    expect(slugify('а'.repeat(50)).length).toBe(30)
  })

  it('формат команды как у сервера', () => {
    expect(SLASH_RE.test('дайджест')).toBe(true)
    expect(SLASH_RE.test('a')).toBe(false)
    expect(SLASH_RE.test('два слова')).toBe(false)
    expect(SLASH_RE.test('UPPER')).toBe(false)
    expect(slashProblem('')).toMatch(/Придумайте/)
    expect(slashProblem('x y')).toMatch(/без пробелов/)
    expect(slashProblem('ok-1')).toBeUndefined()
    expect(normalizeSlash(' /Дайджест ')).toBe('дайджест')
  })

  it('usesLabel склоняет «раз»', () => {
    expect(usesLabel(0)).toBe('Не применялся')
    expect(usesLabel(1)).toBe('Применён 1 раз')
    expect(usesLabel(3)).toBe('Применён 3 раза')
    expect(usesLabel(11)).toBe('Применён 11 раз')
    expect(usesLabel(22)).toBe('Применён 22 раза')
  })
})

describe('SkillCard', () => {
  it('показывает название, команду, статус, описание и счётчик', () => {
    render(<SkillCard skill={skill({ visibility: 'public' })} />)
    expect(screen.getByRole('heading', { name: 'Дайджест проекта' })).toBeInTheDocument()
    expect(screen.getByLabelText('Команда /дайджест')).toHaveTextContent('/дайджест')
    expect(screen.getByText('Включён')).toBeInTheDocument()
    expect(screen.getByText('Общий')).toBeInTheDocument()
    expect(screen.getByText('Сводка по проекту')).toBeInTheDocument()
    expect(screen.getByText(/Применён 3 раза/)).toBeInTheDocument()
  })

  it('без описания — начало инструкций', () => {
    render(<SkillCard skill={skill({ description: '' })} />)
    expect(screen.getByText(/Собери сводку/)).toBeInTheDocument()
  })

  it('меню «⋯» только при can.edit: правка, отключение, архив, удаление', async () => {
    const onEdit = vi.fn()
    const onSetStatus = vi.fn()
    const onDelete = vi.fn()
    const { rerender } = render(<SkillCard skill={skill({ can: { edit: false } })} onEdit={onEdit} onSetStatus={onSetStatus} onDelete={onDelete} />)
    expect(screen.queryByRole('button', { name: /Действия/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Дайджест проекта' })).toBeNull()

    rerender(<SkillCard skill={skill()} onEdit={onEdit} onSetStatus={onSetStatus} onDelete={onDelete} />)
    await userEvent.click(screen.getByRole('button', { name: 'Действия: Дайджест проекта' }))
    const labels = screen.getAllByRole('menuitem').map((b) => b.textContent)
    expect(labels).toEqual(['Редактировать', 'Отключить', 'В архив', 'Удалить…'])
    await userEvent.click(screen.getByRole('menuitem', { name: 'Отключить' }))
    expect(onSetStatus).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }), 'draft')
    await userEvent.click(screen.getByRole('button', { name: 'Действия: Дайджест проекта' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Удалить…' }))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('черновик — «Включить», архив — «Включить» без «В архив»; клик по названию правит', async () => {
    const onEdit = vi.fn()
    const { rerender } = render(<SkillCard skill={skill({ status: 'draft' })} onEdit={onEdit} onSetStatus={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Действия: Дайджест проекта' }))
    expect(screen.getAllByRole('menuitem').map((b) => b.textContent)).toEqual(['Редактировать', 'Включить', 'В архив'])
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('button', { name: 'Дайджест проекта' }))
    expect(onEdit).toHaveBeenCalledTimes(1)

    rerender(<SkillCard skill={skill({ status: 'archived' })} onEdit={onEdit} onSetStatus={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Действия: Дайджест проекта' }))
    expect(screen.getAllByRole('menuitem').map((b) => b.textContent)).toEqual(['Редактировать', 'Включить'])
  })
})

describe('SkillsList', () => {
  it('пустое состояние: объяснение и кнопки «Создать навык» / «Найти в чатах»', async () => {
    const onCreate = vi.fn()
    const onSuggest = vi.fn()
    render(<SkillsList skills={[]} onCreate={onCreate} onSuggest={onSuggest} />)
    expect(screen.getByText('Навыков пока нет')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Создать навык/ }))
    await userEvent.click(screen.getByRole('button', { name: /Найти в чатах/ }))
    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onSuggest).toHaveBeenCalledTimes(1)
  })

  it('загрузка и ошибка первой загрузки', async () => {
    const onRetry = vi.fn()
    const { rerender } = render(<SkillsList skills={[]} loading />)
    expect(screen.getByRole('status')).toHaveTextContent('Загружаю навыки…')
    rerender(<SkillsList skills={[]} error="Не загрузилось" onRetry={onRetry} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Не загрузилось')
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('сетка: включённые первыми, архив в конце', () => {
    render(
      <SkillsList
        skills={[
          skill({ id: 'a', name: 'Яблоко', status: 'archived' }),
          skill({ id: 'b', name: 'Банан', status: 'draft' }),
          skill({ id: 'c', name: 'Вишня', status: 'active' }),
        ]}
      />,
    )
    const heads = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(heads).toEqual(['Вишня', 'Банан', 'Яблоко'])
  })

  it('удаление: окно подтверждения, ошибка остаётся в окне, успех закрывает', async () => {
    const onDelete = vi.fn().mockRejectedValueOnce(new BrainApiError(403, 'Удалить может только автор.')).mockResolvedValueOnce(undefined)
    render(<SkillsList skills={[skill()]} onDelete={onDelete} />)
    await userEvent.click(screen.getByRole('button', { name: 'Действия: Дайджест проекта' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Удалить…' }))
    const dlg = screen.getByRole('dialog')
    expect(dlg).toHaveTextContent('/дайджест')
    await userEvent.click(within(dlg).getByRole('button', { name: 'Удалить' }))
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('Удалить может только автор.'))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Удалить' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(onDelete).toHaveBeenCalledTimes(2)
  })

  it('отмена удаления ничего не вызывает', async () => {
    const onDelete = vi.fn()
    render(<SkillsList skills={[skill()]} onDelete={onDelete} />)
    await userEvent.click(screen.getByRole('button', { name: 'Действия: Дайджест проекта' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Удалить…' }))
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('SkillDialog', () => {
  const api = () => ({ skills: { create: vi.fn(async (b) => ({ ...base, ...b, id: 'new' })), update: vi.fn(async (_id: string, p) => ({ ...base, ...p })) } })

  it('команда сама подставляется из названия, пока её не правили руками', async () => {
    render(<SkillDialog api={api()} open onClose={() => {}} />)
    await userEvent.type(screen.getByLabelText(/^Название/), 'Дайджест проекта')
    expect(screen.getByLabelText(/^Команда/)).toHaveValue('дайджест-проекта')
    await userEvent.clear(screen.getByLabelText(/^Команда/))
    await userEvent.type(screen.getByLabelText(/^Команда/), 'свой')
    await userEvent.type(screen.getByLabelText(/^Название/), ' ещё')
    expect(screen.getByLabelText(/^Команда/)).toHaveValue('свой')
  })

  it('проверка до отправки: поля с ошибками, фокус на первое, запрос не уходит', async () => {
    const a = api()
    render(<SkillDialog api={a} open onClose={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Создать навык' }))
    expect(screen.getByText('Дайте навыку название.')).toBeInTheDocument()
    expect(screen.getByText(/Придумайте команду/)).toBeInTheDocument()
    expect(screen.getByText(/Опишите, что ИИ должен делать/)).toBeInTheDocument()
    expect(a.skills.create).not.toHaveBeenCalled()
  })

  it('неверный формат команды подсказывается сразу; пробелы в команде становятся «-»', async () => {
    render(<SkillDialog api={api()} open onClose={() => {}} />)
    const slash = screen.getByLabelText(/^Команда/)
    await userEvent.type(slash, 'а б')
    expect(slash).toHaveValue('а-б')
    await userEvent.clear(slash)
    await userEvent.type(slash, 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Создать навык' }))
    expect(screen.getByText(/От 2 до 30 знаков/, { selector: '[role="alert"]' })).toBeInTheDocument()
  })

  it('создание: тело запроса, onSaved и закрытие; «Видна всем» только при canPublish', async () => {
    const a = api()
    const onSaved = vi.fn()
    const onClose = vi.fn()
    const { rerender } = render(<SkillDialog api={a} open onClose={onClose} onSaved={onSaved} />)
    expect(screen.queryByRole('switch', { name: /Видна всем/ })).toBeNull()
    rerender(<SkillDialog api={a} open onClose={onClose} onSaved={onSaved} canPublish />)
    await userEvent.type(screen.getByLabelText(/^Название/), 'Стендап')
    await userEvent.type(screen.getByLabelText(/^Инструкции/), 'Сделай стендап по людям.')
    await userEvent.click(screen.getByRole('switch', { name: /Видна всем/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Создать навык' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(a.skills.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Стендап', slash: 'стендап', instructions: 'Сделай стендап по людям.', status: 'active', visibility: 'public' }),
    )
    expect(onSaved.mock.calls[0]![1]).toEqual({ created: true })
    expect(onClose).toHaveBeenCalled()
  })

  it('«команда занята» (409, field=slash) показывается у поля команды, окно остаётся', async () => {
    const a = api()
    a.skills.create.mockRejectedValueOnce(new BrainApiError(409, 'Команда /стендап уже занята.', { field: 'slash' }))
    const onClose = vi.fn()
    render(<SkillDialog api={a} open onClose={onClose} initial={{ name: 'Стендап', instructions: 'x' }} />)
    await userEvent.click(screen.getByRole('button', { name: 'Создать навык' }))
    const alert = await screen.findByText('Команда /стендап уже занята.')
    expect(alert).toHaveAttribute('role', 'alert')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('прочая ошибка — общим блоком без «HTTP 500»', async () => {
    const a = api()
    a.skills.create.mockRejectedValueOnce(new BrainApiError(500, 'HTTP 500'))
    render(<SkillDialog api={a} open onClose={() => {}} initial={{ name: 'Стендап', instructions: 'x' }} />)
    await userEvent.click(screen.getByRole('button', { name: 'Создать навык' }))
    expect(await screen.findByText('Не получилось. Попробуйте ещё раз.')).toBeInTheDocument()
  })

  it('правка: уходит только изменённое; без изменений — запроса нет', async () => {
    const a = api()
    const onSaved = vi.fn()
    render(<SkillDialog api={a} open onClose={() => {}} skill={skill()} onSaved={onSaved} />)
    expect(screen.getByLabelText(/^Команда/)).toHaveValue('дайджест')
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(a.skills.update).not.toHaveBeenCalled()

    await userEvent.clear(screen.getByLabelText(/^Описание/))
    await userEvent.type(screen.getByLabelText(/^Описание/), 'Новое')
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(a.skills.update).toHaveBeenCalledWith('s1', { description: 'Новое' }))
    expect(onSaved.mock.calls[1]![1]).toEqual({ created: false })
  })

  it('счётчик инструкций и предел 4000', async () => {
    render(<SkillDialog api={api()} open onClose={() => {}} initial={{ name: 'А', instructions: 'абв' }} />)
    expect(screen.getByText('3 / 4000')).toBeInTheDocument()
  })
})

describe('SkillSuggestionsDialog', () => {
  const sg: SkillSuggestion = {
    name: 'Итог по проекту',
    slash: 'итог',
    description: 'Короткий итог',
    instructions: 'Собери итог по проекту.',
    evidence: ['что по проекту Север', 'итоги по проекту Юг'],
  }

  it('загрузка → предложения с выдержками; «Создать навык» отдаёт заготовку и закрывает окно', async () => {
    const suggest = vi.fn().mockResolvedValue({ suggestions: [sg], analyzed: 14 })
    const onPick = vi.fn()
    const onClose = vi.fn()
    render(<SkillSuggestionsDialog api={{ skills: { suggest } }} open onClose={onClose} onPick={onPick} />)
    expect(screen.getByRole('status')).toHaveTextContent('Читаю ваши вопросы…')
    expect(await screen.findByText('Итог по проекту')).toBeInTheDocument()
    expect(screen.getByText('«что по проекту Север»')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Создать навык' }))
    expect(onPick).toHaveBeenCalledWith(sg)
    expect(onClose).toHaveBeenCalled()
    expect(suggest).toHaveBeenCalledTimes(1)
  })

  it('нет предложений: причина от сервера и число прочитанных вопросов', async () => {
    const suggest = vi.fn().mockResolvedValue({ suggestions: [], analyzed: 2, reason: 'Пока мало вопросов.' })
    render(<SkillSuggestionsDialog api={{ skills: { suggest } }} open onClose={() => {}} onPick={() => {}} />)
    expect(await screen.findByText(/Пока мало вопросов\./)).toBeInTheDocument()
    expect(screen.getByText(/Прочитано вопросов: 2/)).toBeInTheDocument()
  })

  it('квота: понятный текст; «Искать заново» повторяет запрос', async () => {
    const suggest = vi
      .fn()
      .mockRejectedValueOnce(new BrainApiError(429, 'Лимит ИИ исчерпан — попробуйте позже.', { code: 'quota' }))
      .mockResolvedValueOnce({ suggestions: [], analyzed: 0 })
    render(<SkillSuggestionsDialog api={{ skills: { suggest } }} open onClose={() => {}} onPick={() => {}} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Лимит ИИ исчерпан — попробуйте позже.')
    await userEvent.click(screen.getByRole('button', { name: 'Искать заново' }))
    await waitFor(() => expect(suggest).toHaveBeenCalledTimes(2))
    expect(await screen.findByText(/Повторяющихся задач пока не нашлось/)).toBeInTheDocument()
  })

  it('429 too_many (не чаще раза в минуту): фраза сервера как есть, не «лимит ИИ»', async () => {
    const suggest = vi.fn().mockRejectedValue(new BrainApiError(429, 'поиск навыков уже запускали — подождите минуту', { code: 'too_many' }))
    render(<SkillSuggestionsDialog api={{ skills: { suggest } }} open onClose={() => {}} onPick={() => {}} />)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('поиск навыков уже запускали — подождите минуту')
    expect(alert).not.toHaveTextContent(/Лимит ИИ/)
    // Безликий «HTTP 429» без текста сервера тоже не показываем.
    suggest.mockRejectedValueOnce(new BrainApiError(429, 'HTTP 429', { code: 'too_many' }))
    await userEvent.click(screen.getByRole('button', { name: 'Искать заново' }))
    expect(await screen.findByText('Поиск навыков уже запускали — подождите минуту.')).toBeInTheDocument()
  })

  it('показывает не больше трёх предложений', async () => {
    const many = [1, 2, 3, 4, 5].map((i) => ({ ...sg, slash: `н${i}`, name: `Навык ${i}` }))
    render(<SkillSuggestionsDialog api={{ skills: { suggest: vi.fn().mockResolvedValue({ suggestions: many, analyzed: 30 }) } }} open onClose={() => {}} onPick={() => {}} />)
    await screen.findByText('Навык 1')
    expect(screen.getAllByRole('button', { name: 'Создать навык' })).toHaveLength(3)
  })
})

describe('SkillDialog: заготовка литералом', () => {
  it('перерисовка хоста с новым объектом initial не стирает введённое', async () => {
    const api = { skills: { create: vi.fn(), update: vi.fn() } }
    const { rerender } = render(<SkillDialog api={api} open onClose={() => {}} initial={{ name: 'А', instructions: 'x' }} />)
    await userEvent.type(screen.getByLabelText(/^Описание/), 'моё')
    rerender(<SkillDialog api={api} open onClose={() => {}} initial={{ name: 'А', instructions: 'x' }} />)
    expect(screen.getByLabelText(/^Описание/)).toHaveValue('моё')
  })
})
