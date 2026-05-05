/**
 * Typed mirror of CSS custom properties from `tokens.css`.
 *
 * Keep manually in sync with `tokens.css` — both files are sources of
 * truth for their respective consumers (CSS files reference custom
 * properties, TS code references this object).
 */

export const colors = {
  terra: 'var(--terra)',
  terraD: 'var(--terra-d)',
  terraBg: 'var(--terra-bg)',
  terraBd: 'var(--terra-bd)',
  terraMark: 'var(--terra-mark)',

  ink: 'var(--ink)',
  ink2: 'var(--ink-2)',
  ink3: 'var(--ink-3)',
  ink4: 'var(--ink-4)',
  ink5: 'var(--ink-5)',

  bg: 'var(--bg)',
  surf: 'var(--surf)',
  surf2: 'var(--surf-2)',
  surf3: 'var(--surf-3)',

  bd: 'var(--bd)',
  bdSoft: 'var(--bd-soft)',
  bdStrong: 'var(--bd-strong)',

  tpProj: 'var(--tp-proj)',
  tpStd: 'var(--tp-std)',
  tpSol: 'var(--tp-sol)',
  tpArt: 'var(--tp-art)',

  good: 'var(--good)',
  goodBg: 'var(--good-bg)',
  goodBd: 'var(--good-bd)',
  warn: 'var(--warn)',
  warnBg: 'var(--warn-bg)',
  warnBd: 'var(--warn-bd)',
  info: 'var(--info)',
  infoBg: 'var(--info-bg)',
  infoBd: 'var(--info-bd)',
  bad: 'var(--bad)',
  badBg: 'var(--bad-bg)',
  badBd: 'var(--bad-bd)',
} as const

export const radii = {
  sm: 'var(--r-sm)',
  md: 'var(--r-md)',
  lg: 'var(--r-lg)',
  xl: 'var(--r-xl)',
  pill: 'var(--r-pill)',
} as const

export const fonts = {
  sans: 'var(--font-sans)',
  mono: 'var(--font-mono)',
} as const

export const layout = {
  sidebarWidth: 'var(--sb-w)',
  contentWidth: 'var(--content-w)',
  drawerWidth: 'var(--drawer-w)',
} as const

export const focus = {
  color: 'var(--focus)',
  ringWidth: 'var(--focus-ring-w)',
  ringOffset: 'var(--focus-ring-offset)',
} as const

export const fields = {
  height: 'var(--field-h)',
  paddingX: 'var(--field-px)',
  radius: 'var(--field-r)',
  background: 'var(--field-bg)',
  border: 'var(--field-bd)',
  borderFocus: 'var(--field-bd-focus)',
} as const

/** Article type — drives badge/marker color. */
export type ArticleType = 'project' | 'standard' | 'solution' | 'article'

export const articleTypeColor: Record<ArticleType, string> = {
  project: colors.tpProj,
  standard: colors.tpStd,
  solution: colors.tpSol,
  article: colors.tpArt,
}

/** Status tone — drives surface/text/border triad. */
export type StatusTone = 'good' | 'warn' | 'info' | 'bad'

export interface StatusTriad {
  fg: string
  bg: string
  bd: string
}

export const statusToneTriad: Record<StatusTone, StatusTriad> = {
  good: { fg: colors.good, bg: colors.goodBg, bd: colors.goodBd },
  warn: { fg: colors.warn, bg: colors.warnBg, bd: colors.warnBd },
  info: { fg: colors.info, bg: colors.infoBg, bd: colors.infoBd },
  bad: { fg: colors.bad, bg: colors.badBg, bd: colors.badBd },
}
