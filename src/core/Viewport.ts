// ════════════════════════════════════════════════════════════════════════════
// Viewport.ts — Canvas sizing, DPR, integer scaling, safe-area math
// ════════════════════════════════════════════════════════════════════════════

import { VIRTUAL } from '../config';

export class Viewport {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  scale = 1;
  dpr = 1;
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

    // Compute largest integer scale that fits
    const scaleX = this.containerWidth / VIRTUAL.WIDTH;
    const scaleY = this.containerHeight / VIRTUAL.HEIGHT;
    let s = Math.min(scaleX, scaleY);

    // Floor to integer when >= 1 for crisp pixels
    if (s >= 1) {
      s = Math.floor(s);
    } else {
      // Sub-1: snap to whole device pixels
      s = Math.floor(s * this.dpr * VIRTUAL.WIDTH) / (this.dpr * VIRTUAL.WIDTH);
      if (s <= 0) s = scaleX; // fallback: just fit width
    }

    this.scale = s;
    this.cssWidth = Math.round(VIRTUAL.WIDTH * s);
    this.cssHeight = Math.round(VIRTUAL.HEIGHT * s);

    // Set canvas backing store
    this.canvas.width = Math.round(VIRTUAL.WIDTH * s * this.dpr);
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
