import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { FormsApiError, commentForm, type FormsApi } from '../api'
import type { NewComment, OrgOption, RecordComment, RecordFeed, RecordRoute } from '../types'
import { FormRouteEditor } from './FormRouteEditor'
import { RecordChat } from './RecordChat'
import { buildMeeting, draftToComment, EMPTY_DRAFT, parseMinutes, mentionsAi } from './logic'

const staff: OrgOption[] = [
  { id: 's1', label: 'Иванов Иван', auth_user_id: 'u1', hint: 'Руководитель' },
  { id: 's2', label: 'Петрова Анна', auth_user_id: 'u2' },
]

const route = (mine: boolean): RecordRoute => ({
  steps: [
    {
      id: 'st1',
      name: 'Руководитель',
      state: 'current',
      approvers: [{ staff_id: 's1', choice: '', decided_at: null, mine }],
    },
  ],
  current_step_id: 'st1',
  finished: false,
})

const comment = (over: Partial<RecordComment> = {}): RecordComment => ({
  id: 'c1',
  record_id: 'r1',
  author: 'u2',
  body: 'Привет, **срочно**',
  reply_to: null,
  actions: {},
  created_at: '2026-10-22T08:00:00Z',
  files: [],
  ...over,
})

function fakeApi(feed: RecordFeed) {
  const sent: NewComment[] = []
  const comment_ = vi.fn(async (_f: string, _r: string, c: NewComment) => {
    sent.push(c)
    return {
      comment: comment({ id: `c${sent.length + 1}`, author: 'u1', body: c.body ?? '' }),
      route: feed.route,
      record: { id: 'r1' } as never,
    }
  })
  const watch = vi.fn(async (_f: string, _r: string, on: boolean) => ({ watching: on }))
  const api = {
    records: {
      feed: vi.fn(async () => feed),
      comment: comment_,
      watch,
      fileUrl: vi.fn(async () => ({ url: 'https://s3/x', expires_at: '' })),
    },
    route: { put: vi.fn(async () => []), get: vi.fn(async () => []) },
  } as unknown as FormsApi
  return { api, sent, comment: comment_, watch }
}

const baseFeed = (over: Partial<RecordFeed> = {}): RecordFeed => ({
  comments: [comment()],
  route: route(true),
  watching: false,
  fields: { responsible: 'fr', due: 'fd' },
  ...over,
})

describe('RecordChat', () => {
  it('показывает ленту с разметкой и автором по учётке', async () => {
    const { api } = fakeApi(baseFeed())
    render(<RecordChat api={api} formId="f1" recordId="r1" staff={staff} />)
    const msg = await screen.findByRole('article', { name: 'Сообщение: Петрова Анна' })
    expect(msg.querySelector('strong')?.textContent).toBe('срочно')
  })

  it('согласующий утверждает этап одним сообщением', async () => {
    const user = userEvent.setup()
    const { api, sent } = fakeApi(baseFeed())
    render(<RecordChat api={api} formId="f1" recordId="r1" staff={staff} />)
    await user.click(await screen.findByRole('button', { name: 'Утверждено' }))
    await user.click(screen.getByRole('button', { name: 'Против' }))
    // Кнопка панели показывает выбранное решение, плашка — что уйдёт.
    expect(screen.getByRole('toolbar', { name: 'Действия' })).toHaveTextContent('Против')
    expect(screen.getByRole('list', { name: 'Действия сообщения' })).toHaveTextContent('Против — «Руководитель»')
    await user.click(screen.getByRole('button', { name: 'Отправить' }))
    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0]?.approval).toEqual({ step_id: 'st1', choice: 'rejected' })
  })

  it('не согласующему кнопки решения нет', async () => {
    const { api } = fakeApi(baseFeed({ route: route(false) }))
    render(<RecordChat api={api} formId="f1" recordId="r1" staff={staff} />)
    await screen.findByRole('article')
    expect(screen.queryByRole('button', { name: 'Утверждено' })).toBeNull()
  })

  it('@ упоминает сотрудника из списка', async () => {
    const user = userEvent.setup()
    const { api, sent } = fakeApi(baseFeed())
    render(<RecordChat api={api} formId="f1" recordId="r1" staff={staff} />)
    const box = await screen.findByRole('textbox', { name: 'Текст сообщения' })
    await user.type(box, 'Посмотри @Ива')
    await user.click(screen.getByRole('option', { name: /Иванов Иван/ }))
    expect(box).toHaveValue('Посмотри @Иванов Иван ')
    await user.keyboard('{Control>}{Enter}{/Control}')
    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0]?.mentions).toEqual(['s1'])
  })

  it('время из быстрых вариантов уходит минутами', async () => {
    const user = userEvent.setup()
    const { api, sent } = fakeApi(baseFeed())
    render(<RecordChat api={api} formId="f1" recordId="r1" staff={staff} />)
    await user.click(await screen.findByRole('button', { name: 'Затраченное время' }))
    await user.click(screen.getByRole('button', { name: '1 ч' }))
    expect(screen.getByText(/Затрачено: 1 ч/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Отправить' }))
    await waitFor(() => expect(sent[0]?.spent_minutes).toBe(60))
  })

  it('без поля «Срок» у формы кнопка срока выключена', async () => {
    const { api } = fakeApi(baseFeed({ fields: { responsible: '', due: '' } }))
    render(<RecordChat api={api} formId="f1" recordId="r1" staff={staff} />)
    expect(await screen.findByRole('button', { name: 'У формы нет поля «Срок»' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'У формы нет поля «Ответственный»' })).toBeDisabled()
  })

  it('флажок ставит «На контроле» сразу, без отправки', async () => {
    const user = userEvent.setup()
    const { api, watch } = fakeApi(baseFeed())
    render(<RecordChat api={api} formId="f1" recordId="r1" staff={staff} />)
    await user.click(await screen.findByRole('button', { name: 'На контроле' }))
    expect(watch).toHaveBeenCalledWith('f1', 'r1', true)
    expect(screen.getByRole('button', { name: 'Снять с контроля' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('отказ сервера оставляет черновик и показывает причину', async () => {
    const user = userEvent.setup()
    const { api, comment: send } = fakeApi(baseFeed())
    send.mockRejectedValueOnce(new FormsApiError(403, 'вы не согласующий этого этапа'))
    render(<RecordChat api={api} formId="f1" recordId="r1" staff={staff} />)
    const box = await screen.findByRole('textbox', { name: 'Текст сообщения' })
    await user.type(box, 'Текст')
    await user.click(screen.getByRole('button', { name: 'Отправить' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('вы не согласующий')
    expect(box).toHaveValue('Текст')
  })

  it('встреча показывается карточкой со ссылкой', async () => {
    const { api } = fakeApi(
      baseFeed({
        comments: [
          comment({
            body: '',
            actions: {
              meeting: {
                title: 'Созвон',
                starts_at: '2026-10-23T07:00:00Z',
                ends_at: '2026-10-23T08:00:00Z',
                url: 'https://telemost.yandex.ru/j/1',
              },
            },
          }),
        ],
      }),
    )
    render(<RecordChat api={api} formId="f1" recordId="r1" staff={staff} />)
    expect(await screen.findByRole('link', { name: 'Подключиться' })).toHaveAttribute(
      'href',
      'https://telemost.yandex.ru/j/1',
    )
  })
})

describe('RecordChat — сбой справочника', () => {
  it('предупреждает, что решения и уведомления не работают', async () => {
    const { api } = fakeApi(baseFeed({ staff_unavailable: true }))
    render(<RecordChat api={api} formId="f1" recordId="r1" staff={staff} />)
    expect(await screen.findByRole('status')).toHaveTextContent('Справочник сотрудников временно недоступен')
  })
})

describe('логика панели', () => {
  it('время: 1:30, 90, 1.5, 1ч 30м', () => {
    expect(parseMinutes('1:30')).toBe(90)
    expect(parseMinutes('90')).toBe(90)
    expect(parseMinutes('1.5')).toBe(90)
    expect(parseMinutes('1ч 30м')).toBe(90)
    expect(parseMinutes('1:75')).toBeNull()
    expect(parseMinutes('что-то')).toBeNull()
  })

  it('встреча: ссылка обязательна, конец позже начала', () => {
    expect(buildMeeting('', '2026-10-23', '10:00', '11:00', 'https://t.me/x').meeting).toBeTruthy()
    expect(buildMeeting('', '2026-10-23', '10:00', '09:00', 'https://t.me/x').error).toMatch(/позже/)
    expect(buildMeeting('', '2026-10-23', '10:00', '11:00', 'javascript:alert(1)').error).toMatch(/ссылку/)
  })

  it('упоминание, стёртое из текста, не уходит', () => {
    const c = draftToComment({ ...EMPTY_DRAFT, body: 'без имени', mentions: { s1: 'Иванов Иван' } })
    expect(c.mentions).toBeUndefined()
  })

  it('пустой срок уходит как «снять», не теряется', () => {
    const fd = commentForm({ due: '', responsible: '' })
    expect(fd.get('due')).toBe('')
    expect(fd.get('responsible')).toBe('')
    expect(fd.has('body')).toBe(false)
  })
})

describe('RecordChat — «@ИИ»', () => {
  it('«ИИ» первым в списке «@», в упоминания сервера не уходит; вопрос → ответ ИИ с источниками', async () => {
    const user = userEvent.setup()
    const answer = comment({
      id: 'c-ai',
      author: '00000000-0000-0000-0000-000000000000',
      body: 'Смету нужно сдать к пятнице [1].',
      reply_to: 'c2',
      author_kind: 'ai',
      requested_by: 'u1',
      meta: { citations: [{ n: 1, title: 'Задача: смета', url: '/tasks/77' }] },
    })
    const { api, sent } = fakeApi(baseFeed())
    // после отправки сервер уже держит ответ ИИ — опрос ленты его находит
    const feedMock = api.records.feed as unknown as ReturnType<typeof vi.fn>
    feedMock.mockResolvedValueOnce(baseFeed()).mockResolvedValue(
      baseFeed({
        comments: [
          comment(),
          comment({
            id: 'c2',
            author: 'u1',
            body: '@ИИ когда сдавать смету?',
          }),
          answer,
        ],
      }),
    )
    const onAsk = vi.fn(async () => undefined)
    const onNavigate = vi.fn()
    render(<RecordChat api={api} formId="f1" recordId="r1" staff={staff} ai={{ onAsk, onNavigate }} />)
    const box = await screen.findByRole('textbox')
    await user.click(box)
    await user.type(box, '@')
    const list = await screen.findByRole('listbox', { name: 'Упомянуть' })
    expect(within(list).getAllByRole('option')[0]).toHaveTextContent('ИИ')
    await user.click(within(list).getAllByRole('option')[0]!)
    await user.type(box, 'когда сдавать смету?')
    expect(await screen.findByRole('note')).toHaveTextContent('только названия')
    await user.click(screen.getByRole('button', { name: 'Отправить' }))
    await waitFor(() => expect(sent).toHaveLength(1))
    // «ИИ» остался словом в тексте, но не стал упоминанием сотрудника
    expect(sent[0]?.body).toBe('@ИИ когда сдавать смету?')
    expect(sent[0]?.mentions).toBeUndefined()
    await waitFor(() =>
      expect(onAsk).toHaveBeenCalledWith({
        commentId: 'c2',
        text: '@ИИ когда сдавать смету?',
      }),
    )
    // ответ ИИ — с пометкой, по чьей просьбе, и источником названием
    expect(await screen.findByText(/Ответ ИИ/, {}, { timeout: 5000 })).toBeTruthy()
    expect(screen.getByText(/по запросу Иванов Иван/)).toBeTruthy()
    const link = screen.getByRole('link', { name: 'Задача: смета' })
    await user.click(link)
    expect(onNavigate).toHaveBeenCalledWith('/tasks/77')
  })

  it('без свойства ai участника «ИИ» в списке нет, вопрос не уходит', async () => {
    const user = userEvent.setup()
    const { api, sent } = fakeApi(baseFeed())
    render(<RecordChat api={api} formId="f1" recordId="r1" staff={staff} />)
    const box = await screen.findByRole('textbox')
    await user.click(box)
    await user.type(box, '@')
    const list = await screen.findByRole('listbox', { name: 'Упомянуть' })
    expect(within(list).queryByText('ИИ')).toBeNull()
    await user.type(box, 'ИИ привет')
    expect(screen.queryByRole('note')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Отправить' }))
    await waitFor(() => expect(sent).toHaveLength(1))
  })

  it('mentionsAi: отдельное слово, не почта и не имя', () => {
    expect(mentionsAi('@ИИ сколько часов?')).toBe(true)
    expect(mentionsAi('Коллеги, @ии, что по срокам?')).toBe(true)
    expect(mentionsAi('письмо ai@wowhaus.ru')).toBe(false)
    expect(mentionsAi('@ИИнна, привет')).toBe(false)
  })

  it('history: правки записи — в ленте по времени; фильтр «Сообщения / Изменения»; без history — только сообщения', async () => {
    const user = userEvent.setup()
    const { api } = fakeApi(baseFeed())
    const history = vi.fn(async () => [
      {
        id: 'h2',
        record_id: 'r1',
        form_version: 1,
        actor: 'u2',
        at: '2026-10-22T09:00:00Z',
        action: 'updated' as const,
        changes: { name: { from: 'Старое', to: 'Новое' } },
      },
      {
        id: 'h1',
        record_id: 'r1',
        form_version: 1,
        actor: 'u2',
        at: '2026-10-22T07:00:00Z',
        action: 'created' as const,
        changes: { name: { from: null, to: 'Старое' } },
      },
    ])
    ;(api.records as unknown as { history: typeof history }).history = history
    const schema = {
      schema_version: 1,
      sections: [{ id: 's1', title: 'Основное', sort: 0 }],
      fields: [{ id: 'name', key: 'name', type: 'text', label: 'Название', section_id: 's1' }],
    } as never
    const { unmount } = render(
      <RecordChat api={api} formId="f1" recordId="r1" staff={staff} history={{ schema }} />,
    )
    const log = await screen.findByRole('log')
    await waitFor(() => expect(log).toHaveTextContent('Изменена'))
    // По времени: создана (07:00) → сообщение (08:00) → изменена (09:00).
    const text = log.textContent ?? ''
    expect(text.indexOf('Создана')).toBeLessThan(text.indexOf('срочно'))
    expect(text.indexOf('срочно')).toBeLessThan(text.indexOf('Изменена'))
    // Правка — «было → стало»; у создания перечня полей нет.
    expect(log).toHaveTextContent('Название')
    expect(log).toHaveTextContent('Новое')
    expect(text.match(/Старое/g)).toHaveLength(1)

    await user.click(screen.getByRole('tab', { name: /Изменения/ }))
    expect(screen.queryByRole('article')).toBeNull()
    expect(screen.getByRole('log')).toHaveTextContent('Изменена')
    await user.click(screen.getByRole('tab', { name: /Сообщения/ }))
    expect(screen.getByRole('article')).toBeTruthy()
    expect(screen.getByRole('log')).not.toHaveTextContent('Изменена')
    unmount()

    history.mockClear()
    render(<RecordChat api={api} formId="f1" recordId="r1" staff={staff} />)
    await screen.findByRole('article')
    expect(history).not.toHaveBeenCalled()
    expect(screen.queryByRole('tab', { name: /Изменения/ })).toBeNull()
  })

  it('onRoute: маршрут ленты уходит хосту', async () => {
    const { api } = fakeApi(baseFeed())
    const onRoute = vi.fn()
    render(<RecordChat api={api} formId="f1" recordId="r1" staff={staff} onRoute={onRoute} />)
    await screen.findByRole('article')
    await waitFor(() => expect(onRoute).toHaveBeenCalledWith(route(true)))
  })

  it('«Инициализация»: автору доступно только «Утверждено» — оно отправляет запись на согласование', async () => {
    const user = userEvent.setup()
    const INIT = '00000000-0000-0000-0000-000000000000'
    const r: RecordRoute = {
      steps: [
        { id: INIT, name: 'Инициализация', state: 'current', approvers: [{ staff_id: '', choice: '', decided_at: null, mine: true }] },
        { id: 'st1', name: 'Руководитель', state: 'pending', approvers: [{ staff_id: 's1', choice: '', decided_at: null, mine: false }] },
      ],
      current_step_id: INIT,
      finished: false,
    }
    const { api, sent } = fakeApi(baseFeed({ route: r }))
    const onRecordChange = vi.fn()
    render(<RecordChat api={api} formId="f1" recordId="r1" staff={staff} onRecordChange={onRecordChange} />)
    await user.click(await screen.findByRole('button', { name: 'Утверждено' }))
    expect(screen.queryByRole('button', { name: 'Против' })).toBeNull()
    // Панель решения стоит над кнопкой панели инструментов — её «Утверждено» первое.
    await user.click(screen.getAllByRole('button', { name: 'Утверждено' })[0]!)
    await user.click(screen.getByRole('button', { name: 'Отправить' }))
    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0]?.approval).toEqual({ step_id: INIT, choice: 'approved' })
    // Решение меняет статус записи — карточка получает её сразу.
    expect(onRecordChange).toHaveBeenCalled()
  })

  it('«Против» с возвратом: согласующий выбирает этап, на который вернуть запись', async () => {
    const user = userEvent.setup()
    const INIT = '00000000-0000-0000-0000-000000000000'
    const r: RecordRoute = {
      steps: [
        { id: INIT, name: 'Инициализация', state: 'passed', approvers: [{ staff_id: '', choice: 'approved', decided_at: null, mine: false }] },
        { id: 'st1', name: 'Руководитель', state: 'current', approvers: [{ staff_id: 's1', choice: '', decided_at: null, mine: true }] },
      ],
      current_step_id: 'st1',
      finished: false,
    }
    const { api, sent } = fakeApi(baseFeed({ route: r }))
    render(<RecordChat api={api} formId="f1" recordId="r1" staff={staff} />)
    await user.click(await screen.findByRole('button', { name: 'Утверждено' }))
    await user.click(screen.getByRole('combobox', { name: 'Вернуть на этап' }))
    await user.click(await screen.findByRole('option', { name: 'Инициализация' }))
    await user.click(screen.getByRole('button', { name: 'Против' }))
    expect(screen.getByRole('list', { name: 'Действия сообщения' })).toHaveTextContent(
      'Против — «Руководитель», вернуть на «Инициализация»',
    )
    await user.click(screen.getByRole('button', { name: 'Отправить' }))
    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0]?.approval).toEqual({ step_id: 'st1', choice: 'rejected', return_to: INIT })
  })

  it('FormRouteEditor: маршрут формы без записи — этапы и согласующие, без состояний; «Настроить» — у управляющего', async () => {
    const steps = [{ id: 'st1', name: 'Руководитель', approvers: ['s1'] }]
    const api = {
      route: { get: vi.fn(async () => steps), put: vi.fn(async () => steps) },
    } as unknown as FormsApi
    const onSteps = vi.fn()
    const { unmount } = render(<FormRouteEditor api={api} formId="f1" staff={staff} canManage onSteps={onSteps} />)
    const bar = await screen.findByLabelText('Маршрут согласования')
    expect(bar).toHaveTextContent('Руководитель')
    expect(bar).not.toHaveTextContent('впереди')
    expect(onSteps).toHaveBeenCalledWith(steps)
    expect(screen.getByRole('button', { name: /Настроить/ })).toBeTruthy()
    unmount()
    render(<FormRouteEditor api={api} formId="f1" staff={staff} canManage={false} />)
    await screen.findByLabelText('Маршрут согласования')
    expect(screen.queryByRole('button', { name: /Настроить/ })).toBeNull()
  })
})
