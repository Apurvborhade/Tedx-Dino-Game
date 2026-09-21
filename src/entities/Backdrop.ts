// ════════════════════════════════════════════════════════════════════════════
// Backdrop.ts — Painted environment plates (public/game-bg) with parallax
// scroll and a smooth day → night crossfade driven by the score cycle.
// ════════════════════════════════════════════════════════════════════════════

import { VIRTUAL } from '../config';
import type { Era } from './Ground';

const PARALLAX = 0.15; // fraction of world speed the distant skyline scrolls at
/** Paper-coloured haze over the skyline (above the ground line) so ink
 *  sprites stay readable. The wall the wheel rolls on is left untouched. */
const VEIL_ALPHA = 0.38;

export interface TimeOfDay {
  phase: 'DAY' | 'SUNSET' | 'NIGHT';
  /** 0-1 transition progress for SUNSET */
  transition: number;
}

type PlateName = 'day' | 'night';

/** Row (0-1 of image height) where the runner's ground line sits in each plate. */
const PLATE_GROUND: Record<PlateName, number> = {
  day: 0.771,
  night: 0.836,
};

interface Plate {
  ready: boolean;
  /** Pre-rendered [plate][mirrored plate] strip at the image's native
   *  resolution, already cropped/aligned to the canvas. Per frame this is a
   *  plain blit — no flips, no clipping, no high-quality resampling. */
  strip: HTMLCanvasElement;
  /** Width of one tile (half the strip) in virtual px */
  tileW: number;
}

export class Backdrop {
  private plates: Record<PlateName, Plate>;

  /** Skyline scroll offset in virtual px (unbounded; wrapped per plate at draw time) */
  offset = 0;
  /** Wall scroll offset — moves at full world speed so the wheel visibly rolls on it */
  groundOffset = 0;

  private currentEra: Era = 'PAST';

  constructor() {
    const base = import.meta.env.BASE_URL;
    this.plates = {
      day: this.loadPlate(`${base}game-bg/day1.webp`, 'day'),
      night: this.loadPlate(`${base}game-bg/night.webp`, 'night'),
    };
  }

  private loadPlate(src: string, name: PlateName): Plate {
    const img = new Image();
    const plate: Plate = { ready: false, strip: document.createElement('canvas'), tileW: VIRTUAL.WIDTH };
    img.decoding = 'async';
    img.onload = () => {
      const groundFrac = PLATE_GROUND[name];
      // Cover the canvas width, then grow if the ground alignment would leave
      // a gap above or below.
      let scale = VIRTUAL.WIDTH / img.width;
      scale = Math.max(
        scale,
        VIRTUAL.GROUND_Y / (groundFrac * img.height),
        (VIRTUAL.HEIGHT - VIRTUAL.GROUND_Y) / ((1 - groundFrac) * img.height),
      );
      const w = img.width * scale; // virtual px
      const h = img.height * scale;
      const y = VIRTUAL.GROUND_Y - groundFrac * h;

      // Bake the strip at native image resolution (px per virtual px).
      const px = img.width / w;
      const strip = plate.strip;
      strip.width = Math.round(w * 2 * px);
      strip.height = Math.round(VIRTUAL.HEIGHT * px);
      const sctx = strip.getContext('2d')!;
      sctx.imageSmoothingEnabled = true;
      sctx.imageSmoothingQuality = 'high';
      sctx.scale(px, px);
      sctx.drawImage(img, 0, y, w, h);
      sctx.translate(w * 2, 0);
      sctx.scale(-1, 1);
      sctx.drawImage(img, 0, y, w, h);

      plate.tileW = w;
      plate.ready = true;
    };
    img.onerror = () => console.warn(`[BACKDROP] failed to load ${src}`);
    img.src = src;
    return plate;
  }

  regenerate(era: Era, _night: boolean): void {
    this.currentEra = era;
  }

  update(dt: number, worldSpeed: number): void {
    this.offset += worldSpeed * PARALLAX * dt;
    this.groundOffset += worldSpeed * dt;
  }

  reset(): void {
    this.offset = 0;
    this.groundOffset = 0;
    this.currentEra = 'PAST';
  }

  /**
   * @param nightFactor eased 0 = full day, 1 = full night
   * @param paper       current palette paper colour, used for the veil
   */
  draw(ctx: CanvasRenderingContext2D, nightFactor: number, paper: string): void {
    ctx.save();
    // Plates are painted, not 1-bit sprites — let them scale smoothly.
    ctx.imageSmoothingEnabled = true;

    // Skyline (above the ground line): slow parallax + haze
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VIRTUAL.WIDTH, VIRTUAL.GROUND_Y);
    ctx.clip();
    if (nightFactor < 1) this.drawTiled(ctx, this.plates.day, 1, this.offset);
    if (nightFactor > 0) this.drawTiled(ctx, this.plates.night, nightFactor, this.offset);
    ctx.globalAlpha = VEIL_ALPHA;
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, VIRTUAL.WIDTH, VIRTUAL.GROUND_Y);
    ctx.restore();

    // Wall (ground line and below): full speed, full opacity
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, VIRTUAL.GROUND_Y, VIRTUAL.WIDTH, VIRTUAL.HEIGHT - VIRTUAL.GROUND_Y);
    ctx.clip();
    if (nightFactor < 1) this.drawTiled(ctx, this.plates.day, 1, this.groundOffset);
    if (nightFactor > 0) this.drawTiled(ctx, this.plates.night, nightFactor, this.groundOffset);
    ctx.restore();

    ctx.restore();
  }

  /** Blit the pre-baked strip (plate + its mirror) so the non-seamless
   *  painting wraps without a visible cut. At most two draw calls. */
  private drawTiled(ctx: CanvasRenderingContext2D, plate: Plate, alpha: number, offset: number): void {
    if (!plate.ready || alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Each plate wraps on its own period since draw widths differ slightly.
    const period = plate.tileW * 2;
    const x = -(offset % period);
    const strip = plate.strip;
    ctx.drawImage(strip, x, 0, period, VIRTUAL.HEIGHT);
    if (x + period < VIRTUAL.WIDTH) {
      ctx.drawImage(strip, x + period, 0, period, VIRTUAL.HEIGHT);
    }

    ctx.restore();
  }

  getEra(): Era {
    return this.currentEra;
  }
}
