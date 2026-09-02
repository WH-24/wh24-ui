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
export type { ListColumn, ListPageProps, ListView } from './list/ListPage.js'
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
export type { ComboboxOption } from './list/Combobox.js'
export { Icon } from './list/Icon.js'
export type { IconName } from './list/Icon.js'

// DirectoryPicker — поиск-справочник (люди/отделы/…) с вкладками, режим
// быстрого поиска. Data-agnostic: данные/аватары/onSelect — через props.
export { DirectoryPicker } from './DirectoryPicker/DirectoryPicker.js'
export type {
  DirectoryPickerProps,
  DirectoryItem,
  DirectoryTab,
} from './DirectoryPicker/DirectoryPicker.js'

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
