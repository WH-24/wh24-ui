/**
 * @wowhaus-24/ui-react
 *
 * React-side helpers over @wowhaus-24/ui-tokens. CSS is consumed from the
 * tokens package — import it once at app entry:
 *
 *   import '@wowhaus-24/ui-tokens/tokens.css'
 *   import '@wowhaus-24/ui-tokens/base.css'
 *   import { ThemeProvider } from '@wowhaus-24/ui-react'
 */

export { ThemeProvider, useTheme } from './ThemeProvider.js'
export type { ThemeProviderProps } from './ThemeProvider.js'

// Primitives
export { AppShell } from './AppShell/AppShell.js'
export type {
  AppShellProps,
  AppShellLinkRendererProps,
} from './AppShell/AppShell.js'

export { Avatar } from './Avatar/Avatar.js'
export type { AvatarProps } from './Avatar/Avatar.js'

export { BestPracticeBadge } from './BestPracticeBadge/BestPracticeBadge.js'
export type { BestPracticeBadgeProps } from './BestPracticeBadge/BestPracticeBadge.js'

export { Card } from './Card/Card.js'
export type { CardProps, CardVariant } from './Card/Card.js'

export { Chip } from './Chip/Chip.js'
export type { ChipProps, ChipVariant } from './Chip/Chip.js'

export { ComingSoon } from './ComingSoon/ComingSoon.js'
export type { ComingSoonProps } from './ComingSoon/ComingSoon.js'

export { IconButton } from './IconButton/IconButton.js'
export type { IconButtonProps } from './IconButton/IconButton.js'

export { MegaDropdown } from './MegaDropdown/MegaDropdown.js'
export type { MegaDropdownProps } from './MegaDropdown/MegaDropdown.js'

export { NavTile } from './NavTile/NavTile.js'
export type {
  NavTileProps,
  NavTileLinkRendererProps,
} from './NavTile/NavTile.js'

export { Pill } from './Pill/Pill.js'
export type { PillProps } from './Pill/Pill.js'

export { SortPill } from './SortPill/SortPill.js'
export type { SortPillProps } from './SortPill/SortPill.js'

export { StatBar } from './StatBar/StatBar.js'
export type { StatBarProps, StatItem, TrendTone } from './StatBar/StatBar.js'

export { TypeBadge } from './TypeBadge/TypeBadge.js'
export type { TypeBadgeProps } from './TypeBadge/TypeBadge.js'

export { TypeMarker } from './TypeMarker/TypeMarker.js'
export type { TypeMarkerProps } from './TypeMarker/TypeMarker.js'

export { UtilChip } from './UtilChip/UtilChip.js'
export type {
  UtilChipProps,
  UtilChipVariant,
  UtilChipLinkRendererProps,
} from './UtilChip/UtilChip.js'

// Config-driven list/filter page (ListPage<T> + universal Bitrix24-style filter).
export { ListPage, NAME_COL_MIN_WIDTH } from './list/ListPage.js'
export { folderView } from './list/ListPage.js'
export type {
  ListColumn,
  ListGroup,
  ListGroups,
  ListPageProps,
  ListView,
} from './list/ListPage.js'
export type {
  FilterBarConfig,
  FilterFieldDef,
  FieldType,
  FilterState,
  FilterValue,
  FilterPreset,
  FilterSettings,
  FilterSettingsProvider,
} from './list/filter/types.js'
export { matchItem, activeCount } from './list/filter/matchItem.js'
// Standalone-версии универсального фильтра — чтобы использовать «+ Поиск»-бар
// поверх нетабличных экранов (напр. матрица «Загрузка проектов»), а не только
// внутри ListPage.
export { FilterBar } from './list/filter/FilterBar.js'
export type { FilterBarProps } from './list/filter/FilterBar.js'
export { useFilterState } from './list/filter/useFilterState.js'
export { Combobox, OptionMarker, hasOptionMarker } from './list/Combobox.js'
export type { ComboboxOption, ComboboxProps } from './list/Combobox.js'
export { Icon } from './list/Icon.js'
export type { IconName } from './list/Icon.js'

// Примитивы формы — общий набор контролов для карточек записей и настроек:
// один вид поля во всех модулях (никаких нативных <select>/<input type=date>).
export { Input } from './form/Input.js'
export type { InputProps } from './form/Input.js'
export { Textarea } from './form/Textarea.js'
export type { TextareaProps } from './form/Textarea.js'
export { FieldRow, FieldGrid, StaticValue } from './form/Field.js'
export type { FieldRowProps, FieldGridProps, StaticValueProps, FieldSpan } from './form/Field.js'
export { MultiCombobox } from './form/MultiCombobox.js'
export type { MultiComboboxProps } from './form/MultiCombobox.js'
export { DateField } from './form/DateField.js'
export type { DateFieldProps } from './form/DateField.js'
export { FileDrop } from './form/FileDrop.js'
export type { FileDropProps, FileDropItem } from './form/FileDrop.js'

// DirectoryPicker — поиск-справочник (люди/отделы/…) с вкладками, режим
// быстрого поиска. Data-agnostic: данные/аватары/onSelect — через props.
export { Kanban } from './Kanban/Kanban.js'
export type { KanbanColumn, KanbanProps, KanbanTone } from './Kanban/Kanban.js'
export { DirectoryPicker } from './DirectoryPicker/DirectoryPicker.js'
export type {
  DirectoryPickerProps,
  DirectoryItem,
  DirectoryTab,
} from './DirectoryPicker/DirectoryPicker.js'

// Стандарт страницы модуля (перенесён из портала WH_Portale, 09.11.2026):
// панель модуля, заголовок страницы, вкладки, пустые/ошибочные состояния,
// окна, подтверждения, тосты. Стили — на именах `@wowhaus-24/ui-tokens/bridge.css`.
export { ModuleLayout, ModuleNavLink, ModuleNavList, ModuleNavGroup } from './module/ModuleLayout.js'
export type {
  ModuleLayoutProps,
  ModuleNavLinkProps,
  ModuleNavItem,
  ModuleNavListProps,
  ModuleNavGroupProps,
} from './module/ModuleLayout.js'
export { Page } from './page/Page.js'
export type { PageProps } from './page/Page.js'
export { PageHeader } from './page/PageHeader.js'
export type { PageHeaderProps } from './page/PageHeader.js'
export { EmptyState } from './page/EmptyState.js'
export type { EmptyStateProps } from './page/EmptyState.js'
export { ErrorState } from './page/ErrorState.js'
export type { ErrorStateProps } from './page/ErrorState.js'
export { Loader } from './page/Loader.js'
export type { LoaderProps } from './page/Loader.js'
export { Tabs, TabPanel } from './tabs/Tabs.js'
export type { TabSpec, TabsProps, TabPanelProps } from './tabs/Tabs.js'
export { SegmentedControl } from './tabs/SegmentedControl.js'
export type { SegmentOption, SegmentedControlProps } from './tabs/SegmentedControl.js'
export { Modal } from './overlay/Modal.js'
export type { ModalProps } from './overlay/Modal.js'
export { Drawer } from './overlay/Drawer.js'
export type { DrawerProps } from './overlay/Drawer.js'
export { ConfirmProvider, useConfirm, useAlert } from './overlay/Confirm.js'
export type { ConfirmOptions, ConfirmFn } from './overlay/Confirm.js'
export { ToastProvider, useToast } from './overlay/Toast.js'
export type { ToastApi, ToastAction, ToastOptions, ToastType } from './overlay/Toast.js'
export { useFocusTrap, getFocusableElements } from './overlay/useFocusTrap.js'
export type { FocusTrapOptions } from './overlay/useFocusTrap.js'

// Бренд-настройки сервиса (логотип/цвет/шрифт/радиусы) + применение в рантайме.
export { applyBrand, BRAND_FONTS, BRAND_RADIUS_SCALES } from './brand/brand.js'
export type { BrandSettings } from './brand/brand.js'

// Re-export token types for convenience so consumers don't need a
// separate import for typing purposes.
export type {
  ArticleType,
  StatusTone,
  StatusTriad,
  Theme,
  ThemeMode,
} from '@wowhaus-24/ui-tokens'
