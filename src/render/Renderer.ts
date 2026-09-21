// ════════════════════════════════════════════════════════════════════════════
// Renderer.ts — 2D canvas draw coordinator, pixel snapping, draw order
// ════════════════════════════════════════════════════════════════════════════

import { VIRTUAL, SCORE_CONFIG, PLAYER_CONFIG } from '../config';
import type { Viewport } from '../core/Viewport';
import type { Player } from '../entities/Player';
import type { Ground } from '../entities/Ground';
import type { ObstaclePool } from '../entities/Obstacle';
import type { Backdrop } from '../entities/Backdrop';
import type { Theme } from '../systems/Theme';
import type { Score } from '../systems/Score';
import { generateSprites, tintSprites, HALO, type SpriteAtlas } from './Sprites';
import { PixelFont } from './PixelFont';

export class Renderer {
  private viewport: Viewport;
  private atlas: SpriteAtlas;
  private currentInkR = -1;
  private currentInkG = -1;
  private currentInkB = -1;
  private currentPaperR = -1;

  private shakeTimer = 0;
  private shakeIntensity = 0;

  constructor(viewport: Viewport) {
    this.viewport = viewport;
    this.atlas = generateSprites();
  }

  triggerShake(duration = 0.25, intensity = 4): void {
    this.shakeTimer = duration;
    this.shakeIntensity = intensity;
  }

  update(dt: number): void {
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    }
  }

  render(
    player: Player,
    _ground: Ground,
    obstacles: ObstaclePool,
    backdrop: Backdrop,
    theme: Theme,
    score: Score,
    state: string,
    isMuted: boolean,
    interpolationAlpha: number
  ): void {
    const ctx = this.viewport.ctx;
    this.viewport.prepareFrame();

    // Check if we need to re-tint sprites
    const pal = theme.palette;
    if (
      this.currentInkR !== pal.inkR ||
      this.currentInkG !== pal.inkG ||
      this.currentInkB !== pal.inkB ||
      this.currentPaperR !== pal.paperR
    ) {
      this.currentInkR = pal.inkR;
      this.currentInkG = pal.inkG;
      this.currentInkB = pal.inkB;
      this.currentPaperR = pal.paperR;
      tintSprites(this.atlas, pal.inkR, pal.inkG, pal.inkB, pal.paperR, pal.paperG, pal.paperB);
    }

    // 1. Clear background (Paper color)
    ctx.save();
    ctx.fillStyle = theme.palette.paper;
    ctx.fillRect(0, 0, VIRTUAL.WIDTH, VIRTUAL.HEIGHT);

    // Screen shake
    if (this.shakeTimer > 0) {
      const offsetX = Math.round((Math.random() - 0.5) * 2 * this.shakeIntensity);
      const offsetY = Math.round((Math.random() - 0.5) * 2 * this.shakeIntensity);
      ctx.translate(offsetX, offsetY);
    }

    // 2. Painted backdrop plates (day ⇄ night crossfade by score cycle)
    backdrop.draw(ctx, theme.nightFactor, theme.palette.paper);

    // 3. Ground — the painted wall in the backdrop is the floor now; no ink
    //    baseline is drawn over it.

    // 4. Obstacles (ground and flying)
    const activeObs = obstacles.getActive();
    for (let i = 0; i < activeObs.length; i++) {
      const obs = activeObs[i]!;
      const key = `${obs.type}_${obs.variant}`;
      const sprite = this.atlas.tintedObstacles.get(key) || this.atlas.obstacles.get(key);
      if (sprite) {
        const drawX = Math.round(obs.x);
        // flyY>0: absolute top-Y; 0: ground-anchored
        const drawY = obs.flyY > 0
          ? Math.round(obs.flyY)
          : Math.round(VIRTUAL.GROUND_Y - obs.height);
        const halo = this.atlas.haloObstacles.get(key);
        if (halo) ctx.drawImage(halo, drawX - HALO, drawY - HALO);
        ctx.drawImage(sprite, drawX, drawY);
      }
    }

    // 5. Dust Particles
    if (player.dustParticles.length > 0) {
      ctx.fillStyle = theme.palette.ink;
      for (const p of player.dustParticles) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
        ctx.restore();
      }
    }

    // 6. Player (Rolling Kalachakra Wheel)
    this.drawPlayer(ctx, player, interpolationAlpha);

    // 7. HUD / Score overlay
    if (state === 'PLAYING' || state === 'DYING' || state === 'GAME_OVER' || state === 'PAUSED') {
      this.drawHUD(ctx, score, theme.palette.ink, isMuted);
    }

    ctx.restore();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, player: Player, alpha: number): void {
    const size = PLAYER_CONFIG.SPRITE_SIZE;
    const interpolatedY = player.getInterpolatedY(alpha);
    const drawX = Math.round(player.x);
    const drawY = Math.round(interpolatedY - size);

    ctx.save();

    if (player.isDead) {
      // Rotate around wheel center with death tilt
      const centerX = drawX + size / 2;
      const centerY = drawY + size / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate(player.deathTilt);
      // Draw frame 0 or last frame
      const frameIdx = player.rotationFrame % PLAYER_CONFIG.ROLL_FRAMES;
      this.drawWheelFrame(ctx, frameIdx, -size / 2, -size / 2);
    } else {
      const frameIdx = player.rotationFrame % PLAYER_CONFIG.ROLL_FRAMES;
      this.drawWheelFrame(ctx, frameIdx, drawX, drawY);
    }

    ctx.restore();
  }

  /** Halo outline first, then the ink wheel frame on top. */
  private drawWheelFrame(ctx: CanvasRenderingContext2D, frameIdx: number, x: number, y: number): void {
    const size = PLAYER_CONFIG.SPRITE_SIZE;
    const haloSize = size + HALO * 2;
    // Halo atlas frames are stacked with the same stride as the wheel atlas,
    // offset by HALO; frame i starts at i*size + HALO - HALO = i*size.
    ctx.drawImage(
      this.atlas.haloWheelAtlas,
      frameIdx * size, 0, haloSize, haloSize,
      x - HALO, y - HALO, haloSize, haloSize
    );
    ctx.drawImage(
      this.atlas.tintedWheelAtlas,
      frameIdx * size, 0, size, size,
      x, y, size, size
    );
  }

  private drawHUD(
    ctx: CanvasRenderingContext2D,
    score: Score,
    inkColor: string,
    isMuted: boolean
  ): void {
    const scoreStr = score.format();
    const hiScoreStr = `HI ${String(score.highScore).padStart(SCORE_CONFIG.DIGITS, '0')}`;

    // Scale=3 → each 5×7 glyph becomes 15×21 virtual px.
    // 6-digit score = 6 * (5*3 + 3) - 3 = 105px ≈ 16.4% of 640 width.
    // Glyph height 21px / 240 canvas height ≈ 8.75% (nice and readable).
    const scoreScale = 3;
    const hiScale    = 2; // high score slightly smaller

    const digitWidth = PixelFont.measureWidth(scoreStr, scoreScale);
    const hiWidth    = PixelFont.measureWidth(hiScoreStr, hiScale);

    const rightMargin = this.viewport.visibleWidth - 8;
    const topMargin   = 8;

    // Draw Current Score (respecting milestone flash visibility)
    if (score.isVisible()) {
      PixelFont.draw(
        ctx,
        scoreStr,
        rightMargin - digitWidth,
        topMargin,
        inkColor,
        scoreScale
      );
    }

    // Draw High Score (dimmed / always visible)
    if (score.highScore > 0) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      PixelFont.draw(
        ctx,
        hiScoreStr,
        rightMargin - digitWidth - hiWidth - 10,
        topMargin + (7 * scoreScale - 7 * hiScale) / 2, // vertically centre with score
        inkColor,
        hiScale
      );
      ctx.restore();
    }

    // Muted icon indicator if muted
    if (isMuted) {
      PixelFont.draw(ctx, '[MUTE]', 8, topMargin + 7 * scoreScale + 4, inkColor, 1);
    }
  }
}
