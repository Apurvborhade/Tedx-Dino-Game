// ════════════════════════════════════════════════════════════════════════════
// palette.ts — {ink, paper} pairs + inversion crossfade
// ════════════════════════════════════════════════════════════════════════════

export interface PaletteColors {
  ink: string;
  paper: string;
}

export const DAY: PaletteColors = { ink: '#2a1e14', paper: '#ecdcb6' };
export const NIGHT: PaletteColors = { ink: '#f0e6c8', paper: '#0b0d1a' };

/** Parse hex color to RGB */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

/** RGB to hex string */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/** Lerp two hex colors */
export function lerpColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(
    Math.round(ar + (br - ar) * t),
    Math.round(ag + (bg - ag) * t),
    Math.round(ab + (bb - ab) * t),
  );
}
