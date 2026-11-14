// Оболочка карточки записи — единый стандарт для проекта, лида, ФМ и записей
// форм (макет согласован владельцем 14.10.2026; перенесена из портала
// 14.11.2026, чтобы АХО и другие модули брали ту же карточку, а не её копию):
//   • шапка: путь, название, номер, строка показателей, «Открыть в Pyrus»,
//     меню «⋯», полоса стадий;
//   • тело 50 на 50: слева лента, справа поля; без горизонтальной прокрутки —
//     на узком экране панели встают друг под другом, на телефоне — вкладки.
// Стили — на именах ui-tokens/bridge.css: модулю нужен этот файл.
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'

import { Icon } from '../list/Icon.js'
import type { TabSpec } from '../tabs/Tabs.js'
import { ActionsMenu, type MenuEntry } from './ActionsMenu.js'
import { RecordTabPanel, RecordTabs } from './RecordTabs.js'
import s from './record.module.css'

export type Crumb = { label: string; onClick?: () => void }
export type Kpi = { label: string; value: ReactNode }
/**
 * Стадия полосы. `group` — категория статуса, как в Битрикс24 (лиды): стадии
 * отказа уходят из полосы в один сегмент «Отказ ▾» с выбором причины.
 */
export type Stage = {
  value: string
  label: string
  group?: 'incoming' | 'work' | 'success' | 'fail'
  /** Цвет статуса из палитры колонок доски (data-lead-color); нет — цвет категории. */
  color?: string
}

export type PaneSpec = {
  /** Подпись панели для чтеца экрана и вкладки на телефоне. */
  label: string
  tabs: TabSpec[]
  initialTab?: string
  render: (tab: string) => ReactNode
  /**
   * Вкладки, которые не размонтируются при переключении, а прячутся: у
   * «Полей» так живёт открытая правка — уход на «Команду» и обратно её не теряет.
   */
  keepMounted?: string[]
  /**
   * Вкладки, которые сами прокручивают своё содержимое (чат: лента крутится,
   * поле ввода остаётся внизу). Остальные прокручивает панель.
   */
  selfScroll?: string[]
  /**
   * Шапка колонки вместо вкладок (лента карточки: фильтры «Всё · Сообщения ·
   * Изменения · Файлы»). Тогда рисуется только первая вкладка из tabs.
   */
  head?: ReactNode
  /**
   * Справа в шапке, в строке вкладок, — для открытой вкладки (поиск поля у
   * «Полей»). Пусто — шапка только из вкладок.
   */
  headAside?: (tab: string) => ReactNode
  /**
   * Колонка без шапки и вкладок: содержимое рисует всё само (лента карточки —
   * своя полоса вкладок-фильтров, лента и поле ввода, как в макете).
   */
  bare?: boolean
}

/** Пункт меню причин отказа — для `failMenu` хоста. */
export type FailMenuItem = {
  label: string
  /** Подпись группы над пунктом («Причина отказа»). */
  section?: string
  checked: boolean
  onClick: () => void
}

export type RecordCardProps = {
  crumbs: Crumb[]
  title: string
  /** «Pyrus 301043446» — номер задачи. */
  idLabel?: string
  kpis?: Kpi[]
  pyrusUrl?: string
  menu?: MenuEntry[]
  stages?: Stage[]
  stage?: string
  /** Нет обработчика — полоса только показывает стадию. */
  onStage?: (value: string) => void
  /** Справа в строке пути: пометка «в разработке», ссылка на старую карточку. */
  headerAside?: ReactNode
  /** Под шапкой, над стадиями: подсказка карточки («Возможный дубль» у лида). */
  notice?: ReactNode
  /**
   * Меню «Спросить ИИ» в шапке: пункты собирает хост (пресеты вопросов и
   * «Открыть панель» — у портала из WH24 Brain). Пусто — кнопки нет.
   */
  aiMenu?: MenuEntry[]
  /** Значок кнопки «Спросить ИИ»; по умолчанию — Icon «sparkles». */
  aiIcon?: ReactNode
  /**
   * Свои значки шапки («Открыть в Pyrus», стрелка сегмента «Отказ»): хост со
   * своим набором значков подставляет их, чтобы вид не менялся.
   */
  icons?: { external?: ReactNode; chevron?: ReactNode }
  /**
   * Меню причин отказа: стадии группы `fail` уходят из полосы в один сегмент
   * «Отказ ▾», а список причин рисует хост своим всплывающим меню (обёртка
   * должна быть одним элементом — ячейкой полосы). Нет — стадии отказа стоят
   * в полосе обычными сегментами.
   */
  failMenu?: (p: { items: FailMenuItem[]; trigger: (open: () => void) => ReactNode }) => ReactNode
  /** Нет — карточка без ленты («Включить чат» выключен у формы): только поля. */
  left?: PaneSpec
  right: PaneSpec
  /** Какая панель открыта на телефоне сначала. */
  mobileInitial?: 'left' | 'right'
}

function Pane({
  spec,
  idPrefix,
  hidden,
  domId,
}: {
  spec: PaneSpec
  idPrefix: string
  hidden: boolean
  domId: string
}) {
  const [tab, setTab] = useState(spec.initialTab ?? spec.tabs[0]?.id ?? '')
  // Вкладку могли убрать (например, «Задачи» не для всех) — откатываемся на первую.
  const current = spec.tabs.some((t) => t.id === tab) ? tab : (spec.tabs[0]?.id ?? '')
  // Однажды открытые «неразмонтируемые» вкладки держим в дереве.
  const [visited, setVisited] = useState<Set<string>>(() => new Set([current]))
  if (!visited.has(current)) setVisited(new Set(visited).add(current))
  const kept = (spec.keepMounted ?? []).filter((id) => id !== current && visited.has(id))
  const bodyClass = (id: string) =>
    (spec.selfScroll ?? []).includes(id) ? s.paneFill : s.paneScroll
  if (spec.bare)
    return (
      <section
        id={domId}
        aria-label={spec.label}
        className={`${s.pane}${hidden ? ` ${s.paneHidden}` : ''}`}
      >
        <div className={bodyClass(current)}>{spec.render(current)}</div>
      </section>
    )
  if (spec.head !== undefined)
    return (
      <section
        id={domId}
        aria-label={spec.label}
        className={`${s.pane}${hidden ? ` ${s.paneHidden}` : ''}`}
      >
        <div className={s.paneHead}>{spec.head}</div>
        <div className={bodyClass(current)}>{spec.render(current)}</div>
      </section>
    )
  return (
    <section
      id={domId}
      aria-label={spec.label}
      className={`${s.pane}${hidden ? ` ${s.paneHidden}` : ''}`}
    >
      <div className={s.paneHead}>
        <RecordTabs
          tabs={spec.tabs}
          value={current}
          onChange={setTab}
          ariaLabel={spec.label}
          idPrefix={idPrefix}
        />
        {spec.headAside?.(current)}
      </div>
      {spec.tabs.map((t) =>
        t.id === current || kept.includes(t.id) ? (
          <RecordTabPanel
            key={t.id}
            idPrefix={idPrefix}
            id={t.id}
            hidden={t.id !== current}
            className={bodyClass(t.id)}
          >
            {spec.render(t.id)}
          </RecordTabPanel>
        ) : null,
      )}
    </section>
  )
}

/**
 * Высота тела карточки на широком экране: от его верха до низа окна. Чат и
 * поля прокручиваются каждый сам по себе (владелец, 14.10.2026), поэтому тело
 * не должно расти вместе с содержимым. На узком экране (≤ 900px) — обычная
 * прокрутка страницы: колонки стоят друг под другом.
 */
function usePaneHeight(ref: RefObject<HTMLDivElement | null>): number {
  const [h, setH] = useState(0)
  useLayoutEffect(() => {
    const calc = () => {
      const el = ref.current
      if (!el || typeof window === 'undefined' || window.innerWidth <= 900) {
        setH(0)
        return
      }
      const top = el.getBoundingClientRect().top + window.scrollY
      setH(Math.max(480, Math.round(window.innerHeight - top - 8)))
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [ref])
  return h
}

export function RecordCard(props: RecordCardProps) {
  const { crumbs, title, idLabel, kpis, pyrusUrl, menu, stages, stage, onStage, aiMenu, failMenu } = props
  const [mobile, setMobile] = useState<'left' | 'right'>(
    props.left ? (props.mobileInitial ?? 'left') : 'right',
  )
  // Стадии отказа — не в полосе, а в сегменте «Отказ ▾» в её конце. Лид в отказе:
  // полоса серая (ни пройденных, ни текущей), сегмент — красный с причиной.
  const flow = failMenu ? (stages ?? []).filter((st) => st.group !== 'fail') : (stages ?? [])
  const fails = failMenu ? (stages ?? []).filter((st) => st.group === 'fail') : []
  const failedStage = fails.find((st) => st.value === stage)
  const failed = Boolean(failedStage)
  const failedLabel = failedStage?.label ?? ''
  const stageIdx = flow.findIndex((st) => st.value === stage)
  // Полоса стадий прокручивается вбок: текущая стадия — в поле зрения, колесо
  // мыши листает полосу, а не страницу.
  const stagesRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const nav = stagesRef.current
    const active = nav?.querySelector<HTMLElement>("[aria-current='step']")
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return
    nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2
  }, [stageIdx])
  useEffect(() => {
    const nav = stagesRef.current
    if (!nav) return
    const onWheel = (e: WheelEvent) => {
      if (nav.scrollWidth <= nav.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      e.preventDefault()
      nav.scrollLeft += e.deltaY
    }
    nav.addEventListener('wheel', onWheel, { passive: false })
    return () => nav.removeEventListener('wheel', onWheel)
  }, [stages?.length])
  const bodyRef = useRef<HTMLDivElement>(null)
  const bodyHeight = usePaneHeight(bodyRef)

  return (
    <div className={s.card}>
      <header className={s.header}>
        <nav aria-label="Путь" className={s.crumbs}>
          {crumbs.map((c, i) => (
            <Fragment key={`${c.label}-${i}`}>
              {i > 0 && <span aria-hidden="true">/</span>}
              {c.onClick ? (
                <button type="button" className={s.crumbLink} onClick={c.onClick}>
                  {c.label}
                </button>
              ) : (
                <span aria-current={i === crumbs.length - 1 ? 'page' : undefined}>{c.label}</span>
              )}
            </Fragment>
          ))}
          {props.headerAside && <span className={s.devMark}>{props.headerAside}</span>}
        </nav>
        <div className={s.headRow}>
          <div className={s.headMain}>
            <div className={s.titleRow}>
              <h1 className={s.title}>{title}</h1>
              {idLabel && <span className={s.idChip}>{idLabel}</span>}
            </div>
            {kpis && kpis.length > 0 && (
              <div className={s.kpis}>
                {kpis.map((k) => (
                  <span key={k.label}>
                    {k.label}: <b>{k.value}</b>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className={s.headActions}>
            {pyrusUrl && (
              <a className={s.btn} href={pyrusUrl} target="_blank" rel="noopener noreferrer">
                {props.icons?.external ?? <Icon name="external" size={14} />}
                Открыть в Pyrus
              </a>
            )}
            {aiMenu && aiMenu.length > 0 && (
              <ActionsMenu
                items={aiMenu}
                label="Спросить ИИ"
                icon={props.aiIcon ?? <Icon name="sparkles" size={16} />}
              />
            )}
            {menu && <ActionsMenu items={menu} />}
          </div>
        </div>
        {props.notice}
        {stages && stages.length > 0 && (
          <nav aria-label="Стадия" className={s.stages} ref={stagesRef}>
            {flow.map((st, i) => {
              const cls = i === stageIdx ? s.stageActive : i < stageIdx ? s.stageDone : ''
              return (
                <button
                  key={st.value}
                  type="button"
                  className={`${s.stage}${cls ? ` ${cls}` : ''}`}
                  data-group={st.group}
                  data-lead-color={st.color || undefined}
                  aria-current={i === stageIdx ? 'step' : undefined}
                  disabled={!onStage}
                  title={st.label}
                  onClick={() => onStage && i !== stageIdx && onStage(st.value)}
                >
                  {st.label}
                </button>
              )
            })}
            {failMenu &&
              fails.length > 0 &&
              failMenu({
                items: fails.map((st, i) => ({
                  label: st.label,
                  section: i === 0 ? 'Причина отказа' : undefined,
                  checked: st.value === stage,
                  onClick: () => onStage && st.value !== stage && onStage(st.value),
                })),
                trigger: (open) => (
                  <button
                    type="button"
                    className={`${s.stage} ${s.stageFail}${failed ? ` ${s.stageActive}` : ''}`}
                    data-lead-color={(failed && failedStage?.color) || undefined}
                    aria-current={failed ? 'step' : undefined}
                    aria-haspopup="menu"
                    disabled={!onStage}
                    title={failed ? `Отказ: ${failedLabel}` : 'Отказ — выбрать причину'}
                    onClick={open}
                  >
                    {failed ? `Отказ: ${failedLabel}` : 'Отказ'}
                    {props.icons?.chevron ?? <Icon name="chevdown_sm" size={12} />}
                  </button>
                ),
              })}
          </nav>
        )}
      </header>

      {props.left && (
        <RecordTabs
          className={s.mobileTabs}
          tabs={[
            { id: 'left', label: props.left.label },
            { id: 'right', label: props.right.label },
          ]}
          value={mobile}
          onChange={(v) => setMobile(v as 'left' | 'right')}
          ariaLabel="Разделы карточки"
          idPrefix="record-mobile"
        />
      )}

      <div
        ref={bodyRef}
        className={`${s.body}${bodyHeight ? ` ${s.bodyFixed}` : ''}`}
        style={bodyHeight ? { height: bodyHeight } : undefined}
      >
        {props.left && (
          <Pane
            spec={props.left}
            idPrefix="record-left"
            domId="record-mobile-panel-left"
            hidden={mobile !== 'left'}
          />
        )}
        <Pane
          spec={props.right}
          idPrefix="record-right"
          domId="record-mobile-panel-right"
          hidden={mobile !== 'right'}
        />
      </div>
    </div>
  )
}
