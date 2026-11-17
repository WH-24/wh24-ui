/**
 * Логика ленты записи без React: имена, время, черновик сообщения.
 */
import type { ApprovalChoice, Meeting, NewComment, OrgOption, RecordRoute, RecordRouteStep } from '../types.js'

/** Подписи решений — как в Pyrus. */
export const CHOICE_LABEL: Record<ApprovalChoice, string> = {
  approved: 'Утверждено',
  acknowledged: 'Прочитано',
  rejected: 'Против',
  revoked: 'Отозвать решение',
}

export const STEP_STATE_LABEL: Record<RecordRouteStep['state'], string> = {
  passed: 'пройден',
  current: 'текущий',
  rejected: 'против',
  pending: 'впереди',
}

/** «1 ч 30 мин», «45 мин», «2 ч». */
export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h && m) return `${h} ч ${m} мин`
  if (h) return `${h} ч`
  return `${m} мин`
}

/** «1:30», «90», «1ч30м», «1.5» → минуты; null — не разобрать. */
export function parseMinutes(src: string): number | null {
  const s = src.trim().toLowerCase().replace(',', '.')
  if (!s) return null
  let m: RegExpExecArray | null
  if ((m = /^(\d{1,2}):(\d{2})$/.exec(s))) {
    const min = Number(m[2])
    return min < 60 ? Number(m[1]) * 60 + min : null
  }
  if ((m = /^(?:(\d+)\s*ч)?\s*(?:(\d+)\s*м(?:ин)?)?$/.exec(s)) && (m[1] || m[2])) {
    return Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)
  }
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s)
    // Дробь — часы («1.5»), целое — минуты («90»).
    return s.includes('.') ? Math.round(n * 60) : n
  }
  return null
}

/** Быстрые варианты времени — как в Pyrus (от 5 минут до 10 часов). */
export const SPENT_PRESETS = [5, 15, 30, 60, 120, 240, 480, 600]

/**
 * Согласующий-отдел этапа маршрута: «dept:<id отдела HR>» (wh24-forms-api,
 * `route.DeptPrefix`). За отдел решает любой его сотрудник.
 */
export const DEPT_PREFIX = 'dept:'

/** id отдела из ключа согласующего; пусто — это сотрудник. */
export function deptOf(id: string): string {
  return id.startsWith(DEPT_PREFIX) ? id.slice(DEPT_PREFIX.length) : ''
}

/** Сотрудники по id и по учётке IAM; согласующий-отдел — по справочнику отделов. */
export function staffIndex(staff: OrgOption[], departments: OrgOption[] = []) {
  const byId = new Map(staff.map((s) => [s.id, s]))
  const byUser = new Map(staff.filter((s) => s.auth_user_id).map((s) => [s.auth_user_id as string, s]))
  const depts = new Map(departments.map((d) => [d.id, d.label]))
  return {
    // Согласующий-отдел — «отдел «…»»: в ленте «за отдел «Бухгалтерия»».
    name: (id: string | null | undefined) => {
      if (!id) return '—'
      const dept = deptOf(id)
      if (dept) return `отдел «${depts.get(dept) ?? 'без названия'}»`
      return byId.get(id)?.label ?? 'Сотрудник'
    },
    author: (userId: string) => byUser.get(userId)?.label ?? 'Сотрудник',
    authorStaff: (userId: string) => byUser.get(userId),
  }
}

/** Этап, на котором вызывающий может решать: текущий (или с «Против»), где он согласующий. */
export function myDecisionStep(route: RecordRoute | null): RecordRouteStep | null {
  if (!route?.current_step_id) return null
  const step = route.steps.find((s) => s.id === route.current_step_id)
  return step && step.approvers.some((a) => a.mine) ? step : null
}

/**
 * Этап «Инициализация» — первый этап записи формы с маршрутом (id — нулевой
 * UUID): автор правит запись и «Утверждено» на нём отправляет её на
 * согласование. В настройке маршрута формы его нет.
 */
export const ROUTE_INIT_STEP_ID = '00000000-0000-0000-0000-000000000000'
/** Стадия «Инициализация» полосы у сервиса, который этап ещё не отдаёт. */
export const ROUTE_INIT_STAGE = ROUTE_INIT_STEP_ID

export function isInitStep(step: { id: string }): boolean {
  return step.id === ROUTE_INIT_STEP_ID
}

/**
 * Стадии записи для полосы карточки (как у лида): «Инициализация», дальше —
 * этапы маршрута согласования по порядку. Текущая — этап, на котором стоит
 * запись; маршрут пройден — последний этап. У маршрута без этапов полосы
 * нет (null). Старый сервис «Инициализацию» не отдаёт — добавляем сами.
 */
export function routeStages(
  route: RecordRoute | null | undefined,
): { stages: { value: string; label: string }[]; stage: string } | null {
  if (!route || route.steps.length === 0) return null
  const hasInit = isInitStep(route.steps[0]!)
  const stages = [
    ...(hasInit ? [] : [{ value: ROUTE_INIT_STAGE, label: 'Инициализация' }]),
    ...route.steps.map((st) => ({ value: st.id, label: st.name })),
  ]
  const current = route.current_step_id && route.steps.some((st) => st.id === route.current_step_id)
    ? route.current_step_id
    : route.finished
      ? route.steps[route.steps.length - 1]!.id
      : ROUTE_INIT_STAGE
  return { stages, stage: current }
}

/**
 * Полоса стадий записи, как у лида (владелец 17.11.2026: «настройка включена —
 * статус должен отображаться»): есть этапы маршрута — они; маршрута у формы нет
 * (лента пришла, этапов ноль) — статусы записи «Открыта → Закрыта» с текущим.
 * Маршрут ещё не загружен (`undefined`/`null`) — полосы нет, чтобы она не
 * перескакивала со статусов на этапы.
 */
export function recordStages(
  route: RecordRoute | null | undefined,
  status: string,
  labels: Record<string, { label: string }>,
): { stages: { value: string; label: string }[]; stage: string } | null {
  if (!route) return null
  const byRoute = routeStages(route)
  if (byRoute) return byRoute
  const order = ['open', 'closed']
  const cur = status || 'open'
  const values = order.includes(cur) ? order : ['open', cur, 'closed']
  return {
    stages: values.map((v) => ({ value: v, label: labels[v]?.label ?? v })),
    stage: cur,
  }
}

/**
 * Можно ли сейчас править запись: у формы с маршрутом — только на
 * «Инициализации» (в том числе когда запись туда вернули); после отправки на
 * согласование правка задним числом закрыта (владелец 14.11.2026). Маршрут
 * ещё не загружен — «нет»: кнопка правки не мигает. Сервер проверяет то же.
 */
export function routeAllowsEdit(route: RecordRoute | null | undefined): boolean {
  if (!route) return false
  const first = route.steps[0]
  if (!first || !isInitStep(first)) return true
  return first.state === 'current'
}

/** Этапы, на которые можно вернуть запись решением «Против»: раньше текущего. */
export function returnTargets(route: RecordRoute, stepId: string): RecordRouteStep[] {
  const i = route.steps.findIndex((s) => s.id === stepId)
  return i > 0 ? route.steps.slice(0, i) : []
}

/** Мои решения, которые можно отозвать (на любом этапе). */
export function myRevocableSteps(route: RecordRoute | null): RecordRouteStep[] {
  return (route?.steps ?? []).filter((s) => s.approvers.some((a) => a.mine && a.choice))
}

/** Какие варианты решения доступны на этапе. */
export function availableChoices(step: RecordRouteStep): ApprovalChoice[] {
  // «Инициализация»: запись можно только отправить на согласование.
  if (isInitStep(step)) return ['approved']
  const out: ApprovalChoice[] = ['approved', 'acknowledged', 'rejected']
  if (step.approvers.some((a) => a.mine && a.choice)) out.push('revoked')
  return out
}

/** Черновик сообщения: текст + отложенные действия панели. */
export interface Draft {
  body: string
  /** Упомянутые: id → подпись, как вставлена в текст. */
  mentions: Record<string, string>
  approval: {
    step_id: string
    step_name: string
    choice: ApprovalChoice
    /** «Против» с возвратом: на какой этап вернуть запись. */
    return_to?: { id: string; name: string }
  } | null
  /** undefined — не трогаем; '' — снять. */
  responsible?: string
  due?: string
  spent: number
  meeting: Meeting | null
  files: File[]
}

export const EMPTY_DRAFT: Draft = {
  body: '',
  mentions: {},
  approval: null,
  spent: 0,
  meeting: null,
  files: [],
}

export function draftEmpty(d: Draft): boolean {
  return (
    !d.body.trim() &&
    !d.approval &&
    d.responsible === undefined &&
    d.due === undefined &&
    !d.spent &&
    !d.meeting &&
    d.files.length === 0
  )
}

/** Черновик → тело запроса. Упоминание считается, только пока его имя есть в тексте. */
export function draftToComment(d: Draft): NewComment {
  const mentions = Object.entries(d.mentions)
    .filter(([, label]) => d.body.includes('@' + label))
    .map(([id]) => id)
  const c: NewComment = { body: d.body.trim() }
  if (mentions.length) c.mentions = mentions
  if (d.approval) {
    c.approval = { step_id: d.approval.step_id, choice: d.approval.choice }
    if (d.approval.choice === 'rejected' && d.approval.return_to) c.approval.return_to = d.approval.return_to.id
  }
  if (d.responsible !== undefined) c.responsible = d.responsible
  if (d.due !== undefined) c.due = d.due
  if (d.spent) c.spent_minutes = d.spent
  if (d.meeting) c.meeting = d.meeting
  if (d.files.length) c.files = d.files
  return c
}

/** «10:00» → [10, 0]; null — не время. */
export function parseClock(s: string): [number, number] | null {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(s.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  return h < 24 && min < 60 ? [h, min] : null
}

/** Встреча из полей панели (местное время браузера). Ошибка — текст для человека. */
export function buildMeeting(
  title: string,
  date: string,
  from: string,
  to: string,
  url: string,
): { meeting?: Meeting; error?: string } {
  if (!date) return { error: 'Укажите дату встречи' }
  const a = parseClock(from)
  const b = parseClock(to)
  if (!a || !b) return { error: 'Время — в виде 10:00' }
  const [y = 0, mo = 1, d = 1] = date.split('-').map(Number)
  const start = new Date(y, mo - 1, d, a[0], a[1])
  const end = new Date(y, mo - 1, d, b[0], b[1])
  if (end <= start) return { error: 'Конец встречи должен быть позже начала' }
  const link = url.trim()
  if (!/^https?:\/\/\S+$/i.test(link)) return { error: 'Вставьте ссылку на звонок: Телемост, Zoom…' }
  return {
    meeting: { title: title.trim(), starts_at: start.toISOString(), ends_at: end.toISOString(), url: link },
  }
}

/** Набор смайликов панели. */
export const EMOJI = [
  '👍', '👎', '👌', '🙏', '👏', '🙌', '💪', '🤝',
  '😀', '😂', '🙂', '😉', '😍', '🤔', '😮', '😢',
  '😡', '😎', '🥳', '😴', '✅', '❌', '⚠️', '❗',
  '❓', '🔥', '⭐', '🎉', '💡', '📌', '📎', '📅',
  '⏰', '🚀', '💰', '📈', '🏗️', '🏠', '✏️', '👀',
]

/** Служебный id участника «ИИ» в списке «@»: это не сотрудник, в `mentions` сервера он не уходит. */
export const AI_MENTION_ID = '__ai__'

export const AI_OPTION: OrgOption = { id: AI_MENTION_ID, label: 'ИИ', hint: 'Спросить ИИ по данным портала' }

/** Текст упоминает ИИ: «@ИИ», «@ии», «@AI» отдельным словом (почта и «@ИИнна» — нет). */
export function mentionsAi(text: string): boolean {
  return /(^|[\s,;:(«"'])@(ИИ|ии|Ии|AI|ai)(?=$|[\s.,;:!?)»"'])/u.test(text)
}
