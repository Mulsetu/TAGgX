import type { CSSProperties } from "react";
import { TAGX_GREEN, TAGX_TEAL } from "@/lib/brand";

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export function parseHexColor(hex: string): RgbColor | null {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  const digits = match?.[1];
  if (!digits) {
    return null;
  }

  const value = Number.parseInt(digits, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

export function formatRgb(rgb: RgbColor): string {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

function toHsl(rgb: RgbColor): { h: number; s: number; l: number } {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;
  const delta = max - min;

  if (delta !== 0) {
    saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === r) {
      hue = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
      hue = ((b - r) / delta + 2) / 6;
    } else {
      hue = ((r - g) / delta + 4) / 6;
    }
  }

  return { h: hue * 360, s: saturation * 100, l: lightness * 100 };
}

function formatHslChannels({ h, s, l }: { h: number; s: number; l: number }): string {
  return `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`;
}

function contrastingForeground(rgb: RgbColor): string {
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance > 0.55 ? "0 0% 9%" : "0 0% 98%";
}

/**
 * Maps a company's saved brand hex colors onto the shadcn CSS variables
 * (raw "H S% L%" triples — see globals.css). Returns undefined when
 * neither color is set, so the default theme is left untouched.
 */
export function brandingStyle(
  primaryColor: string | null | undefined,
  secondaryColor: string | null | undefined,
): CSSProperties | undefined {
  const primary = primaryColor ? parseHexColor(primaryColor) : null;
  const secondary = secondaryColor ? parseHexColor(secondaryColor) : null;
  if (!primary && !secondary) {
    return undefined;
  }

  const style: Record<string, string> = {};

  if (primary) {
    const hsl = toHsl(primary);
    const channels = formatHslChannels(hsl);
    const foreground = contrastingForeground(primary);
    style["--primary"] = channels;
    style["--primary-foreground"] = foreground;
    style["--ring"] = channels;
    style["--sidebar-primary"] = channels;
    style["--sidebar-primary-foreground"] = foreground;
    style["--sidebar-ring"] = channels;
    // Nav buttons use --sidebar-accent for hover/active, not --sidebar-primary.
    style["--sidebar-accent"] = formatHslChannels({
      h: hsl.h,
      s: Math.min(hsl.s, 55),
      l: hsl.l > 75 ? Math.max(hsl.l - 10, 80) : 93,
    });
    style["--sidebar-accent-foreground"] = hsl.l > 60 ? contrastingForeground(primary) : channels;
  }

  if (secondary) {
    const channels = formatHslChannels(toHsl(secondary));
    style["--secondary"] = channels;
    style["--secondary-foreground"] = contrastingForeground(secondary);
  }

  return style as CSSProperties;
}

function colorOrDefault(hex: string | null | undefined, fallback: string): RgbColor {
  return (hex ? parseHexColor(hex) : null) ?? parseHexColor(fallback) ?? { r: 0, g: 80, b: 104 };
}

/**
 * Company dashboard theme. The sidebar and headings use the logo primary.
 * Buttons, checks, and switches use the logo secondary. Missing colors
 * fall back to the TagX teal and green.
 */
export function companyShellStyle(
  primaryColor: string | null | undefined,
  secondaryColor: string | null | undefined,
): CSSProperties {
  const primary = colorOrDefault(primaryColor, TAGX_TEAL);
  const secondary = colorOrDefault(secondaryColor, TAGX_GREEN);
  const primaryHsl = toHsl(primary);
  const secondaryHsl = toHsl(secondary);
  const primaryChannels = formatHslChannels(primaryHsl);
  const secondaryChannels = formatHslChannels(secondaryHsl);
  const sidebarForeground = contrastingForeground(primary);
  const buttonForeground = contrastingForeground(secondary);
  const accentLightness = primaryHsl.l > 70 ? Math.max(primaryHsl.l - 8, 55) : Math.min(primaryHsl.l + 8, 36);

  return {
    "--brand-primary": primaryChannels,
    "--brand-secondary": secondaryChannels,
    "--primary": secondaryChannels,
    "--primary-foreground": buttonForeground,
    "--ring": secondaryChannels,
    "--sidebar-background": primaryChannels,
    "--sidebar-foreground": sidebarForeground,
    "--sidebar-primary": secondaryChannels,
    "--sidebar-primary-foreground": buttonForeground,
    "--sidebar-accent": formatHslChannels({ h: primaryHsl.h, s: Math.min(primaryHsl.s, 70), l: accentLightness }),
    "--sidebar-accent-foreground": sidebarForeground,
    "--sidebar-border": formatHslChannels({
      h: primaryHsl.h,
      s: Math.min(primaryHsl.s, 60),
      l: Math.min(accentLightness, primaryHsl.l + 6),
    }),
    "--sidebar-ring": secondaryChannels,
  } as CSSProperties;
}
