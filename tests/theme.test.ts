// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Game } from '../src/core/Game';
import { SCORE_CONFIG } from '../src/config';

// Polyfill ImageData for jsdom
if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = class ImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    constructor(w: number, h: number) {
      this.width = w;
      this.height = h;
      this.data = new Uint8ClampedArray(w * h * 4);
    }
  } as any;
}

describe('Theme and background synchronization in Game', () => {
  let container: HTMLElement;
  let overlay: HTMLElement;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      setTransform: vi.fn(),
      imageSmoothingEnabled: false,
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      createImageData: (w: number, h: number) => new ImageData(w, h),
      putImageData: vi.fn(),
      getImageData: (_x: number, _y: number, w: number, h: number) => new ImageData(w, h),
    });

    document.documentElement.style.setProperty('--paper', '#ecdcb6');
    document.documentElement.style.setProperty('--ink', '#2a1e14');
    document.body.style.backgroundColor = '#ecdcb6';

    document.body.innerHTML = `
      <div id="game-container">
        <canvas id="game-canvas"></canvas>
        <div id="branding-strip"></div>
        <div id="ui-overlay"></div>
      </div>
    `;
    container = document.querySelector<HTMLElement>('#game-container')!;
    overlay = document.querySelector<HTMLElement>('#ui-overlay')!;
    canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
  });

  it('checks body and html background color when night turns to day after game restart', () => {
    const game = new Game(canvas, overlay, container);
    (game as any).startRun();

    const loop = (game as any).loop;
    loop.stop();

    // distanceTravelled for score 800 (night)
    (game as any).distanceTravelled = 800 / SCORE_CONFIG.UNITS_PER_PX;

    for (let i = 0; i < 60; i++) {
      (game as any).update(0.016);
    }

    expect((game as any).theme.isNight()).toBe(true);
    expect(document.body.style.backgroundColor).toBe('rgb(11, 13, 26)');

    // Now player dies and restarts:
    (game as any).onCollision();
    (game as any).deathTimer = 0;
    (game as any).update(0.016); // transitions to GAME_OVER

    // Player restarts run
    (game as any).startRun();

    // Check game state and theme
    expect((game as any).theme.isNight()).toBe(false);
    expect((game as any).theme.nightFactor).toBe(0);

    // Canvas background is DAY:
    expect((game as any).theme.palette.paper).toBe('#ecdcb6');

    // document.body and documentElement and --paper must be in DAY theme
    expect(document.body.style.backgroundColor).toBe('rgb(236, 220, 182)');
    expect(document.documentElement.style.backgroundColor).toBe('rgb(236, 220, 182)');
    expect(document.documentElement.style.getPropertyValue('--paper')).toBe('#ecdcb6');
  });

  it('checks body background color when night turns to day during continuous play', () => {
    const game = new Game(canvas, overlay, container);
    (game as any).startRun();

    const loop = (game as any).loop;
    loop.stop();

    // distanceTravelled for score 800 (night)
    (game as any).distanceTravelled = 800 / SCORE_CONFIG.UNITS_PER_PX;
    for (let i = 0; i < 60; i++) {
      (game as any).update(0.016);
    }

    expect((game as any).theme.isNight()).toBe(true);
    expect(document.body.style.backgroundColor).toBe('rgb(11, 13, 26)');

    // distanceTravelled for score 1450 (day again)
    (game as any).distanceTravelled = 1450 / SCORE_CONFIG.UNITS_PER_PX;
    for (let i = 0; i < 60; i++) {
      (game as any).update(0.016);
    }

    expect((game as any).theme.isNight()).toBe(false);
    expect(document.body.style.backgroundColor).toBe('rgb(236, 220, 182)');
    expect(document.documentElement.style.backgroundColor).toBe('rgb(236, 220, 182)');
    expect(document.documentElement.style.getPropertyValue('--paper')).toBe('rgb(236,220,182)');
  });
});
