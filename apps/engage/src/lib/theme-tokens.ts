export const THEME_TOKENS = [
  'primary',
  'primary-hover',
  'primary-active',
  'primary-foreground',
  'primary-subtle',
  'primary-subtle-foreground',
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'muted',
  'muted-foreground',
  'border',
  'input',
  'ring',
  'accent',
  'accent-foreground',
  'secondary',
  'secondary-foreground',
  'destructive',
  'destructive-foreground',
  'success',
  'success-foreground',
  'warning',
  'warning-foreground',
  'info',
  'info-foreground',
  'caution',
  'caution-foreground',
  'scrim',
  'scrim-foreground',
  'hero-star',
  'hero-trail',
  'hero-meteor',
  'hero-surface',
  'hero-surface-deep',
  'hero-foreground',
  'window-control-close',
  'window-control-minimize',
  'window-control-zoom',
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'viz-grid',
  'viz-axis',
  'viz-edge',
  'radius-sm',
  'radius-md',
  'radius-lg',
  'brand-mark-bar-o',
  'brand-mark-bar-g',
] as const;

/** A token name from the manifest, without the `--interlace-` prefix. */
export type ThemeToken = (typeof THEME_TOKENS)[number];

/** The colour-scheme axis. Orthogonal to the theme axis. */
export const SCHEMES = ['light', 'dark'] as const;
export type Scheme = (typeof SCHEMES)[number];

/**
 * The theme registry.
 *
 * `name` is the literal written to `<html data-theme="…">` — except for the
 * default, which writes NO attribute at all (`:root` is Interlace, so an
 * attribute would be redundant and would make "no preference" and "chose the
 * default" indistinguishable in the DOM).
 */
export const THEMES = [
  {
    name: 'interlace',
    label: 'Interlace',
    /** Burnt orange + brand green, warm neutrals. `styles/interlace-theme.css`. */
    description: 'Warm burnt orange — the Interlace brand.',
    default: true,
  },
  {
    name: 'harbor',
    label: 'Harbor',
    /** Deep harbour blue on cool slate. `styles/themes/harbor.css`. */
    description: 'Deep harbour blue on cool slate.',
    default: false,
  },
] as const;

/** A registered theme name. */
export type ThemeName = (typeof THEMES)[number]['name'];

/** The theme that `:root` already is — written as no attribute at all. */
export const DEFAULT_THEME: ThemeName = 'interlace';

/** Narrow an arbitrary string to a registered theme name. */
export function isThemeName(value: unknown): value is ThemeName {
  return (
    typeof value === 'string' &&
    THEMES.some((theme) => theme.name === value)
  );
}

/** Narrow an arbitrary string to a colour scheme. */
export function isScheme(value: unknown): value is Scheme {
  return value === 'light' || value === 'dark';
}
