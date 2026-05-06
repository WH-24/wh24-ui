/**
 * @wowhaus/ui-react
 *
 * React-side helpers over @wowhaus/ui-tokens. CSS is consumed from the
 * tokens package — import it once at app entry:
 *
 *   import '@wowhaus/ui-tokens/tokens.css'
 *   import '@wowhaus/ui-tokens/base.css'
 *   import { ThemeProvider } from '@wowhaus/ui-react'
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

// Re-export token types for convenience so consumers don't need a
// separate import for typing purposes.
export type {
  ArticleType,
  StatusTone,
  StatusTriad,
  Theme,
  ThemeMode,
} from '@wowhaus/ui-tokens'
