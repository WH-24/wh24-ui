import { describe, expect, it } from 'vitest'

import {
  cronFromParts,
  dateToEndsAt,
  describeNextRun,
  describeSchedule,
  endsAtToDate,
  partsFromCron,
  scheduleProblem,
} from './schedule'

// Пятница, 6 ноября 2026, 13:00 по Москве.
const NOW = new Date('2026-11-06T10:00:00Z')

describe('cron ⇄ человеческий ввод', () => {
  it('стандартные выражения разбираются в части', () => {
    expect(partsFromCron('30 9 * * 1-5')).toMatchObject({ frequency: 'weekdays', time: '09:30' })
    expect(partsFromCron('0 9 * * *')).toMatchObject({ frequency: 'daily', time: '09:00' })
    expect(partsFromCron('0 18 * * 1,3,5')).toMatchObject({ frequency: 'weekly', days: [1, 3, 5], time: '18:00' })
    expect(partsFromCron('0 9 * * 0')).toMatchObject({ frequency: 'weekly', days: [7] })
    expect(partsFromCron('15 8 15 * *')).toMatchObject({ frequency: 'monthly', monthDay: 15, time: '08:15' })
  })

  it('нестандартное — null («Своё расписание»)', () => {
    expect(partsFromCron('*/10 * * * *')).toBeNull()
    expect(partsFromCron('0 9 * 1 *')).toBeNull()
    expect(partsFromCron('0 9 1 * 1')).toBeNull()
    expect(partsFromCron('мусор')).toBeNull()
    expect(partsFromCron('')).toBeNull()
  })

  it('части собираются в cron и разбираются обратно', () => {
    const base = { time: '09:30', days: [1], monthDay: 1 }
    expect(cronFromParts({ ...base, frequency: 'daily' })).toBe('30 9 * * *')
    expect(cronFromParts({ ...base, frequency: 'weekdays' })).toBe('30 9 * * 1-5')
    expect(cronFromParts({ ...base, frequency: 'monthly', monthDay: 31 })).toBe('30 9 31 * *')
    const weekly = cronFromParts({ ...base, frequency: 'weekly', days: [7, 1, 3] })
    expect(weekly).toBe('30 9 * * 1,3,0')
    expect(partsFromCron(weekly)).toMatchObject({ frequency: 'weekly', days: [1, 3, 7] })
  })

  it('нельзя собрать из пустых дней, неверного времени и «своего»', () => {
    const base = { time: '09:30', days: [] as number[], monthDay: 1 }
    expect(cronFromParts({ ...base, frequency: 'weekly' })).toBe('')
    expect(cronFromParts({ ...base, frequency: 'daily', time: '25:00' })).toBe('')
    expect(cronFromParts({ ...base, frequency: 'custom' })).toBe('')
  })
})

describe('не чаще раза в 5 минут', () => {
  it('каждую минуту и чаще 5 минут — запрещено понятным текстом', () => {
    for (const cron of ['* * * * *', '*/4 * * * *', '0,2 9 * * *', '*/1 9 * * *']) {
      expect(scheduleProblem(cron)).toMatch(/чаще раза в 5 минут нельзя/)
    }
  })

  it('раз в 5 минут и реже — можно', () => {
    expect(scheduleProblem('*/5 * * * *')).toBeNull()
    expect(scheduleProblem('30 9 * * 1-5')).toBeNull()
    expect(scheduleProblem('0 9 1 * *')).toBeNull()
  })

  it('пустое и неразобранное объясняются', () => {
    expect(scheduleProblem('')).toBe('Укажите расписание')
    expect(scheduleProblem('abc')).toMatch(/не разобрано/)
    expect(scheduleProblem('61 * * * *')).toMatch(/не разобрано/)
    expect(scheduleProblem('0 9 * *')).toMatch(/не разобрано/)
  })
})

describe('ближайший запуск', () => {
  it('по будням в пятницу днём — следующий понедельник', () => {
    expect(describeNextRun('30 9 * * 1-5', 'Europe/Moscow', null, NOW)).toBe(
      'Следующий запуск: пн, 9 ноября, 09:30 (МСК)',
    )
  })

  it('сегодня и завтра называются словами', () => {
    expect(describeNextRun('0 18 * * *', 'Europe/Moscow', null, NOW)).toBe('Следующий запуск: сегодня в 18:00 (МСК)')
    expect(describeNextRun('0 9 * * *', 'Europe/Moscow', null, NOW)).toBe('Следующий запуск: завтра в 09:00 (МСК)')
  })

  it('считает в таймзоне расписания', () => {
    // В Екатеринбурге (UTC+5) сейчас 15:00 — «18:00» ещё сегодня, «14:00» уже завтра.
    expect(describeNextRun('0 18 * * *', 'Asia/Yekaterinburg', null, NOW)).toBe(
      'Следующий запуск: сегодня в 18:00 (Екатеринбург)',
    )
    expect(describeNextRun('0 14 * * *', 'Asia/Yekaterinburg', null, NOW)).toBe(
      'Следующий запуск: завтра в 14:00 (Екатеринбург)',
    )
  })

  it('раз в месяц переходит в следующий месяц, а 31-е пропускает короткие', () => {
    expect(describeNextRun('0 9 5 * *', 'Europe/Moscow', null, NOW)).toBe(
      'Следующий запуск: сб, 5 декабря, 09:00 (МСК)',
    )
    expect(describeNextRun('0 9 31 * *', 'Europe/Moscow', null, NOW)).toBe(
      'Следующий запуск: чт, 31 декабря, 09:00 (МСК)',
    )
  })

  it('после «Заканчивается» запусков не будет', () => {
    const ends = dateToEndsAt('2026-11-07', 'Europe/Moscow')
    expect(describeNextRun('30 9 * * 1-5', 'Europe/Moscow', ends, NOW)).toMatch(/закончилось/)
    const later = dateToEndsAt('2026-11-30', 'Europe/Moscow')
    expect(describeNextRun('30 9 * * 1-5', 'Europe/Moscow', later, NOW)).toMatch(/Следующий запуск/)
  })

  it('расписание, которое не разобрано, ничего не показывает', () => {
    expect(describeNextRun('abc', 'Europe/Moscow', null, NOW)).toBeNull()
  })
})

describe('«Заканчивается»: дата ⇄ RFC 3339', () => {
  it('дата — конец дня в таймзоне расписания', () => {
    expect(dateToEndsAt('2026-12-31', 'Europe/Moscow')).toBe('2026-12-31T20:59:59.000Z')
    expect(dateToEndsAt('2026-12-31', 'UTC')).toBe('2026-12-31T23:59:59.000Z')
    expect(dateToEndsAt('не дата', 'UTC')).toBeNull()
  })

  it('обратно возвращается та же дата', () => {
    for (const tz of ['Europe/Moscow', 'Asia/Vladivostok', 'UTC', 'Europe/Kaliningrad']) {
      expect(endsAtToDate(dateToEndsAt('2026-12-31', tz), tz)).toBe('2026-12-31')
    }
    expect(endsAtToDate(null, 'UTC')).toBe('')
    expect(endsAtToDate('мусор', 'UTC')).toBe('')
  })
})

describe('описание расписания', () => {
  it('человеческим текстом', () => {
    expect(describeSchedule('30 9 * * 1-5', 'Europe/Moscow')).toBe('По будням в 09:30 (МСК)')
    expect(describeSchedule('0 9 * * *')).toBe('Каждый день в 09:00 (МСК)')
    expect(describeSchedule('0 9 * * 1', 'Europe/Moscow')).toBe('По понедельникам в 09:00 (МСК)')
    expect(describeSchedule('0 9 * * 1,3,5', 'Europe/Moscow')).toBe('По пн, ср, пт в 09:00 (МСК)')
    expect(describeSchedule('0 9 15 * *', 'Asia/Omsk')).toBe('Раз в месяц, 15-го числа в 09:00 (Омск)')
  })

  it('нестандартный cron показывается как есть, пустое — «не задано»', () => {
    expect(describeSchedule('*/10 * * * *', 'UTC')).toBe('Расписание «*/10 * * * *» (UTC)')
    expect(describeSchedule('')).toBe('Расписание не задано')
  })
})
