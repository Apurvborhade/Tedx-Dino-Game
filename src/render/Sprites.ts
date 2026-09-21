// ════════════════════════════════════════════════════════════════════════════
// Sprites.ts — Procedural sprite rasterization → offscreen canvas atlas
// ════════════════════════════════════════════════════════════════════════════

import { PLAYER_CONFIG, type ObstacleTypeName } from '../config';
import { Rng } from '../core/Rng';

const SPOKES = 8;
const SIZE = PLAYER_CONFIG.SPRITE_SIZE; // 32
const FRAMES = PLAYER_CONFIG.ROLL_FRAMES; // 8
const HERO_SIZE = 64;

export interface SpriteAtlas {
  /** 256×32 wheel roll atlas (8 frames × 32px) */
  wheelAtlas: HTMLCanvasElement;
  /** 64×64 hero wheel for start screen */
  wheelHero: HTMLCanvasElement;
  /** Obstacle sprites: key = `TYPE_VARIANT` */
  obstacles: Map<string, HTMLCanvasElement>;
  /** Tinted versions (regenerated on palette change) */
  tintedWheelAtlas: HTMLCanvasElement;
  tintedWheelHero: HTMLCanvasElement;
  tintedObstacles: Map<string, HTMLCanvasElement>;
  /** Mute icon sprites */
  muteOn: HTMLCanvasElement;
  muteOff: HTMLCanvasElement;
}

export function generateSprites(): SpriteAtlas {
  const wheelAtlas = generateWheelAtlas(SIZE, FRAMES);
  const wheelHero = generateWheel(HERO_SIZE);
  const obstacles = generateAllObstacles();
  const muteOn = generateMuteIcon(true);
  const muteOff = generateMuteIcon(false);

  return {
    wheelAtlas,
    wheelHero,
    obstacles,
    tintedWheelAtlas: wheelAtlas, // will be replaced on first tint
    tintedWheelHero: wheelHero,
    tintedObstacles: new Map(obstacles),
    muteOn,
    muteOff,
  };
}

/** Apply ink color tint to all sprites. Tinted canvases are allocated once
 *  and repainted in place with source-in compositing, so this is cheap enough
 *  to call every frame during a palette fade. */
export function tintSprites(atlas: SpriteAtlas, inkR: number, inkG: number, inkB: number): void {
  const color = `rgb(${inkR},${inkG},${inkB})`;
  if (atlas.tintedWheelAtlas === atlas.wheelAtlas) {
    atlas.tintedWheelAtlas = cloneCanvas(atlas.wheelAtlas);
    atlas.tintedWheelHero = cloneCanvas(atlas.wheelHero);
    atlas.tintedObstacles = new Map();
    for (const [key, canvas] of atlas.obstacles) {
      atlas.tintedObstacles.set(key, cloneCanvas(canvas));
    }
  }
  tintInto(atlas.tintedWheelAtlas, atlas.wheelAtlas, color);
  tintInto(atlas.tintedWheelHero, atlas.wheelHero, color);
  for (const [key, canvas] of atlas.obstacles) {
    tintInto(atlas.tintedObstacles.get(key)!, canvas, color);
  }
}

function cloneCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  return c;
}

function tintInto(dst: HTMLCanvasElement, src: HTMLCanvasElement, color: string): void {
  const ctx = dst.getContext('2d')!;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, dst.width, dst.height);
  ctx.drawImage(src, 0, 0);
  // Keep only the source's alpha, replace its colour with ink
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, dst.width, dst.height);
  ctx.globalCompositeOperation = 'source-over';
}

// ── Wheel generation ──────────────────────────────────────────────────────

function generateWheelAtlas(size: number, frames: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size * frames;
  c.height = size;
  const ctx = c.getContext('2d')!;

  for (let f = 0; f < frames; f++) {
    const frameData = renderWheelFrame(size, f, frames);
    ctx.putImageData(frameData, f * size, 0);
  }

  return c;
}

function generateWheel(size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const frameData = renderWheelFrame(size, 0, 1);
  ctx.putImageData(frameData, 0, 0);
  return c;
}

function renderWheelFrame(size: number, frame: number, totalFrames: number): ImageData {
  const imageData = new ImageData(size, size);
  const data = imageData.data;
  const center = (size - 1) / 2;
  const maxR = size / 2;

  // Scale factors relative to 32px reference
  const scale = size / 32;
  const rimOuter = 15.5 * scale;
  const rimInner = 13.0 * scale;
  const hubR = 4.0 * scale;
  const innerRingOuter = 9.5 * scale;
  const innerRingInner = 8.5 * scale;

  const angle = (frame / totalFrames) * (Math.PI * 2 / SPOKES);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const dy = y - center;
      const r = Math.sqrt(dx * dx + dy * dy);
      const theta = Math.atan2(dy, dx) + angle;

      let ink = false;

      // Outer rim
      if (r >= rimInner && r <= rimOuter) ink = true;

      // Hub
      if (r <= hubR) ink = true;

      // Inner ring
      if (r >= innerRingInner && r <= innerRingOuter) ink = true;

      // Spokes
      if (r >= hubR && r <= rimInner) {
        const spokeAngle = ((theta % (Math.PI * 2 / SPOKES)) + (Math.PI * 2 / SPOKES)) % (Math.PI * 2 / SPOKES);
        const halfSpokeAngle = Math.PI / SPOKES;
        const distFromCenter = Math.abs(spokeAngle - halfSpokeAngle);
        const halfWidth = (1.1 * scale) / r;
        if (distFromCenter <= halfWidth) ink = true;
      }

      if (ink && r <= maxR) {
        const idx = (y * size + x) * 4;
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 255;
      }
    }
  }

  // Post-process: remove isolated pixels
  cleanupIsolated(data, size, size);

  return imageData;
}

function cleanupIsolated(data: Uint8ClampedArray, w: number, h: number): void {
  const toRemove: number[] = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (data[idx + 3]! === 0) continue;

      // Check orthogonal neighbours
      let neighbours = 0;
      if (x > 0 && data[((y * w + x - 1) * 4) + 3]! > 0) neighbours++;
      if (x < w - 1 && data[((y * w + x + 1) * 4) + 3]! > 0) neighbours++;
      if (y > 0 && data[(((y - 1) * w + x) * 4) + 3]! > 0) neighbours++;
      if (y < h - 1 && data[(((y + 1) * w + x) * 4) + 3]! > 0) neighbours++;

      if (neighbours === 0) {
        toRemove.push(idx);
      }
    }
  }

  for (const idx of toRemove) {
    data[idx + 3] = 0;
  }
}

// ── Obstacle generation ───────────────────────────────────────────────────

function generateAllObstacles(): Map<string, HTMLCanvasElement> {
  const map = new Map<string, HTMLCanvasElement>();

  const types: ObstacleTypeName[] = ['STONE_SMALL', 'STONE_TALL', 'PILLAR_BROKEN', 'THORN_CLUSTER', 'TIME_BIRD'];

  for (const type of types) {
    for (let variant = 0; variant < 3; variant++) {
      const key = `${type}_${variant}`;
      map.set(key, generateObstacle(type, variant));
    }
  }

  return map;
}

function generateObstacle(type: ObstacleTypeName, variant: number): HTMLCanvasElement {
  const rng = new Rng(type.charCodeAt(0) * 100 + variant * 7);

  let w: number, h: number;
  switch (type) {
    case 'STONE_SMALL': w = 16; h = 20; break;
    case 'STONE_TALL': w = 18; h = 34; break;
    case 'PILLAR_BROKEN': w = 22; h = 30; break;
    case 'THORN_CLUSTER': w = 30; h = 24; break;
    case 'TIME_BIRD': w = 24; h = 16; break;
  }

  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000';

  switch (type) {
    case 'STONE_SMALL':
      drawStoneSmall(ctx, w, h, rng);
      break;
    case 'STONE_TALL':
      drawStoneTall(ctx, w, h, rng);
      break;
    case 'PILLAR_BROKEN':
      drawPillarBroken(ctx, w, h, rng);
      break;
    case 'THORN_CLUSTER':
      drawThornCluster(ctx, w, h, rng);
      break;
    case 'TIME_BIRD':
      drawTimeBird(ctx, w, h, variant);
      break;
  }

  // Cleanup isolated pixels
  const imageData = ctx.getImageData(0, 0, w, h);
  cleanupIsolated(imageData.data, w, h);
  ctx.putImageData(imageData, 0, 0);

  return c;
}

function drawStoneSmall(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng): void {
  // Rough weathered block with chipped top edge
  ctx.fillRect(1, 3, w - 2, h - 3);
  ctx.fillRect(2, 1, w - 4, 2);

  // Chipped top edge
  const chipX = rng.int(3, w - 5);
  ctx.clearRect(chipX, 1, 2, 2);

  // Crack
  const crackX = rng.int(3, w - 4);
  ctx.clearRect(crackX, 4, 1, rng.int(3, 6));
}

function drawStoneTall(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng): void {
  // Slightly tapered standing stone / stele
  ctx.fillRect(2, 4, w - 4, h - 4);
  ctx.fillRect(3, 2, w - 6, 2);
  ctx.fillRect(4, 0, w - 8, 2);

  // Taper bottom slightly wider
  ctx.fillRect(1, h - 6, w - 2, 6);

  // Crack pattern
  const crackX = rng.int(4, w - 5);
  const crackY = rng.int(6, 14);
  ctx.clearRect(crackX, crackY, 1, rng.int(4, 8));
  ctx.clearRect(crackX + 1, crackY + 3, 1, 3);
}

function drawPillarBroken(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng): void {
  // Fluted column body
  const colW = w - 6;
  const colX = 3;
  ctx.fillRect(colX, 6, colW, h - 6);

  // Fluting (vertical grooves)
  for (let fx = colX + 2; fx < colX + colW - 2; fx += 3) {
    ctx.clearRect(fx, 8, 1, h - 10);
  }

  // Base wider
  ctx.fillRect(1, h - 4, w - 2, 4);

  // Jagged snapped top
  const jaggedPoints = [0, 2, 1, 4, 0, 3, 2, 1];
  for (let i = 0; i < colW; i++) {
    const jaggedness = jaggedPoints[i % jaggedPoints.length]! + rng.int(0, 2);
    ctx.fillRect(colX + i, 6 - jaggedness, 1, jaggedness);
  }
}

function drawThornCluster(ctx: CanvasRenderingContext2D, _w: number, _h: number, rng: Rng): void {
  // 3 spiky silhouettes at varied heights
  const positions = [
    { x: 2, h: 18 + rng.int(0, 4) },
    { x: 10, h: 22 + rng.int(0, 2) },
    { x: 20, h: 16 + rng.int(0, 4) },
  ];

  for (const pos of positions) {
    const th = pos.h;
    const baseW = 6;
    const tx = pos.x;
    const baseY = _h;

    // Triangle-ish thorn
    for (let row = 0; row < th; row++) {
      const rowWidth = Math.max(1, Math.round(baseW * (1 - row / th)));
      const rowX = tx + Math.floor((baseW - rowWidth) / 2);
      ctx.fillRect(rowX, baseY - th + row, rowWidth, 1);
    }
  }
}

function drawTimeBird(ctx: CanvasRenderingContext2D, w: number, h: number, variant: number): void {
  // 24x16 bird silhouette: hollow 3px body circle + M-shaped wings
  const cx = w / 2;   // 12
  const cy = h / 2;   // 8
  const bodyR = 3;    // 3px radius hollow circle

  // Draw hollow circle body
  for (let a = 0; a < Math.PI * 2; a += 0.25) {
    const px = Math.round(cx + Math.cos(a) * bodyR);
    const py = Math.round(cy + Math.sin(a) * bodyR);
    ctx.fillRect(px, py, 1, 1);
  }

  // Wing span varies by variant: 0=narrow, 1=medium, 2=wide
  const spanLeft  = [5, 7, 9][variant] ?? 7;
  const spanRight = spanLeft;
  const wingDip   = [2, 2, 3][variant] ?? 2; // how low the M-dip goes

  // Left wing: rises from body left edge outward, dips then rises to tip
  const lx0 = Math.round(cx - bodyR - 1); // wing attach point
  const lTip = lx0 - spanLeft;
  const lMid = Math.round((lx0 + lTip) / 2);

  ctx.fillRect(lx0, cy - 1, 1, 1);
  for (let x = lx0; x >= lTip; x--) {
    const t = (lx0 - x) / spanLeft;
    // M shape: dips in the middle
    const midDist = Math.abs(t - 0.5) * 2; // 0 at center, 1 at edges
    const yOff = Math.round((1 - midDist) * wingDip);
    ctx.fillRect(x, cy - 2 + yOff, 1, 1);
  }
  // Extra tip pixel
  ctx.fillRect(lMid, cy - 2 + wingDip, 1, 1);

  // Right wing (mirrored)
  const rx0 = Math.round(cx + bodyR + 1);
  const rTip = rx0 + spanRight;
  const rMid = Math.round((rx0 + rTip) / 2);

  for (let x = rx0; x <= rTip; x++) {
    const t = (x - rx0) / spanRight;
    const midDist = Math.abs(t - 0.5) * 2;
    const yOff = Math.round((1 - midDist) * wingDip);
    ctx.fillRect(x, cy - 2 + yOff, 1, 1);
  }
  ctx.fillRect(rMid, cy - 2 + wingDip, 1, 1);

  // Small tail fan
  ctx.fillRect(Math.round(cx - 1), cy + bodyR, 3, 1);
  ctx.fillRect(Math.round(cx - 2), cy + bodyR + 1, 5, 1);
}

// ── Mute icon ─────────────────────────────────────────────────────────────

function generateMuteIcon(soundOn: boolean): HTMLCanvasElement {
  const size = 16;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000';

  // Speaker body
  ctx.fillRect(2, 5, 4, 6);
  ctx.fillRect(6, 3, 2, 10);

  if (soundOn) {
    // Sound waves
    ctx.fillRect(10, 5, 1, 1);
    ctx.fillRect(10, 10, 1, 1);
    ctx.fillRect(11, 6, 1, 4);

    ctx.fillRect(13, 4, 1, 1);
    ctx.fillRect(13, 11, 1, 1);
    ctx.fillRect(14, 5, 1, 6);
  } else {
    // X through speaker
    ctx.fillRect(10, 5, 1, 1);
    ctx.fillRect(11, 6, 1, 1);
    ctx.fillRect(12, 7, 1, 1);
    ctx.fillRect(13, 8, 1, 1);
    ctx.fillRect(14, 9, 1, 1);

    ctx.fillRect(14, 5, 1, 1);
    ctx.fillRect(13, 6, 1, 1);
    ctx.fillRect(12, 7, 1, 1);
    ctx.fillRect(11, 8, 1, 1);
    ctx.fillRect(10, 9, 1, 1);
  }

  return c;
}

/** Get obstacle sprite key */
export function getObstacleKey(type: ObstacleTypeName, variant: number): string {
  return `${type}_${variant}`;
}
