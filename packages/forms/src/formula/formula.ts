/**
 * Формулы поля «Формула» — TS-порт internal/formula из wh24-forms-api.
 *
 * Грамматика, семантика и фикстуры (fixtures/*.json — копия Go testdata)
 * общие: сервер считает формулу при сохранении и хранит в data, клиент
 * показывает то же значение вживую при вводе. Отличие результата здесь и там —
 * ошибка, ловится общим набором фикстур.
 *
 * Два вида ошибок намеренно разведены: FormulaParseError — опечатка автора
 * формы (блокер публикации, текст показывается в редакторе); ошибка
 * вычисления — ситуация записи, evaluateFormula возвращает null.
 */

import type { Field, FormulaConfig, FormulaResult, RecordData, SchemaDocument, TableConfig } from '../types.js'
import { isComputedField } from '../types.js'
import { todayMsk } from '../conditions/conditions.js'
import { fieldVisibility } from '../conditions/visibility.js'

export class FormulaParseError extends Error {
  pos: number
  constructor(pos: number, msg: string) {
    super(msg)
    this.name = 'FormulaParseError'
    this.pos = pos
  }
}

export interface FormulaRef {
  key: string
  col?: string
}

export interface FunctionDoc {
  name: string
  signature: string
  help: string
}

/** Все функции формул, в порядке показа в редакторе (formula.Functions в Go). */
export const FORMULA_FUNCTIONS: ReadonlyArray<FunctionDoc> = [
  { name: 'IF', signature: 'IF(условие, если_да, если_нет)', help: 'Выбор по условию: IF({sum} > 100000, "крупная", "обычная")' },
  { name: 'ROUND', signature: 'ROUND(число, знаков)', help: 'Округление; знаков можно не указывать — до целого' },
  { name: 'ABS', signature: 'ABS(число)', help: 'Число без знака' },
  { name: 'MIN', signature: 'MIN(a, b, …)', help: 'Наименьшее из значений или колонки таблицы; пустые не считаются' },
  { name: 'MAX', signature: 'MAX(a, b, …)', help: 'Наибольшее из значений или колонки таблицы; пустые не считаются' },
  { name: 'SUM', signature: 'SUM({таблица.колонка}, …)', help: 'Сумма значений или колонки таблицы; пустые — как 0' },
  { name: 'COUNT', signature: 'COUNT({таблица.колонка}, …)', help: 'Сколько значений заполнено' },
  { name: 'DAYS', signature: 'DAYS(дата1, дата2)', help: 'Дней от дата2 до дата1: DAYS({due}, TODAY())' },
  { name: 'TODAY', signature: 'TODAY()', help: 'Сегодняшняя дата' },
  { name: 'CONCAT', signature: 'CONCAT(a, b, …)', help: 'Склеить в текст: CONCAT({last}, " ", {first})' },
  { name: 'LEN', signature: 'LEN(текст)', help: 'Длина текста в символах' },
]

// ---------------------------------------------------------------- лексер

type TokKind = 'eof' | 'num' | 'str' | 'ref' | 'ident' | 'op'
interface Token {
  kind: TokKind
  text: string
  pos: number
}

const isDigit = (c: string) => c >= '0' && c <= '9'
const isIdentStart = (c: string) => c === '_' || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
const isIdentPart = (c: string) => isIdentStart(c) || isDigit(c)

function validRef(s: string): boolean {
  const parts = s.split('.')
  if (parts.length > 2) return false
  return parts.every((p) => p.length > 0 && Array.from(p).every(isIdentPart))
}

function lex(src: string): Token[] {
  const out: Token[] = []
  const r = Array.from(src)
  const at = (k: number): string => r[k] ?? ''
  let i = 0
  while (i < r.length) {
    const c = at(i)
    if (/\s/.test(c)) {
      i++
    } else if (isDigit(c)) {
      const start = i
      while (i < r.length && isDigit(at(i))) i++
      if (i < r.length && at(i) === '.' && i + 1 < r.length && isDigit(at(i + 1))) {
        i++
        while (i < r.length && isDigit(at(i))) i++
      }
      out.push({ kind: 'num', text: r.slice(start, i).join(''), pos: start })
    } else if (c === '"' || c === "'") {
      const start = i
      i++
      while (i < r.length && at(i) !== c) i++
      if (i >= r.length) throw new FormulaParseError(start, 'незакрытая кавычка')
      out.push({ kind: 'str', text: r.slice(start + 1, i).join(''), pos: start })
      i++
    } else if (c === '{') {
      const start = i
      i++
      while (i < r.length && at(i) !== '}') i++
      if (i >= r.length) throw new FormulaParseError(start, 'ссылка на поле не закрыта: нужна «}»')
      const ref = r.slice(start + 1, i).join('').trim()
      if (!validRef(ref))
        throw new FormulaParseError(start, `ссылка «{${ref}}»: ключ поля — латиница, цифры и «_», колонка таблицы — через точку`)
      out.push({ kind: 'ref', text: ref, pos: start })
      i++
    } else if (isIdentStart(c)) {
      const start = i
      while (i < r.length && isIdentPart(at(i))) i++
      out.push({ kind: 'ident', text: r.slice(start, i).join(''), pos: start })
    } else if (c === '<' && i + 1 < r.length && (at(i + 1) === '=' || at(i + 1) === '>')) {
      out.push({ kind: 'op', text: c + at(i + 1), pos: i })
      i += 2
    } else if (c === '>' && i + 1 < r.length && at(i + 1) === '=') {
      out.push({ kind: 'op', text: '>=', pos: i })
      i += 2
    } else if ('+-*/(),=<>'.includes(c)) {
      out.push({ kind: 'op', text: c, pos: i })
      i++
    } else {
      throw new FormulaParseError(i, `неожиданный символ «${c}»`)
    }
  }
  out.push({ kind: 'eof', text: '', pos: r.length })
  return out
}

// ---------------------------------------------------------------- парсер

type Node =
  | { kind: 'num'; value: number }
  | { kind: 'str'; value: string }
  | { kind: 'ref'; ref: FormulaRef }
  | { kind: 'neg'; arg: Node }
  | { kind: 'bin'; op: string; left: Node; right: Node }
  | { kind: 'call'; fn: string; args: Node[] }

export interface FormulaExpr {
  root: Node
  refs: FormulaRef[]
}

const ARITY: Record<string, [number, number]> = {
  IF: [3, 3], ROUND: [1, 2], ABS: [1, 1], LEN: [1, 1], DAYS: [2, 2], TODAY: [0, 0],
  MIN: [1, -1], MAX: [1, -1], SUM: [1, -1], COUNT: [1, -1], CONCAT: [1, -1],
}
const AGGREGATES = new Set(['SUM', 'COUNT', 'MIN', 'MAX'])
/** Предел вложенности скобок и вызовов — как в Go (formula.maxDepth): защита от формулы-«бомбы». */
const MAX_DEPTH = 64

function arityText([min, max]: [number, number]): string {
  if (max < 0) return `нужен хотя бы ${min} аргумент`
  if (min === max && min === 0) return 'аргументов не принимает'
  if (min === max) return `нужно аргументов: ${min}`
  return `нужно аргументов: от ${min} до ${max}`
}

class Parser {
  i = 0
  depth = 0
  constructor(private toks: Token[]) {}
  peek(): Token {
    return this.toks[this.i] ?? this.toks[this.toks.length - 1]!
  }
  next(): Token {
    const t = this.peek()
    this.i++
    return t
  }
  isOp(...ops: string[]): boolean {
    const t = this.peek()
    return t.kind === 'op' && ops.includes(t.text)
  }
  compare(): Node {
    this.depth++
    try {
      if (this.depth > MAX_DEPTH)
        throw new FormulaParseError(this.peek().pos, `слишком сложная формула: больше ${MAX_DEPTH} уровней вложенности`)
      let left = this.additive()
      if (this.isOp('=', '<>', '<', '<=', '>', '>=')) {
        const op = this.next().text
        left = { kind: 'bin', op, left, right: this.additive() }
      }
      return left
    } finally {
      this.depth--
    }
  }
  additive(): Node {
    let left = this.mult()
    while (this.isOp('+', '-')) {
      const op = this.next().text
      left = { kind: 'bin', op, left, right: this.mult() }
    }
    return left
  }
  mult(): Node {
    let left = this.unary()
    while (this.isOp('*', '/')) {
      const op = this.next().text
      left = { kind: 'bin', op, left, right: this.unary() }
    }
    return left
  }
  unary(): Node {
    if (this.isOp('-')) {
      this.next()
      return { kind: 'neg', arg: this.unary() }
    }
    return this.primary()
  }
  primary(): Node {
    const t = this.next()
    switch (t.kind) {
      case 'num':
        return { kind: 'num', value: Number(t.text) }
      case 'str':
        return { kind: 'str', value: t.text }
      case 'ref': {
        if (t.text.includes('.'))
          throw new FormulaParseError(t.pos, `«{${t.text}}» — колонку таблицы можно использовать только внутри SUM, COUNT, MIN, MAX`)
        return { kind: 'ref', ref: { key: t.text } }
      }
      case 'ident':
        return this.call(t)
      case 'op':
        if (t.text === '(') {
          const inner = this.compare()
          if (!this.isOp(')')) throw new FormulaParseError(this.peek().pos, 'не закрыта скобка «(»')
          this.next()
          return inner
        }
        throw new FormulaParseError(t.pos, `неожиданный символ «${t.text}»`)
      default:
        throw new FormulaParseError(t.pos, 'неожиданный конец формулы')
    }
  }
  call(name: Token): Node {
    const fn = name.text.toUpperCase()
    const ar = ARITY[fn]
    if (!ar) throw new FormulaParseError(name.pos, `неизвестная функция «${name.text}»`)
    if (!this.isOp('(')) throw new FormulaParseError(this.peek().pos, `после «${name.text}» нужна скобка «(»`)
    this.next()
    const args: Node[] = []
    if (!this.isOp(')')) {
      for (;;) {
        const t = this.peek()
        if (t.kind === 'ref' && t.text.includes('.') && AGGREGATES.has(fn)) {
          this.next()
          const dot = t.text.indexOf('.')
          args.push({ kind: 'ref', ref: { key: t.text.slice(0, dot), col: t.text.slice(dot + 1) } })
        } else {
          args.push(this.compare())
        }
        if (this.isOp(',')) {
          this.next()
          continue
        }
        break
      }
    }
    if (!this.isOp(')')) throw new FormulaParseError(this.peek().pos, `не закрыта скобка «(» у ${fn}`)
    this.next()
    if (args.length < ar[0] || (ar[1] >= 0 && args.length > ar[1]))
      throw new FormulaParseError(name.pos, `${fn}: ${arityText(ar)}`)
    return { kind: 'call', fn, args }
  }
}

function collectRefs(n: Node, out: FormulaRef[]): void {
  if (n.kind === 'ref') {
    if (!out.some((r) => r.key === n.ref.key && r.col === n.ref.col)) out.push(n.ref)
  } else if (n.kind === 'neg') collectRefs(n.arg, out)
  else if (n.kind === 'bin') {
    collectRefs(n.left, out)
    collectRefs(n.right, out)
  } else if (n.kind === 'call') n.args.forEach((a) => collectRefs(a, out))
}

/** Разбор формулы; бросает FormulaParseError с текстом по-русски. */
export function parseFormula(src: string): FormulaExpr {
  const toks = lex(src)
  const p = new Parser(toks)
  if (p.peek().kind === 'eof') throw new FormulaParseError(0, 'формула пуста')
  const root = p.compare()
  const t = p.peek()
  if (t.kind !== 'eof') throw new FormulaParseError(t.pos, `лишнее «${t.text}» после конца выражения`)
  const refs: FormulaRef[] = []
  collectRefs(root, refs)
  return { root, refs }
}

/** Уникальные ссылки на поля в порядке появления. */
export function formulaRefs(e: FormulaExpr): FormulaRef[] {
  return e.refs.map((r) => (r.col ? { key: r.key, col: r.col } : { key: r.key }))
}

// ---------------------------------------------------------------- вычислитель

class EvalError extends Error {}

/** Дата внутри вычислителя: номер календарного дня по Москве. */
class DateVal {
  constructor(public day: number) {}
  toString(): string {
    return new Date(this.day * 86400000).toISOString().slice(0, 10)
  }
}
class ColumnList {
  constructor(public items: unknown[]) {}
}

const MSK_OFFSET_MS = 3 * 60 * 60 * 1000

function parseDate(s: string): DateVal | null {
  const t = s.trim()
  if (t.length === 10) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null
    const d = new Date(`${t}T00:00:00Z`)
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== t) return null
    return new DateVal(Math.floor(d.getTime() / 86400000))
  }
  // Дата-время — только с зоной (RFC 3339), как в Go: без зоны Date.parse
  // взял бы часовой пояс браузера.
  if (t.length > 10 && t[4] === '-' && t[7] === '-' && /(Z|[+-]\d{2}:\d{2})$/.test(t)) {
    const ms = Date.parse(t)
    if (Number.isNaN(ms)) return null
    return new DateVal(Math.floor((ms + MSK_OFFSET_MS) / 86400000))
  }
  return null
}

function normalize(v: unknown): unknown {
  if (v === null || v === undefined) return null
  if (typeof v === 'string') {
    const d = parseDate(v)
    if (d) return d
    return v.trim() === '' ? null : v
  }
  return v
}

function column(table: unknown, col: string): ColumnList {
  if (!Array.isArray(table)) return new ColumnList([])
  const out: unknown[] = []
  for (const row of table) {
    if (row && typeof row === 'object' && !Array.isArray(row)) out.push(normalize((row as Record<string, unknown>)[col]))
  }
  return new ColumnList(out)
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.trim() === ''
  if (v instanceof ColumnList) return v.items.length === 0
  return false
}

function num(v: unknown): number {
  if (v === null || v === undefined) return 0
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'string') {
    const s = v.trim().replace(/,/g, '.')
    if (s === '') return 0
    const f = Number(s)
    if (!Number.isFinite(f) || !/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) throw new EvalError(`«${v}» — не число`)
    return f
  }
  if (v instanceof DateVal) throw new EvalError('дата вместо числа')
  throw new EvalError('значение не число')
}

function numeric(v: unknown): number | null {
  if (typeof v === 'number' || typeof v === 'boolean') return num(v)
  if (typeof v === 'string') {
    try {
      return num(v)
    } catch {
      return null
    }
  }
  return null
}

function text(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? 'да' : 'нет'
  if (v instanceof DateVal) return v.toString()
  if (v instanceof ColumnList) return v.items.map(text).join(', ')
  return String(v)
}

function truthy(v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') return v.trim() !== ''
  if (v instanceof ColumnList) return v.items.length > 0
  return true
}

function arith(op: string, a: unknown, b: unknown): number {
  const x = num(a)
  const y = num(b)
  switch (op) {
    case '+':
      return x + y
    case '-':
      return x - y
    case '*':
      return x * y
    default:
      if (y === 0) throw new EvalError('деление на ноль')
      return x / y
  }
}

function cmpResult(op: string, cmp: number): boolean {
  switch (op) {
    case '=':
      return cmp === 0
    case '<>':
      return cmp !== 0
    case '<':
      return cmp < 0
    case '<=':
      return cmp <= 0
    case '>':
      return cmp > 0
    case '>=':
      return cmp >= 0
    default:
      return false
  }
}

const fold = (s: string) => s.trim().toLowerCase()
const strcmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

function compare(op: string, a: unknown, b: unknown): boolean {
  const ea = isEmpty(a)
  const eb = isEmpty(b)
  if (ea || eb) {
    if (op === '=') return ea && eb
    if (op === '<>') return !(ea && eb)
    return false
  }
  let cmp: number
  if (a instanceof DateVal && b instanceof DateVal) cmp = a.day - b.day
  else {
    const x = numeric(a)
    const y = x === null ? null : numeric(b)
    if (x !== null && y !== null) cmp = x < y ? -1 : x > y ? 1 : 0
    else if (x !== null) {
      // Число против не-числа — как строки, «=»/«<>» без регистра (как в Go).
      let sa = text(a)
      let sb = text(b)
      if (op === '=' || op === '<>') {
        sa = fold(sa)
        sb = fold(sb)
      }
      cmp = strcmp(sa, sb)
    } else {
      let sa = text(a)
      let sb = text(b)
      if (op === '=' || op === '<>') {
        sa = fold(sa)
        sb = fold(sb)
      }
      cmp = strcmp(sa, sb)
    }
  }
  return cmpResult(op, cmp)
}

function binary(op: string, a: unknown, b: unknown): unknown {
  if (op === '+') {
    if (a instanceof DateVal) return new DateVal(a.day + Math.trunc(num(b)))
    if (b instanceof DateVal) return new DateVal(b.day + Math.trunc(num(a)))
    return arith(op, a, b)
  }
  if (op === '-') {
    if (a instanceof DateVal && b instanceof DateVal) return a.day - b.day
    if (a instanceof DateVal) return new DateVal(a.day - Math.trunc(num(b)))
    return arith(op, a, b)
  }
  if (op === '*' || op === '/') return arith(op, a, b)
  return compare(op, a, b)
}

function flatten(args: unknown[]): unknown[] {
  const out: unknown[] = []
  for (const a of args) {
    if (a instanceof ColumnList) out.push(...a.items)
    else out.push(a)
  }
  return out
}

interface Env {
  today: DateVal
}

function evalNode(n: Node, values: Record<string, unknown>, env: Env): unknown {
  switch (n.kind) {
    case 'num':
      return n.value
    case 'str':
      return normalize(n.value)
    case 'ref':
      return n.ref.col ? column(values[n.ref.key], n.ref.col) : normalize(values[n.ref.key])
    case 'neg':
      return -num(evalNode(n.arg, values, env))
    case 'bin':
      return binary(n.op, evalNode(n.left, values, env), evalNode(n.right, values, env))
    case 'call':
      return call(n, values, env)
  }
}

function call(n: Extract<Node, { kind: 'call' }>, values: Record<string, unknown>, env: Env): unknown {
  if (n.fn === 'IF') {
    const [c, a, b] = n.args as [Node, Node, Node]
    return truthy(evalNode(c, values, env)) ? evalNode(a, values, env) : evalNode(b, values, env)
  }
  const args = n.args.map((a) => evalNode(a, values, env))
  switch (n.fn) {
    case 'ROUND': {
      const x = num(args[0])
      const digits = args.length === 2 ? Math.trunc(num(args[1])) : 0
      const p = Math.pow(10, digits)
      // Половина — от нуля; 1e-9 гасит двоичную погрешность (как в Go).
      return (Math.sign(x) * Math.round(Math.abs(x) * p + 1e-9)) / p
    }
    case 'ABS':
      return Math.abs(num(args[0]))
    case 'LEN':
      return Array.from(text(args[0])).length
    case 'DAYS': {
      const a = args[0]
      const b = args[1]
      if (!(a instanceof DateVal) || !(b instanceof DateVal)) throw new EvalError('DAYS: нужны две даты')
      return a.day - b.day
    }
    case 'TODAY':
      return env.today
    case 'CONCAT':
      return args.map(text).join('')
    case 'SUM':
      return flatten(args).reduce<number>((s, a) => s + num(a), 0)
    case 'COUNT':
      return flatten(args).filter((a) => !isEmpty(a)).length
    case 'MIN':
    case 'MAX': {
      let best: number | null = null
      for (const a of flatten(args)) {
        if (isEmpty(a)) continue
        const x = num(a)
        if (best === null || (n.fn === 'MIN' ? x < best : x > best)) best = x
      }
      return best
    }
    default:
      throw new EvalError(`неизвестная функция ${n.fn}`)
  }
}

function cast(v: unknown, result: FormulaResult): unknown {
  if (isEmpty(v)) return null
  switch (result) {
    case 'number':
    case 'money': {
      if (v instanceof DateVal) throw new EvalError('дата вместо числа')
      const f = num(v)
      if (!Number.isFinite(f)) throw new EvalError('число не определено')
      // -0 → 0, чтобы toBe/JSON не различали.
      return f === 0 ? 0 : f
    }
    case 'text':
      return text(v)
    case 'date':
      if (v instanceof DateVal) return v.toString()
      throw new EvalError('результат не дата')
    default:
      throw new EvalError(`неизвестный тип результата ${String(result)}`)
  }
}

/**
 * Вычисление по значениям полей ПО КЛЮЧАМ (см. formulaScope). Ошибка
 * вычисления → null (как пусто), паник на любых данных не бывает.
 */
export function evaluateFormula(
  e: FormulaExpr,
  values: Record<string, unknown>,
  result: FormulaResult,
  env: { today?: string } = {},
): unknown {
  const today = parseDate(env.today ?? todayMsk()) ?? new DateVal(Math.floor(Date.now() / 86400000))
  try {
    return cast(evalNode(e.root, values, { today }), result)
  } catch (err) {
    if (err instanceof EvalError) return null
    throw err
  }
}

// ---------------------------------------------------------------- область и порядок (schema.FormulaScope / FormulaOrder)

const SCOPE_EXCLUDED = new Set<string>(['section', 'note', 'file', 'contact', 'lookup', 'formula'])

/**
 * Значения записи по ключам полей; таблица — строки с ключами колонок. Поле,
 * скрытое условием показа, для формулы пусто (как для валидатора и зависимых
 * условий): в data могло остаться старое значение, которого пользователь не видит.
 */
export function formulaScope(doc: SchemaDocument, values: RecordData): Record<string, unknown> {
  const visible = fieldVisibility(doc.fields, values)
  const scope: Record<string, unknown> = {}
  for (const f of doc.fields) {
    if (f.archived || !f.key || isComputedField(f) || SCOPE_EXCLUDED.has(f.type) || visible[f.id] === false) continue
    if (!Object.prototype.hasOwnProperty.call(values, f.id)) continue
    let v = values[f.id]
    if (f.type === 'table' && Array.isArray(v)) {
      const cols = (f.config as TableConfig | undefined)?.columns ?? []
      const keyOf = new Map(cols.filter((c) => c.key).map((c) => [c.id, c.key]))
      v = v
        .filter((r) => r && typeof r === 'object' && !Array.isArray(r))
        .map((r) => {
          const row: Record<string, unknown> = {}
          for (const [id, cell] of Object.entries(r as Record<string, unknown>)) {
            const k = keyOf.get(id)
            if (k) row[k] = cell
          }
          return row
        })
    }
    scope[f.key] = v
  }
  return scope
}

/** Настройки формулы поля; null — не формула или config пуст. */
export function formulaConfigOf(f: Pick<Field, 'type' | 'config'>): FormulaConfig | null {
  if (f.type !== 'formula' || !f.config) return null
  const c = f.config as Partial<FormulaConfig>
  return { expr: c.expr ?? '', result: c.result ?? 'number', currency: c.currency }
}

/** Активные формулы в порядке зависимостей; cycle — ключи зацикленных. */
export function formulaOrder(doc: SchemaDocument): { ordered: Field[]; cycle: string[] } {
  const items = new Map<string, { field: Field; deps: Set<string> }>()
  const keys: string[] = []
  for (const f of doc.fields) {
    const c = formulaConfigOf(f)
    if (!c || f.archived || !f.key) continue
    let refs: FormulaRef[]
    try {
      refs = parseFormula(c.expr).refs
    } catch {
      continue
    }
    items.set(f.key, { field: f, deps: new Set(refs.map((r) => r.key)) })
    keys.push(f.key)
  }
  for (const it of items.values()) for (const d of [...it.deps]) if (!items.has(d)) it.deps.delete(d)
  const done = new Set<string>()
  const ordered: Field[] = []
  for (let progress = true; progress; ) {
    progress = false
    for (const k of keys) {
      if (done.has(k)) continue
      const it = items.get(k)!
      if ([...it.deps].every((d) => done.has(d))) {
        done.add(k)
        ordered.push(it.field)
        progress = true
      }
    }
  }
  return { ordered, cycle: keys.filter((k) => !done.has(k)) }
}

/** id формулы → значение (null → ключа нет), как считает сервер при сохранении. */
export function computeFormulas(doc: SchemaDocument, values: RecordData, env: { today?: string } = {}): Record<string, unknown> {
  const { ordered } = formulaOrder(doc)
  const out: Record<string, unknown> = {}
  if (ordered.length === 0) return out
  const scope = formulaScope(doc, values)
  for (const f of ordered) {
    const c = formulaConfigOf(f)!
    let v: unknown = null
    try {
      v = evaluateFormula(parseFormula(c.expr), scope, c.result, env)
    } catch {
      v = null
    }
    scope[f.key] = v
    if (v !== null) out[f.id] = v
  }
  return out
}
