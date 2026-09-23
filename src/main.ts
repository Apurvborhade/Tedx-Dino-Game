// ════════════════════════════════════════════════════════════════════════════
// main.ts — Application entry point and bootstrapping
// ════════════════════════════════════════════════════════════════════════════

import './style.css';
import { assertConfigSanity } from './config';
import { Game } from './core/Game';

// Run sanity checks in development
assertConfigSanity();

function bootstrap(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
  const overlay = document.querySelector<HTMLElement>('#ui-overlay');
  const container = document.querySelector<HTMLElement>('#game-container');

  if (!canvas || !overlay || !container) {
    console.error('[KALACHAKRA] Canvas, UI Overlay or container DOM node missing.');
    return;
  }

  try {
    const game = new Game(canvas, overlay, container);
    // Attach to window for dev inspection if needed
    if (!import.meta.env.PROD) {
      (window as unknown as { __GAME__: Game }).__GAME__ = game;
    }
  } catch (err) {
    console.error('[KALACHAKRA] Boot error:', err);
    overlay.innerHTML = `
      <div class="screen-panel active">
        <div class="card center-content">
          <h2 class="title-text">BOOT ERROR</h2>
          <p class="subtitle-text">COULD NOT INITIALIZE ENGINE</p>
          <div class="cta-prompt">PLEASE RELOAD THE PAGE</div>
        </div>
      </div>
    `;
  }
}

// Ensure DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
