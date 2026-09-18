// ════════════════════════════════════════════════════════════════════════════
// Backdrop.ts — Parallax layers: era silhouettes, clouds/stars, sun/moon
// ════════════════════════════════════════════════════════════════════════════

import { VIRTUAL } from '../config';
import { Rng } from '../core/Rng';
import type { Era } from './Ground';

const STRIP_WIDTH = 1280; // 2x virtual width for seamless wrap
const FAR_PARALLAX = 0.15;
const NEAR_PARALLAX = 0.35;

export interface TimeOfDay {
  phase: 'DAY' | 'SUNSET' | 'NIGHT';
  /** 0-1 transition progress for SUNSET */
  transition: number;
}

export class Backdrop {
  private farStrip: HTMLCanvasElement;
  private farCtx: CanvasRenderingContext2D;
  private nearStrip: HTMLCanvasElement;
  private nearCtx: CanvasRenderingContext2D;

  farOffset = 0;
  nearOffset = 0;

  private currentEra: Era = 'PAST';

  constructor() {
    this.farStrip = document.createElement('canvas');
    this.farStrip.width = STRIP_WIDTH;
    this.farStrip.height = VIRTUAL.HEIGHT;
    this.farCtx = this.farStrip.getContext('2d')!;

    this.nearStrip = document.createElement('canvas');
    this.nearStrip.width = STRIP_WIDTH;
    this.nearStrip.height = VIRTUAL.HEIGHT;
    this.nearCtx = this.nearStrip.getContext('2d')!;

    this.regenerate('PAST', false);
  }

  regenerate(era: Era, night: boolean): void {
    this.currentEra = era;
    this.renderFarLayer(era);
    this.renderNearLayer(night);
  }

  private renderFarLayer(era: Era): void {
    const ctx = this.farCtx;
    const w = STRIP_WIDTH;
    ctx.clearRect(0, 0, w, VIRTUAL.HEIGHT);
    ctx.fillStyle = '#000';

    const baseY = VIRTUAL.GROUND_Y; // silhouettes sit just above ground

    switch (era) {
      case 'PAST':
        this.drawPastSilhouettes(ctx, w, baseY);
        break;
      case 'PRESENT':
        this.drawPresentSilhouettes(ctx, w, baseY);
        break;
      case 'FUTURE':
        this.drawFutureSilhouettes(ctx, w, baseY);
        break;
    }
  }

  private drawPastSilhouettes(ctx: CanvasRenderingContext2D, w: number, baseY: number): void {
    // Stepped temple shikhara outlines
    this.drawTemple(ctx, 60, baseY);
    this.drawTemple(ctx, 60 + w / 2, baseY);

    // Low stone arch
    this.drawArch(ctx, 240, baseY);
    this.drawArch(ctx, 240 + w / 2, baseY);

    // Standing stones
    this.drawStandingStone(ctx, 400, baseY, 4, 22);
    this.drawStandingStone(ctx, 420, baseY, 3, 18);
    this.drawStandingStone(ctx, 400 + w / 2, baseY, 4, 22);
    this.drawStandingStone(ctx, 420 + w / 2, baseY, 3, 18);

    // Small stupa dome
    this.drawStupa(ctx, 550, baseY);
    this.drawStupa(ctx, 550 + w / 2, baseY);
  }

  private drawTemple(ctx: CanvasRenderingContext2D, x: number, baseY: number): void {
    // Stepped pyramid shape
    ctx.fillRect(x, baseY - 10, 40, 10);
    ctx.fillRect(x + 5, baseY - 20, 30, 10);
    ctx.fillRect(x + 10, baseY - 28, 20, 8);
    ctx.fillRect(x + 14, baseY - 36, 12, 8);
    ctx.fillRect(x + 18, baseY - 42, 4, 6);
  }

  private drawArch(ctx: CanvasRenderingContext2D, x: number, baseY: number): void {
    // Two pillars with arch
    ctx.fillRect(x, baseY - 24, 4, 24);
    ctx.fillRect(x + 26, baseY - 24, 4, 24);
    // Arch top
    ctx.fillRect(x + 2, baseY - 26, 26, 2);
    ctx.fillRect(x + 4, baseY - 28, 22, 2);
    ctx.fillRect(x + 8, baseY - 30, 14, 2);
  }

  private drawStandingStone(ctx: CanvasRenderingContext2D, x: number, baseY: number, w: number, h: number): void {
    ctx.fillRect(x, baseY - h, w, h);
    // Tapered top
    ctx.fillRect(x + 1, baseY - h - 2, w - 2, 2);
  }

  private drawStupa(ctx: CanvasRenderingContext2D, x: number, baseY: number): void {
    ctx.fillRect(x, baseY - 8, 24, 8);
    ctx.fillRect(x + 3, baseY - 14, 18, 6);
    ctx.fillRect(x + 6, baseY - 19, 12, 5);
    ctx.fillRect(x + 9, baseY - 22, 6, 3);
    ctx.fillRect(x + 11, baseY - 25, 2, 3);
  }

  private drawPresentSilhouettes(ctx: CanvasRenderingContext2D, w: number, baseY: number): void {
    // Flat-topped buildings at varied heights
    this.drawBuilding(ctx, 30, baseY, 30, 35);
    this.drawBuilding(ctx, 80, baseY, 20, 20);
    this.drawBuilding(ctx, 180, baseY, 45, 50);
    this.drawBuilding(ctx, 300, baseY, 25, 28);
    this.drawBuilding(ctx, 420, baseY, 35, 42);

    // Duplicate for wrapping
    this.drawBuilding(ctx, 30 + w / 2, baseY, 30, 35);
    this.drawBuilding(ctx, 80 + w / 2, baseY, 20, 20);
    this.drawBuilding(ctx, 180 + w / 2, baseY, 45, 50);
    this.drawBuilding(ctx, 300 + w / 2, baseY, 25, 28);
    this.drawBuilding(ctx, 420 + w / 2, baseY, 35, 42);

    // Antenna mast
    ctx.fillRect(200, baseY - 60, 2, 10);
    ctx.fillRect(198, baseY - 62, 6, 2);
    ctx.fillRect(200 + w / 2, baseY - 60, 2, 10);
    ctx.fillRect(198 + w / 2, baseY - 62, 6, 2);

    // TEDx-ish rounded-X on a rooftop
    this.drawTedxShape(ctx, 440, baseY - 42);
    this.drawTedxShape(ctx, 440 + w / 2, baseY - 42);
  }

  private drawBuilding(ctx: CanvasRenderingContext2D, x: number, baseY: number, w: number, h: number): void {
    ctx.fillRect(x, baseY - h, w, h);
    // Window dots
    for (let wy = baseY - h + 4; wy < baseY - 4; wy += 6) {
      for (let wx = x + 3; wx < x + w - 3; wx += 6) {
        // Windows are "holes" - we clear them
        ctx.clearRect(wx, wy, 2, 2);
      }
    }
  }

  private drawTedxShape(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    // Simple X shape
    ctx.fillRect(x, y, 2, 8);
    ctx.fillRect(x + 6, y, 2, 8);
    ctx.fillRect(x + 2, y + 2, 2, 2);
    ctx.fillRect(x + 4, y + 4, 2, 2);
    ctx.fillRect(x + 2, y + 4, 2, 2);
    ctx.fillRect(x + 4, y + 2, 2, 2);
  }

  private drawFutureSilhouettes(ctx: CanvasRenderingContext2D, w: number, baseY: number): void {
    // Tall thin spires
    this.drawSpire(ctx, 80, baseY, 55);
    this.drawSpire(ctx, 300, baseY, 65);
    this.drawSpire(ctx, 500, baseY, 48);
    this.drawSpire(ctx, 80 + w / 2, baseY, 55);
    this.drawSpire(ctx, 300 + w / 2, baseY, 65);
    this.drawSpire(ctx, 500 + w / 2, baseY, 48);

    // Floating ring/torus
    this.drawRing(ctx, 200, baseY - 40, 14);
    this.drawRing(ctx, 200 + w / 2, baseY - 40, 14);

    // Large hollow circle (time symbol)
    this.drawHollowCircle(ctx, 420, baseY - 25, 20);
    this.drawHollowCircle(ctx, 420 + w / 2, baseY - 25, 20);

    // Sparse dotted orbit lines
    for (let i = 0; i < w; i += 8) {
      if ((i / 8) % 3 === 0) {
        ctx.fillRect(i, baseY - 70, 1, 1);
      }
    }
  }

  private drawSpire(ctx: CanvasRenderingContext2D, x: number, baseY: number, h: number): void {
    ctx.fillRect(x, baseY - h, 3, h);
    ctx.fillRect(x - 1, baseY - h, 5, 2);
    ctx.fillRect(x + 1, baseY - h - 3, 1, 3);
  }

  private drawRing(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
    for (let a = 0; a < Math.PI * 2; a += 0.15) {
      const px = Math.round(cx + Math.cos(a) * r);
      const py = Math.round(cy + Math.sin(a) * r * 0.5); // flattened for perspective
      ctx.fillRect(px, py, 1, 1);
    }
  }

  private drawHollowCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
    for (let a = 0; a < Math.PI * 2; a += 0.1) {
      const px = Math.round(cx + Math.cos(a) * r);
      const py = Math.round(cy + Math.sin(a) * r);
      ctx.fillRect(px, py, 1, 1);
    }
  }

  private renderNearLayer(night: boolean): void {
    const ctx = this.nearCtx;
    ctx.clearRect(0, 0, STRIP_WIDTH, VIRTUAL.HEIGHT);
    ctx.fillStyle = '#000';

    if (night) {
      // Stars
      const starRng = new Rng(777);
      for (let i = 0; i < 25; i++) {
        const sx = Math.floor(starRng.range(0, STRIP_WIDTH));
        const sy = Math.floor(starRng.range(10, VIRTUAL.GROUND_Y - 50));
        ctx.fillRect(sx, sy, 1, 1);
      }

      // Moon (circle with bite)
      this.drawMoon(ctx, STRIP_WIDTH * 0.75, 30);
    } else {
      // Clouds
      this.drawCloud(ctx, 100, 40);
      this.drawCloud(ctx, 350, 55);
      this.drawCloud(ctx, 600, 35);
      this.drawCloud(ctx, 900, 50);

      // Sun
      this.drawSun(ctx, STRIP_WIDTH * 0.8, 28);
    }
  }

  private drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.fillRect(x, y, 18, 2);
    ctx.fillRect(x + 2, y - 2, 14, 2);
    ctx.fillRect(x + 5, y - 4, 8, 2);
  }

  private drawSun(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    // Hollow circle
    for (let a = 0; a < Math.PI * 2; a += 0.25) {
      const px = Math.round(cx + Math.cos(a) * 8);
      const py = Math.round(cy + Math.sin(a) * 8);
      ctx.fillRect(px, py, 1, 1);
    }
    // 4 short rays
    ctx.fillRect(cx, cy - 12, 1, 3);
    ctx.fillRect(cx, cy + 10, 1, 3);
    ctx.fillRect(cx - 12, cy, 3, 1);
    ctx.fillRect(cx + 10, cy, 3, 1);
  }

  private drawMoon(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    // Full circle
    for (let a = 0; a < Math.PI * 2; a += 0.2) {
      const px = Math.round(cx + Math.cos(a) * 8);
      const py = Math.round(cy + Math.sin(a) * 8);
      ctx.fillRect(px, py, 1, 1);
    }
    // Fill the circle
    for (let y = -7; y <= 7; y++) {
      const halfW = Math.floor(Math.sqrt(64 - y * y));
      ctx.fillRect(cx - halfW, cy + y, halfW * 2, 1);
    }
    // Bite (clear a circle offset to the right)
    for (let y = -6; y <= 6; y++) {
      const halfW = Math.floor(Math.sqrt(36 - y * y));
      ctx.clearRect(cx + 3 - halfW + 6, cy + y, halfW * 2, 1);
    }
  }

  update(dt: number, worldSpeed: number): void {
    this.farOffset = (this.farOffset + worldSpeed * FAR_PARALLAX * dt) % (STRIP_WIDTH / 2);
    this.nearOffset = (this.nearOffset + worldSpeed * NEAR_PARALLAX * dt) % (STRIP_WIDTH / 2);
  }

  reset(): void {
    this.farOffset = 0;
    this.nearOffset = 0;
  }

  draw(ctx: CanvasRenderingContext2D, _ink: string, alpha: number): void {
    // Far layer — distant silhouettes, lighter
    const farX = -Math.round(this.farOffset);
    ctx.save();
    ctx.globalAlpha = alpha * 0.22;
    ctx.drawImage(this.farStrip, farX, 0);
    if (farX + STRIP_WIDTH < VIRTUAL.WIDTH) {
      ctx.drawImage(this.farStrip, farX + STRIP_WIDTH, 0);
    }
    ctx.restore();

    // Near layer — closer silhouettes / sky objects, slightly denser
    const nearX = -Math.round(this.nearOffset);
    ctx.save();
    ctx.globalAlpha = alpha * 0.32;
    ctx.drawImage(this.nearStrip, nearX, 0);
    if (nearX + STRIP_WIDTH < VIRTUAL.WIDTH) {
      ctx.drawImage(this.nearStrip, nearX + STRIP_WIDTH, 0);
    }
    ctx.restore();

    // Ground-seam dither line — 1px dither row right above the ground, unifies
    // the silhouette baseline with the obstacle pixel grid.
    ctx.save();
    ctx.globalAlpha = alpha * 0.18;
    ctx.fillStyle = _ink;
    for (let x = 0; x < VIRTUAL.WIDTH; x += 4) {
      ctx.fillRect(x, VIRTUAL.GROUND_Y - 1, 2, 1);
    }
    ctx.restore();
  }

  getEra(): Era {
    return this.currentEra;
  }
}
