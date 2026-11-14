import { TabPanel, Tabs, type TabPanelProps, type TabSpec } from '../tabs/Tabs.js'
import s from './record.module.css'

/**
 * Вкладки колонки карточки записи — общий `Tabs` со своим классом: без
 * нижней рамки, плотнее, не помещаются — переносятся на новую строку (а не
 * прокручиваются вбок). Полоса под выбранной вкладкой, клавиатура и роли —
 * те же, что у вкладок страницы.
 */
export function RecordTabs({
  tabs,
  value,
  onChange,
  ariaLabel,
  idPrefix,
  className,
}: {
  tabs: ReadonlyArray<TabSpec>
  value: string
  onChange: (id: string) => void
  ariaLabel: string
  idPrefix: string
  className?: string
}) {
  return (
    <Tabs
      tabs={tabs}
      value={value}
      onChange={onChange}
      ariaLabel={ariaLabel}
      idPrefix={idPrefix}
      // Свой класс (полоса вкладок телефона) — одна строка; без него вкладки
      // колонки переносятся.
      wrap={!className}
      className={`${s.recordTabs} ${className ?? s.tablist}`}
    />
  )
}

export function RecordTabPanel(props: TabPanelProps) {
  return <TabPanel {...props} />
}
