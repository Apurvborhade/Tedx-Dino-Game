// ════════════════════════════════════════════════════════════════════════════
// Ground.ts — Scrolling ground line + detail marks
// ════════════════════════════════════════════════════════════════════════════

import { VIRTUAL } from '../config';
import { Rng } from '../core/Rng';

export type Era = 'PAST' | 'PRESENT' | 'FUTURE';

const STRIP_WIDTH = 640;
const MARK_DENSITY = 120; // ~1 mark per 120px

export class Ground {
  private strip: OffscreenCanvas | HTMLCanvasElement;
  private stripCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  scrollOffset = 0;
  private currentEra: Era = 'PAST';

  constructor() {
    if (typeof OffscreenCanvas !== 'undefined') {
      this.strip = new OffscreenCanvas(STRIP_WIDTH, 44);
      this.stripCtx = this.strip.getContext('2d')!;
    } else {
      this.strip = document.createElement('canvas');
      this.strip.width = STRIP_WIDTH;
      this.strip.height = 44;
      this.stripCtx = this.strip.getContext('2d')!;
    }
    this.regenerateStrip('PAST');
  }

  regenerateStrip(era: Era): void {
    this.currentEra = era;
    const ctx = this.stripCtx;
    const w = STRIP_WIDTH;

    ctx.clearRect(0, 0, w, 44);

    // We'll draw in black; tinting is applied at render time
    ctx.fillStyle = '#000';

    // Ground line: 2px at y=0,1
    ctx.fillRect(0, 0, w, 2);

    // Detail marks below the line
    const rng = new Rng(42 + era.charCodeAt(0));
    const numMarks = Math.floor(w / MARK_DENSITY);

    for (let i = 0; i < numMarks; i++) {
      const x = Math.floor(rng.range(i * MARK_DENSITY, (i + 1) * MARK_DENSITY));
      const y = 4 + Math.floor(rng.range(0, 10));

      switch (era) {
        case 'PAST':
          this.drawPastMark(ctx, x, y, rng);
          break;
        case 'PRESENT':
          this.drawPresentMark(ctx, x, y, rng);
          break;
        case 'FUTURE':
          this.drawFutureMark(ctx, x, y, rng);
          break;
      }
    }
  }

  private drawPastMark(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, x: number, y: number, rng: Rng): void {
    const type = rng.int(0, 2);
    if (type === 0) {
      // Crack: diagonal 1-2px lines
      ctx.fillRect(x, y, 1, 3);
      ctx.fillRect(x + 1, y + 2, 1, 2);
    } else if (type === 1) {
      // Dot-in-square ancient mark
      ctx.fillRect(x, y, 3, 1);
      ctx.fillRect(x, y + 2, 3, 1);
      ctx.fillRect(x, y, 1, 3);
      ctx.fillRect(x + 2, y, 1, 3);
      ctx.fillRect(x + 1, y + 1, 1, 1);
    } else {
      // 3-pixel arc (wheel fragment)
      ctx.fillRect(x, y + 1, 1, 1);
      ctx.fillRect(x + 1, y, 1, 1);
      ctx.fillRect(x + 2, y + 1, 1, 1);
    }
  }

  private drawPresentMark(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, x: number, y: number, rng: Rng): void {
    const type = rng.int(0, 1);
    if (type === 0) {
      // Clean dash
      const len = rng.int(3, 6);
      ctx.fillRect(x, y, len, 1);
    } else {
      // Short perpendicular mark
      ctx.fillRect(x, y, 1, 2);
    }
  }

  private drawFutureMark(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, x: number, y: number, rng: Rng): void {
    const type = rng.int(0, 1);
    if (type === 0) {
      // Sparse dotted line
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(x + i * 3, y, 1, 1);
      }
    } else {
      // Single dot
      ctx.fillRect(x, y, 1, 1);
    }
  }

  update(dt: number, worldSpeed: number): void {
    this.scrollOffset = (this.scrollOffset + worldSpeed * dt) % STRIP_WIDTH;
  }

  reset(): void {
    this.scrollOffset = 0;
  }

  /** Draw ground line and detail strip */
  draw(ctx: CanvasRenderingContext2D, ink: string): void {
    // Main ground line
    ctx.fillStyle = ink;
    ctx.fillRect(0, VIRTUAL.GROUND_Y, VIRTUAL.WIDTH, 2);

    // Detail strip (tinted via globalCompositeOperation)
    // We draw the strip twice for wrapping
    const offset = Math.round(this.scrollOffset);
    ctx.save();
    ctx.globalAlpha = 0.6;

    // Tint the strip - draw it as a mask
    ctx.drawImage(this.strip, -offset, VIRTUAL.GROUND_Y);
    ctx.drawImage(this.strip, STRIP_WIDTH - offset, VIRTUAL.GROUND_Y);

    ctx.restore();
  }

  getEra(): Era {
    return this.currentEra;
  }
}
