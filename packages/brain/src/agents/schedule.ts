/**
 * Расписание агента: человеческий ввод ⇄ cron из 5 полей, ближайший запуск и
 * проверка «не чаще раза в 5 минут».
 *
 * Ближайший запуск считаем здесь, а не берём у сервера: серверный `next_run_at`
 * относится к СОХРАНЁННОМУ расписанию и устаревает при первой же правке.
 * Считаем «настенными» часами в таймзоне расписания (ни перевода в UTC, ни
 * перехода на летнее время) — для этого достаточно календарной арифметики, а
 * подпись «по Москве» честно говорит, в каком времени ответ.
 */

/** Чаще раза в столько минут запускать нельзя (то же правило у сервера). */
export const SCHEDULE_MIN_MINUTES = 5
export const DEFAULT_TZ = 'Europe/Moscow'

export type Frequency = 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'custom'

/** Часть cron в терминах человека. `days` — дни недели ISO: 1 — Пн … 7 — Вс. */
export interface ScheduleParts {
  frequency: Frequency
  /** `ЧЧ:ММ`. */
  time: string
  days: number[]
  /** Число месяца для `monthly`, 1–31. */
  monthDay: number
}

export const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const
const WEEKDAY_LOWER = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']
const WEEKDAY_ON_DAY = ['понедельникам', 'вторникам', 'средам', 'четвергам', 'пятницам', 'субботам', 'воскресеньям']
const WEEKDAY_NAMES_RU = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']
const MONTHS_GEN = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
]

const pad = (n: number) => String(n).padStart(2, '0')

export function isValidTime(t: string): boolean {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim())
  if (!m) return false
  return Number(m[1]) <= 23 && Number(m[2]) <= 59
}

export function normalizeTime(t: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim())
  return m ? `${pad(Number(m[1]))}:${m[2]}` : t
}

// ─── Человеческий ввод → cron ─────────────────────────────────────────

/** ISO-день (1–7, Пн–Вс) → день недели cron (0–6, Вс = 0). */
const isoToCron = (d: number) => d % 7

/** Собрать cron из частей. `custom` собрать нельзя — пустая строка. */
export function cronFromParts(p: ScheduleParts): string {
  if (p.frequency === 'custom' || !isValidTime(p.time)) return ''
  const [h, m] = p.time.split(':').map(Number)
  const head = `${m} ${h}`
  switch (p.frequency) {
    case 'daily':
      return `${head} * * *`
    case 'weekdays':
      return `${head} * * 1-5`
    case 'weekly': {
      const days = [...new Set(p.days)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b)
      return days.length ? `${head} * * ${days.map(isoToCron).join(',')}` : ''
    }
    case 'monthly':
      return p.monthDay >= 1 && p.monthDay <= 31 ? `${head} ${p.monthDay} * *` : ''
  }
}

/** Разбор cron обратно в части; `null` — выражение не из нашего набора («Своё расписание»). */
export function partsFromCron(cron: string): ScheduleParts | null {
  const f = cron.trim().split(/\s+/)
  if (f.length !== 5) return null
  const [min, hour, dom, month, dow] = f as [string, string, string, string, string]
  if (!/^\d{1,2}$/.test(min) || !/^\d{1,2}$/.test(hour) || month !== '*') return null
  const time = `${pad(Number(hour))}:${pad(Number(min))}`
  if (!isValidTime(time)) return null
  const base = { time, days: [] as number[], monthDay: 1 }
  if (dom === '*' && dow === '*') return { ...base, frequency: 'daily' }
  if (dom === '*' && dow === '1-5') return { ...base, frequency: 'weekdays', days: [1, 2, 3, 4, 5] }
  if (dom === '*' && /^[0-6](,[0-6])*$/.test(dow)) {
    const days = [...new Set(dow.split(',').map((d) => (Number(d) === 0 ? 7 : Number(d))))].sort((a, b) => a - b)
    return { ...base, frequency: 'weekly', days }
  }
  if (dow === '*' && /^\d{1,2}$/.test(dom) && Number(dom) >= 1 && Number(dom) <= 31) {
    return { ...base, frequency: 'monthly', monthDay: Number(dom) }
  }
  return null
}

// ─── Разбор cron для расчёта запусков ─────────────────────────────────

interface CronSpec {
  minutes: number[]
  hours: number[]
  dom: Set<number>
  months: Set<number>
  dow: Set<number>
  domStar: boolean
  dowStar: boolean
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
}
const DOW_NAMES: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }

function parseField(
  src: string,
  min: number,
  max: number,
  names?: Record<string, number>,
): { values: number[]; star: boolean } | null {
  const num = (s: string): number | null => {
    const key = s.toLowerCase()
    if (names && key in names) return names[key]!
    return /^\d+$/.test(s) ? Number(s) : null
  }
  const out = new Set<number>()
  const star = src.startsWith('*') || src.startsWith('?')
  for (const term of src.split(',')) {
    if (!term) return null
    const [range, stepSrc, extra] = term.split('/')
    if (extra !== undefined) return null
    let step = 1
    if (stepSrc !== undefined) {
      if (!/^\d+$/.test(stepSrc) || Number(stepSrc) < 1) return null
      step = Number(stepSrc)
    }
    let lo: number
    let hi: number
    if (range === '*' || range === '?') {
      lo = min
      hi = max
    } else if (range!.includes('-')) {
      const [a, b, c] = range!.split('-')
      const na = a === undefined ? null : num(a)
      const nb = b === undefined ? null : num(b)
      if (c !== undefined || na === null || nb === null) return null
      lo = na
      hi = nb
    } else {
      const n = num(range!)
      if (n === null) return null
      lo = n
      hi = stepSrc !== undefined ? max : n
    }
    if (lo < min || hi > max || lo > hi) return null
    for (let v = lo; v <= hi; v += step) out.add(v)
  }
  return { values: [...out].sort((a, b) => a - b), star }
}

function parseCron(expr: string): CronSpec | null {
  const f = expr.trim().split(/\s+/)
  if (f.length !== 5) return null
  const minutes = parseField(f[0]!, 0, 59)
  const hours = parseField(f[1]!, 0, 23)
  const dom = parseField(f[2]!, 1, 31)
  const months = parseField(f[3]!, 1, 12, MONTH_NAMES)
  const dow = parseField(f[4]!, 0, 6, DOW_NAMES)
  if (!minutes || !hours || !dom || !months || !dow) return null
  return {
    minutes: minutes.values,
    hours: hours.values,
    dom: new Set(dom.values),
    months: new Set(months.values),
    dow: new Set(dow.values),
    domStar: dom.star,
    dowStar: dow.star,
  }
}

/** «Настенное» время: дата и часы в таймзоне расписания, без привязки к моменту. */
export interface Wall {
  y: number
  m: number
  d: number
  h: number
  mi: number
}

const wallMinutes = (w: Wall) => Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi) / 60000

function dayMatches(spec: CronSpec, y: number, m: number, d: number): boolean {
  if (!spec.months.has(m)) return false
  const domOk = spec.dom.has(d)
  const dowOk = spec.dow.has(new Date(Date.UTC(y, m - 1, d)).getUTCDay())
  // Как в cron: оба поля заданы — достаточно любого; одно «*» — нужны оба.
  return spec.domStar || spec.dowStar ? domOk && dowOk : domOk || dowOk
}

/** Ближайший запуск строго после `from`. `null` — расписание не срабатывает никогда. */
function nextFire(spec: CronSpec, from: Wall): Wall | null {
  for (let off = 0; off < 366 * 9; off++) {
    const t = new Date(Date.UTC(from.y, from.m - 1, from.d + off))
    const y = t.getUTCFullYear()
    const m = t.getUTCMonth() + 1
    const d = t.getUTCDate()
    if (!dayMatches(spec, y, m, d)) continue
    for (const h of spec.hours) {
      for (const mi of spec.minutes) {
        if (off === 0 && (h < from.h || (h === from.h && mi <= from.mi))) continue
        return { y, m, d, h, mi }
      }
    }
  }
  return null
}

/**
 * Что не так с расписанием, по-русски; `null` — всё хорошо. Те же правила, что у
 * сервера: cron из 5 полей, не чаще раза в 5 минут.
 */
export function scheduleProblem(cron: string): string | null {
  if (!cron.trim()) return 'Укажите расписание'
  const spec = parseCron(cron)
  if (!spec) {
    return 'Расписание не разобрано: нужно 5 полей — минута, час, число, месяц, день недели (например, 30 9 * * 1-5)'
  }
  // Сравниваем подряд идущие запуски на несколько недель вперёд: «0,2 9 * * *» — запуски в 9:00 и 9:02.
  let cur: Wall = { y: 2026, m: 1, d: 5, h: 0, mi: 0 }
  let prev: number | null = null
  for (let i = 0; i < 64; i++) {
    const next = nextFire(spec, cur)
    if (!next) break
    const at = wallMinutes(next)
    if (prev !== null && at - prev < SCHEDULE_MIN_MINUTES) {
      return `Запускать чаще раза в ${SCHEDULE_MIN_MINUTES} минут нельзя. Выберите время, например «каждый день в 09:30»`
    }
    prev = at
    cur = next
  }
  return null
}

// ─── Таймзоны ─────────────────────────────────────────────────────────

export interface TimezoneOption {
  value: string
  label: string
}

/** Часовые пояса России и несколько соседних; хост может передать свой список. */
export const DEFAULT_TIMEZONES: TimezoneOption[] = [
  { value: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)' },
  { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
  { value: 'Europe/Samara', label: 'Самара (UTC+4)' },
  { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)' },
  { value: 'Asia/Omsk', label: 'Омск (UTC+6)' },
  { value: 'Asia/Krasnoyarsk', label: 'Красноярск (UTC+7)' },
  { value: 'Asia/Irkutsk', label: 'Иркутск (UTC+8)' },
  { value: 'Asia/Yakutsk', label: 'Якутск (UTC+9)' },
  { value: 'Asia/Vladivostok', label: 'Владивосток (UTC+10)' },
  { value: 'Asia/Magadan', label: 'Магадан (UTC+11)' },
  { value: 'Asia/Kamchatka', label: 'Камчатка (UTC+12)' },
  { value: 'Europe/Minsk', label: 'Минск (UTC+3)' },
  { value: 'Asia/Almaty', label: 'Алма-Ата (UTC+5)' },
  { value: 'Asia/Dubai', label: 'Дубай (UTC+4)' },
  { value: 'UTC', label: 'UTC' },
]

/** Короткая подпись таймзоны для строки расписания: МСК, Екатеринбург, UTC. */
export function tzShortLabel(tz: string | undefined): string {
  const z = tz || DEFAULT_TZ
  if (z === DEFAULT_TZ) return 'МСК'
  const found = DEFAULT_TIMEZONES.find((o) => o.value === z)
  return found ? found.label.replace(/\s*\(.*\)$/, '') : z
}

/** Дата и время в таймзоне `tz` для момента `at`; `null` — таймзона неизвестна. */
export function wallInTz(at: Date, tz: string): Wall | null {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(at)
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
    const w = { y: get('year'), m: get('month'), d: get('day'), h: get('hour') % 24, mi: get('minute') }
    return Object.values(w).some((v) => Number.isNaN(v)) ? null : w
  } catch {
    return null
  }
}

// ─── «Заканчивается»: дата ⇄ RFC 3339 ─────────────────────────────────

/** Дата `гггг-мм-дд` (в таймзоне расписания) → момент конца этого дня, RFC 3339 в UTC. */
export function dateToEndsAt(date: string, tz: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const noon = new Date(Date.UTC(y, mo - 1, d, 12))
  const wall = wallInTz(noon, tz || DEFAULT_TZ)
  if (!wall) return null
  const offsetMin = (Date.UTC(wall.y, wall.m - 1, wall.d, wall.h, wall.mi) - noon.getTime()) / 60000
  return new Date(Date.UTC(y, mo - 1, d, 23, 59, 59) - offsetMin * 60000).toISOString()
}

/** `ends_at` → дата `гггг-мм-дд` в таймзоне расписания; пустая строка, если даты нет. */
export function endsAtToDate(endsAt: string | null | undefined, tz: string): string {
  if (!endsAt) return ''
  const at = new Date(endsAt)
  if (Number.isNaN(at.getTime())) return ''
  const w = wallInTz(at, tz || DEFAULT_TZ)
  return w ? `${w.y}-${pad(w.m)}-${pad(w.d)}` : ''
}

// ─── Ближайший запуск и описание ──────────────────────────────────────

function wallLabel(w: Wall, today: Wall): string {
  const days = Math.round((Date.UTC(w.y, w.m - 1, w.d) - Date.UTC(today.y, today.m - 1, today.d)) / 86400000)
  const time = `${pad(w.h)}:${pad(w.mi)}`
  if (days === 0) return `сегодня в ${time}`
  if (days === 1) return `завтра в ${time}`
  const dow = WEEKDAY_NAMES_RU[new Date(Date.UTC(w.y, w.m - 1, w.d)).getUTCDay()]
  const year = w.y === today.y ? '' : ` ${w.y}`
  return `${dow}, ${w.d} ${MONTHS_GEN[w.m - 1]}${year}, ${time}`
}

/**
 * «Следующий запуск: завтра в 09:30 (МСК)». `null` — показывать нечего:
 * расписание не разобрано (причина видна отдельно). Если расписание уже
 * закончилось (`ends_at`) — так и пишем.
 */
export function describeNextRun(
  cron: string,
  tz: string | undefined,
  endsAt?: string | null,
  now: Date = new Date(),
): string | null {
  const spec = parseCron(cron)
  const zone = tz || DEFAULT_TZ
  const today = wallInTz(now, zone)
  if (!spec || !today) return null
  const next = nextFire(spec, today)
  const label = tzShortLabel(zone)
  if (!next) return 'Запусков по этому расписанию не будет'
  if (endsAt) {
    const end = wallInTz(new Date(endsAt), zone)
    if (end && wallMinutes(next) > wallMinutes(end)) return 'Расписание закончилось — запусков больше не будет'
  }
  return `Следующий запуск: ${wallLabel(next, today)} (${label})`
}

/** «По будням в 09:30», «Раз в месяц, 15-го числа в 09:00»; нестандартный cron — как есть. */
export function describeSchedule(cron: string | undefined, tz?: string): string {
  const c = (cron ?? '').trim()
  if (!c) return 'Расписание не задано'
  const p = partsFromCron(c)
  const zone = tzShortLabel(tz)
  if (!p) return `Расписание «${c}» (${zone})`
  switch (p.frequency) {
    case 'daily':
      return `Каждый день в ${p.time} (${zone})`
    case 'weekdays':
      return `По будням в ${p.time} (${zone})`
    case 'weekly':
      return p.days.length === 1
        ? `По ${WEEKDAY_ON_DAY[p.days[0]! - 1]} в ${p.time} (${zone})`
        : `По ${p.days.map((d) => WEEKDAY_LOWER[d - 1]).join(', ')} в ${p.time} (${zone})`
    case 'monthly':
      return `Раз в месяц, ${p.monthDay}-го числа в ${p.time} (${zone})`
    default:
      return `Расписание «${c}» (${zone})`
  }
}
