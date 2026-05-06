import { useState } from 'react'
import {
  AppShell,
  Avatar,
  BestPracticeBadge,
  Card,
  Chip,
  ComingSoon,
  IconButton,
  MegaDropdown,
  NavTile,
  Pill,
  SortPill,
  StatBar,
  TypeBadge,
  TypeMarker,
  UtilChip,
  useTheme,
} from '@wowhaus-24/ui-react'

export function Styleguide() {
  const { theme, toggle } = useTheme()
  const [megaOpen, setMegaOpen] = useState(false)

  return (
    <div className="sg">
      <header className="sg-h">
        <div>
          <h1>WH UI · Styleguide</h1>
          <p>Live preview всех примитивов из @wowhaus-24/ui-react</p>
        </div>
        <div className="sg-controls">
          <button
            type="button"
            className={theme === 'light' ? 'sg-toggle active' : 'sg-toggle'}
            onClick={toggle}
          >
            {theme === 'dark' ? '◑ Тёмная' : '◐ Светлая'}
          </button>
        </div>
      </header>

      <Section title="TypeMarker" desc="Точка-маркер для типа статьи. С `active` — терракотовая.">
        <Row>
          <TypeMarker />
          <TypeMarker type="project" />
          <TypeMarker type="standard" />
          <TypeMarker type="solution" />
          <TypeMarker type="article" />
        </Row>
        <Label>active=true</Label>
        <Row>
          <TypeMarker active />
          <TypeMarker type="project" active />
          <TypeMarker type="standard" active />
          <TypeMarker type="solution" active />
          <TypeMarker type="article" active />
        </Row>
      </Section>

      <Section title="TypeBadge" desc="Текстовая плашка типа.">
        <Row>
          <TypeBadge type="project" />
          <TypeBadge type="standard" />
          <TypeBadge type="solution" />
          <TypeBadge type="article" />
          <TypeBadge type="project" label="Проект (custom)" />
        </Row>
      </Section>

      <Section title="BestPracticeBadge" desc="Терракотовая плашка с белым ромбом.">
        <Row>
          <BestPracticeBadge />
          <BestPracticeBadge label="Best practice · 5 эталонов" />
        </Row>
      </Section>

      <Section title="Chip" desc="Pill-чип, опциональная remove-кнопка.">
        <Row>
          <Chip>concrete</Chip>
          <Chip variant="tag">фасад</Chip>
          <Chip onRemove={() => alert('removed')}>с removeButton</Chip>
          <Chip variant="tag" onRemove={() => alert('removed')}>
            с removeButton, tag
          </Chip>
        </Row>
      </Section>

      <Section title="UtilChip" desc="Footer-нав. Default — `<a>`. Поддерживает renderLink.">
        <Row>
          <UtilChip
            label="Онбординг"
            href="#onboarding"
            icon={<span aria-hidden>✦</span>}
            variant="onboard"
          />
          <UtilChip label="Что нового" href="#whats-new" icon={<span aria-hidden>⌬</span>} />
          <UtilChip
            label="Граф связей"
            disabled
            badge="скоро"
            icon={<span aria-hidden>○</span>}
          />
          <UtilChip
            label="Кнопка"
            onClick={() => alert('button click')}
            icon={<span aria-hidden>◇</span>}
          />
        </Row>
      </Section>

      <Section title="Avatar" desc="Круг 32×32 с инициалами.">
        <Row>
          <Avatar initials="АА" />
          <Avatar initials="АК" ariaLabel="Профиль Антон Краснов" />
          <Avatar initials="МВ" />
          <Avatar initials="ЕС" />
        </Row>
      </Section>

      <Section title="IconButton" desc="Квадрат 32×32 с children в центре.">
        <Row>
          <IconButton ariaLabel="Переключить тему">◐</IconButton>
          <IconButton ariaLabel="История версий">↻</IconButton>
          <IconButton ariaLabel="Закладка">★</IconButton>
          <IconButton ariaLabel="Скачать">⤓</IconButton>
        </Row>
      </Section>

      <Section title="Pill" desc="Широкий pill — типа cmdk-trigger.">
        <Row>
          <Pill icon={<span aria-hidden>⌕</span>} kbd="⌘ K" ariaLabel="Открыть палитру">
            Поиск, навигация, действия
          </Pill>
        </Row>
      </Section>

      <Section title="SortPill" desc="Компактный sort-pill для card-headers.">
        <Row>
          <SortPill label="Недавние" iconLeft="↓" />
          <SortPill label="Просмотры" iconLeft="▴" />
          <SortPill label="Без иконки" />
        </Row>
      </Section>

      <Section title="StatBar" desc="Hub stats — 4 ячейки + опциональные тренды.">
        <StatBar
          items={[
            { label: 'Статей', value: 247, trend: { text: '+12 за месяц' } },
            { label: 'Проектов', value: 32, trend: { text: '+2 за месяц' } },
            {
              label: 'Сотрудников',
              value: 14,
              trend: { text: 'пишут активно', tone: 'flat' },
            },
            {
              label: 'Best practices',
              value: 12,
              accent: true,
              trend: { text: '+1 на этой неделе', tone: 'bp' },
            },
          ]}
        />
      </Section>

      <Section title="NavTile" desc="Большая навигация-плитка. Default — `<a>`.">
        <div className="sg-grid-4" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <NavTile
            href="#browser"
            name="Браузер"
            sub="Все 247 материалов · по типу, дате, автору"
            icon={<span aria-hidden>▤</span>}
          />
          <NavTile
            href="#search"
            name="Поиск"
            sub="По тексту, тегам, медиа · расширенный фильтр"
            icon={<span aria-hidden>⌕</span>}
          />
        </div>
      </Section>

      <Section title="Card" desc="Material card. cover / noCover, BP slot.">
        <div className="sg-grid-4">
          <Card
            variant="cover"
            cover={<div className="sg-mock-cover" />}
            interactive
            markerSlot={<TypeBadge type="project" />}
          >
            <div style={{ fontWeight: 600, fontSize: 14 }}>ЖК Северный свет</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Фасад · BIM · 2023</div>
          </Card>
          <Card
            variant="cover"
            bestPractice
            cover={<div className="sg-mock-cover" />}
            interactive
            markerSlot={<TypeBadge type="solution" />}
          >
            <div style={{ fontWeight: 600, fontSize: 14 }}>Стык витража</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Фасад · конструктив</div>
          </Card>
          <Card variant="noCover" interactive>
            <TypeBadge type="standard" />
            <div style={{ fontWeight: 600, fontSize: 14 }}>Стандарт BIM v2.1</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Обновлён апр. 2024</div>
          </Card>
          <Card variant="noCover" bestPractice interactive>
            <TypeBadge type="article" />
            <div style={{ fontWeight: 600, fontSize: 14 }}>Curtain wall</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Маша В. · обзор</div>
          </Card>
        </div>
      </Section>

      <Section title="MegaDropdown" desc="Раскрывающаяся панель фильтра.">
        <div className="sg-mega-wrap">
          <button
            type="button"
            className="sg-toggle"
            onClick={() => setMegaOpen((o) => !o)}
          >
            {megaOpen ? 'Закрыть' : 'Открыть'} материал ▾
          </button>
          <MegaDropdown
            open={megaOpen}
            onClose={() => setMegaOpen(false)}
            ariaLabel="Материал"
            footer={
              <button
                type="button"
                className="sg-toggle active"
                onClick={() => setMegaOpen(false)}
              >
                Применить
              </button>
            }
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <label>
                <input type="checkbox" /> Бетон <span style={{ color: 'var(--ink-3)' }}>24</span>
              </label>
              <label>
                <input type="checkbox" /> Кирпич <span style={{ color: 'var(--ink-3)' }}>18</span>
              </label>
              <label>
                <input type="checkbox" /> Металл <span style={{ color: 'var(--ink-3)' }}>31</span>
              </label>
              <label>
                <input type="checkbox" /> Стекло <span style={{ color: 'var(--ink-3)' }}>22</span>
              </label>
              <label>
                <input type="checkbox" /> Дерево <span style={{ color: 'var(--ink-3)' }}>12</span>
              </label>
              <label>
                <input type="checkbox" /> Терракота <span style={{ color: 'var(--ink-3)' }}>4</span>
              </label>
            </div>
          </MegaDropdown>
        </div>
      </Section>

      <Section title="ComingSoon" desc="Плейсхолдер для surfaces под construction.">
        <ComingSoon
          surface="article-edit"
          note="Block editor — в работе. Возвращайтесь после релиза."
        />
      </Section>

      <Section
        title="AppShell"
        desc="Топбар + main. Ниже — встроенный пример с фейковым content."
      >
        <div
          style={{
            border: '0.5px solid var(--bd)',
            borderRadius: 'var(--r-md)',
            overflow: 'hidden',
          }}
        >
          <AppShell
            user={{ initials: 'АК', name: 'Антон Краснов' }}
            onSearchClick={() => alert('Search clicked')}
            onThemeToggle={toggle}
            homeHref="#home"
            rightExtras={
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--terra-d)',
                  background: 'var(--terra-bg)',
                  padding: '4px 8px',
                  borderRadius: 'var(--r-pill)',
                }}
              >
                Менеджер
              </span>
            }
          >
            <p style={{ color: 'var(--ink-3)' }}>
              Это main-зона AppShell. Кликните на Pill чтобы увидеть alert,
              на ◐ — переключение темы (общая для всего styleguide).
            </p>
          </AppShell>
        </div>
      </Section>
    </div>
  )
}

function Section({
  title,
  desc,
  children,
}: {
  title: string
  desc?: string
  children: React.ReactNode
}) {
  return (
    <section className="sg-section">
      <h2>{title}</h2>
      {desc ? <p className="desc">{desc}</p> : null}
      {children}
    </section>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="sg-row">{children}</div>
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="sg-label">{children}</p>
}
