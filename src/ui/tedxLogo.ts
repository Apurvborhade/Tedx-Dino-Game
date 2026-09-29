// ════════════════════════════════════════════════════════════════════════════
// tedxLogo.ts — Official "TEDx DYPDPU" lockup, inlined so it follows the theme
// ════════════════════════════════════════════════════════════════════════════

import tedxSvg from '../../public/TEDX.svg?raw';

let instance = 0;

/**
 * Returns the TEDx DYPDPU logo as inline SVG markup. The source file draws
 * "DYPDPU" in white (made for dark slides); here it's switched to
 * currentColor so it picks up --ink on the paper cards. Pattern/image ids are
 * suffixed per copy — the same id twice in one document breaks rendering when
 * the first copy sits inside a display:none screen.
 */
export function tedxLogo(className = 'tedx-logo'): string {
  const suffix = `-${instance++}`;
  return tedxSvg
    .replace(/fill="white"/g, 'fill="currentColor"')
    .replace(/id="([^"]+)"/g, `id="$1${suffix}"`)
    .replace(/url\(#([^)]+)\)/g, `url(#$1${suffix})`)
    .replace(/href="#([^"]+)"/g, `href="#$1${suffix}"`)
    .replace(
      '<svg ',
      `<svg class="${className}" role="img" aria-label="TEDx DYPDPU" preserveAspectRatio="xMidYMid meet" `,
    )
    .replace(/ width="667" height="108"/, '');
}
