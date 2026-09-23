// @vitest-environment jsdom
//
// Regression test: a tap on the canvas during a run must reach Input.
// #ui-overlay is pointer-events:none, so once the HUD screen is up a tap
// lands on the canvas — which is not inside the overlay. Listening there
// meant the game was unplayable by touch.
import { describe, it, expect, beforeEach } from 'vitest';
import { Input } from '../src/core/Input';

function buildDom() {
  document.body.innerHTML = `
    <div id="game-container">
      <canvas id="game-canvas"></canvas>
      <div id="ui-overlay">
        <div id="screen-hud" class="hud-layer active">
          <button type="button" id="hud-sound-btn">S</button>
        </div>
      </div>
    </div>`;
  return {
    container: document.querySelector<HTMLElement>('#game-container')!,
    overlay: document.querySelector<HTMLElement>('#ui-overlay')!,
    canvas: document.querySelector<HTMLElement>('#game-canvas')!,
    muteBtn: document.querySelector<HTMLElement>('#hud-sound-btn')!,
  };
}

const tap = (el: HTMLElement) => {
  el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
  el.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0 }));
};

describe('Touch input targets', () => {
  let dom: ReturnType<typeof buildDom>;
  beforeEach(() => { dom = buildDom(); });

  it('registers a tap on the canvas when bound to the container', () => {
    const input = new Input(dom.container);
    tap(dom.canvas);
    input.update(1 / 120);
    expect(input.jumpPressed).toBe(true);
  });

  it('misses that tap when bound to the pointer-events:none overlay (the bug)', () => {
    const input = new Input(dom.overlay);
    tap(dom.canvas);
    input.update(1 / 120);
    expect(input.jumpPressed).toBe(false);
  });

  it('still ignores taps on HUD buttons', () => {
    const input = new Input(dom.container);
    tap(dom.muteBtn);
    input.update(1 / 120);
    expect(input.jumpPressed).toBe(false);
  });
});
