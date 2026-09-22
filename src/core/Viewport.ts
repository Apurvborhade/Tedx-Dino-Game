// ════════════════════════════════════════════════════════════════════════════
// Viewport.ts — Canvas sizing, DPR, integer scaling, safe-area math
// ════════════════════════════════════════════════════════════════════════════

import { VIRTUAL, VIEWPORT, PLAYER_CONFIG } from '../config';

export class Viewport {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  scale = 1;
  dpr = 1;
  /** Virtual px of world actually shown (≤ VIRTUAL.WIDTH; cropped in portrait) */
  visibleWidth: number = VIRTUAL.WIDTH;
  /** Where the wheel sits: closer to the left edge on a cropped portrait view
   *  so there is still track visible ahead of it. */
  playerX: number = PLAYER_CONFIG.X;
  cssWidth: number = VIRTUAL.WIDTH;
  cssHeight: number = VIRTUAL.HEIGHT;
  containerWidth = window.innerWidth;
  containerHeight = window.innerHeight;

  private resizeTimer = 0;
  private brandingStrip: HTMLElement | null;
  private themeColorMeta: HTMLMetaElement | null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;

    this.brandingStrip = document.getElementById('branding-strip');
    this.themeColorMeta = document.querySelector('meta[name="theme-color"]');

    this.onResize();
    window.addEventListener('resize', this.debouncedResize);

    // Handle iOS URL bar collapse
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this.debouncedResize);
    }
  }

  private debouncedResize = (): void => {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => this.onResize(), 150);
  };

  onResize(): void {
    this.containerWidth = window.innerWidth;
    this.containerHeight = window.visualViewport?.height ?? window.innerHeight;

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Portrait phones: the full 640px world would render tiny, so crop the
    // right side of the world until each virtual px is at least
    // PORTRAIT_MIN_SCALE CSS px. Obstacles still spawn at VIRTUAL.WIDTH and
    // simply enter view a little later.
    let visibleW: number = VIRTUAL.WIDTH;
    if (this.containerHeight > this.containerWidth) {
      visibleW = Math.round(this.containerWidth / VIEWPORT.PORTRAIT_MIN_SCALE);
      visibleW = Math.max(VIEWPORT.MIN_VISIBLE_WIDTH, Math.min(VIRTUAL.WIDTH, visibleW));
    }
    this.visibleWidth = visibleW;
    this.playerX = visibleW < VIEWPORT.NARROW_WIDTH ? VIEWPORT.PORTRAIT_PLAYER_X : PLAYER_CONFIG.X;

    // Compute largest integer scale that fits
    const scaleX = this.containerWidth / visibleW;
    const scaleY = this.containerHeight / VIRTUAL.HEIGHT;
    let s = Math.min(scaleX, scaleY);

    // Floor to integer when >= 2 for crisp pixels. Between 1 and 2 (landscape
    // phones, small windows) flooring to 1 wastes too much screen, so allow a
    // fractional scale there and just snap it to whole device pixels.
    if (s >= 2) {
      s = Math.floor(s);
    } else {
      s = Math.floor(s * this.dpr * visibleW) / (this.dpr * visibleW);
      if (s <= 0) s = scaleX; // fallback: just fit width
    }

    this.scale = s;
    this.cssWidth = Math.round(visibleW * s);
    this.cssHeight = Math.round(VIRTUAL.HEIGHT * s);

    // Set canvas backing store
    this.canvas.width = Math.round(visibleW * s * this.dpr);
    this.canvas.height = Math.round(VIRTUAL.HEIGHT * s * this.dpr);

    // CSS size
    this.canvas.style.width = `${this.cssWidth}px`;
    this.canvas.style.height = `${this.cssHeight}px`;

    // Transform so we draw in virtual units
    this.ctx.setTransform(s * this.dpr, 0, 0, s * this.dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;

    // Branding strip: show in portrait when there is enough letterbox
    this._updateBrandingStrip(s);
  }

  /** Update branding strip visibility + font scale based on current layout */
  private _updateBrandingStrip(s: number): void {
    const strip = this.brandingStrip;
    if (!strip) return;

    const isPortrait = this.containerHeight > this.containerWidth;
    const verticalSlack = this.containerHeight - this.cssHeight;
    const BRAND_THRESHOLD = 20; // px of free space needed

    if (isPortrait && verticalSlack >= BRAND_THRESHOLD) {
      strip.classList.add('visible');
      // Scale font with integer scale (clamp 1–3)
      const fs = Math.max(1, Math.min(3, s));
      const elEvent = strip.querySelector('.brand-event') as HTMLElement | null;
      const elTitle = strip.querySelector('.brand-title') as HTMLElement | null;
      const elHint  = strip.querySelector('.brand-hint')  as HTMLElement | null;
      if (elEvent) elEvent.style.fontSize = `${9 * fs}px`;
      if (elTitle) elTitle.style.fontSize = `${14 * fs}px`;
      if (elHint)  elHint.style.fontSize  = `${7 * fs}px`;

      // Allocate half the slack to the strip height (so canvas stays centered-ish)
      strip.style.height = `${Math.min(Math.floor(verticalSlack / 2), 60 * fs)}px`;
    } else {
      strip.classList.remove('visible');
    }
  }

  /** Apply paper colour to page background and theme-color meta (called by Game on palette change) */
  applyPageBackground(paper: string): void {
    document.documentElement.style.setProperty('--paper', paper);
    document.body.style.backgroundColor = paper;
    if (this.themeColorMeta) {
      this.themeColorMeta.setAttribute('content', paper);
    }
  }

  /** Call before each frame's draw calls */
  prepareFrame(): void {
    this.ctx.imageSmoothingEnabled = false;
  }

  destroy(): void {
    window.removeEventListener('resize', this.debouncedResize);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this.debouncedResize);
    }
  }
}
