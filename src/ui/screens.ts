// ════════════════════════════════════════════════════════════════════════════
// screens.ts — Screen manager for DOM overlays (Ready, GameOver, etc.)
// ════════════════════════════════════════════════════════════════════════════

import type { ApiClient } from '../net/api';
import type { RunTokenPayload } from '../net/runToken';
import { SubmitForm } from './SubmitForm';
import { LeaderboardView } from './Leaderboard';

export type GameScreen = 'READY' | 'HUD' | 'GAME_OVER' | 'SUBMIT' | 'LEADERBOARD' | 'PAUSED' | 'HIDDEN';

/** Where BACK on the leaderboard should land. The leaderboard is a modal over
 *  whatever opened it, and the run's state machine is still sitting in that
 *  state — dropping a finished run on the ready screen leaves both halves
 *  disagreeing and nothing accepting input. */
export function returnScreenFor(openedFrom: GameScreen): 'READY' | 'GAME_OVER' {
  // SUBMIT chains into the leaderboard on success; its card belongs to a
  // finished run, so it goes back to game over too.
  return openedFrom === 'GAME_OVER' || openedFrom === 'SUBMIT' ? 'GAME_OVER' : 'READY';
}

export interface ScreenCallbacks {
  onStart: () => void;
  onRestart: () => void;
  onToggleMute: () => void;
  onTogglePause: () => void;
}

export class ScreenManager {
  private overlayRoot: HTMLElement;
  private readyScreen: HTMLElement;
  private gameOverScreen: HTMLElement;
  private submitContainer: HTMLElement;
  private leaderboardContainer: HTMLElement;
  private pausedScreen: HTMLElement;
  private hudControls: HTMLElement;

  private muteBtnHud: HTMLButtonElement;
  private submitForm: SubmitForm;
  private leaderboardView: LeaderboardView;

  private currentScreen: GameScreen = 'READY';
  private callbacks: ScreenCallbacks;

  constructor(overlayRoot: HTMLElement, api: ApiClient, callbacks: ScreenCallbacks) {
    this.overlayRoot = overlayRoot;
    this.callbacks = callbacks;

    this.overlayRoot.innerHTML = `
      <div id="screen-ready" class="screen-panel active">
        <div class="card center-content">
          <div class="tedx-wordmark"><span class="tedx-ted">TED<span class="tedx-x">x</span></span> DYPDPU</div>
          <h1 class="hero-title">KAALCHAKRA</h1>
          <p class="hero-subtitle">THE WHEEL OF TIME</p>
          <div class="hero-wheel-container">
            <div class="hero-wheel-icon"></div>
          </div>
          <div class="cta-prompt pulse">TAP SCREEN OR PRESS SPACE TO START</div>
          <div class="hero-subtitle">TAP · SPACE = JUMP &nbsp;&nbsp; HOLD = HIGHER</div>
          <div class="button-row">
            <button type="button" class="btn btn-secondary" id="ready-lb-btn">LEADERBOARD</button>
            <button type="button" class="btn btn-icon" id="ready-sound-btn" title="Toggle Sound">🔊</button>
          </div>
        </div>
      </div>

      <div id="screen-hud" class="hud-layer">
        <button type="button" class="hud-btn" id="hud-sound-btn" title="Mute">🔊</button>
      </div>

      <div id="screen-gameover" class="screen-panel hidden">
        <div class="card center-content">
          <div class="tedx-wordmark tedx-wordmark-small"><span class="tedx-ted">TED<span class="tedx-x">x</span></span> DYPDPU</div>
          <h2 class="crash-title">TIME COLLAPSED</h2>
          <div class="score-summary">
            <div class="score-box">
              <span class="score-label">SCORE</span>
              <span class="score-value" id="go-score">000000</span>
            </div>
            <div class="score-box">
              <span class="score-label">BEST</span>
              <span class="score-value" id="go-hiscore">000000</span>
            </div>
          </div>
          <div id="new-best-badge" class="new-best hidden">★ NEW RECORD ★</div>
          <div class="button-column">
            <button type="button" class="btn btn-primary btn-large" id="go-retry-btn">RUN AGAIN (SPACE)</button>
            <div class="button-row">
              <button type="button" class="btn btn-secondary" id="go-submit-btn">SUBMIT SCORE</button>
              <button type="button" class="btn btn-secondary" id="go-lb-btn">LEADERBOARD</button>
            </div>
          </div>
        </div>
      </div>

      <div id="screen-submit" class="screen-panel hidden"></div>
      <div id="screen-leaderboard" class="screen-panel hidden"></div>

      <div id="screen-paused" class="screen-panel hidden">
        <div class="card center-content">
          <h2 class="title-text">PAUSED</h2>
          <div class="cta-prompt">TAP OR PRESS ESC TO RESUME</div>
        </div>
      </div>
    `;

    this.readyScreen = this.overlayRoot.querySelector('#screen-ready')!;
    this.gameOverScreen = this.overlayRoot.querySelector('#screen-gameover')!;
    this.submitContainer = this.overlayRoot.querySelector('#screen-submit')!;
    this.leaderboardContainer = this.overlayRoot.querySelector('#screen-leaderboard')!;
    this.pausedScreen = this.overlayRoot.querySelector('#screen-paused')!;
    this.hudControls = this.overlayRoot.querySelector('#screen-hud')!;
    this.muteBtnHud = this.overlayRoot.querySelector('#hud-sound-btn')!;

    this.submitForm = new SubmitForm(this.submitContainer, api, {
      onSubmitSuccess: (rank) => {
        this.showLeaderboard(rank);
      },
      onCancel: () => {
        this.showGameOver();
      },
    });

    this.leaderboardView = new LeaderboardView(this.leaderboardContainer, api, {
      onClose: () => {
        if (this.currentScreen !== 'LEADERBOARD') return;
        if (this.returnScreen === 'GAME_OVER') {
          this.showGameOver();
        } else {
          this.showReady();
        }
      },
    });

    this.setupListeners();
  }

  private setupListeners(): void {
    // Ready screen buttons
    const readyLbBtn = this.overlayRoot.querySelector('#ready-lb-btn')!;
    readyLbBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showLeaderboard();
    });

    const readySoundBtn = this.overlayRoot.querySelector('#ready-sound-btn') as HTMLButtonElement;
    readySoundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.callbacks.onToggleMute();
    });

    // Game Over buttons
    const retryBtn = this.overlayRoot.querySelector('#go-retry-btn')!;
    retryBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.callbacks.onRestart();
    });

    const goSubmitBtn = this.overlayRoot.querySelector('#go-submit-btn')!;
    goSubmitBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.lastToken) {
        this.showSubmit(this.lastScore, this.lastToken);
      }
    });

    const goLbBtn = this.overlayRoot.querySelector('#go-lb-btn')!;
    goLbBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showLeaderboard();
    });

    // HUD buttons
    this.muteBtnHud.addEventListener('click', (e) => {
      e.stopPropagation();
      this.callbacks.onToggleMute();
    });
  }

  private lastScore = 0;
  private lastToken: RunTokenPayload | null = null;
  private lastIsNewBest = false;
  private returnScreen: 'READY' | 'GAME_OVER' = 'READY';

  showReady(): void {
    this.setScreen('READY');
  }

  showHud(): void {
    this.setScreen('HUD');
  }

  showGameOver(score?: number, highScore?: number, isNewBest?: boolean, token?: RunTokenPayload): void {
    if (score !== undefined) this.lastScore = score;
    if (token !== undefined) this.lastToken = token;
    if (isNewBest !== undefined) this.lastIsNewBest = isNewBest;

    if (score !== undefined) {
      const scoreEl = this.gameOverScreen.querySelector('#go-score')!;
      scoreEl.textContent = String(score).padStart(6, '0');
    }
    if (highScore !== undefined) {
      const hiEl = this.gameOverScreen.querySelector('#go-hiscore')!;
      hiEl.textContent = String(highScore).padStart(6, '0');
    }

    const badge = this.gameOverScreen.querySelector('#new-best-badge')!;
    if (this.lastIsNewBest) {
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }

    this.setScreen('GAME_OVER');
  }

  showSubmit(score: number, token: RunTokenPayload): void {
    this.setScreen('SUBMIT');
    this.submitForm.open(score, token);
  }

  showLeaderboard(highlightRank?: number): void {
    this.returnScreen = returnScreenFor(this.currentScreen);
    this.setScreen('LEADERBOARD');
    this.leaderboardView.open(highlightRank);
  }

  showPaused(): void {
    this.setScreen('PAUSED');
  }

  updateAudioUi(isMuted: boolean): void {
    const icon = isMuted ? '🔇' : '🔊';
    this.muteBtnHud.textContent = icon;
    const readySound = this.overlayRoot.querySelector('#ready-sound-btn');
    if (readySound) readySound.textContent = icon;
  }

  private setScreen(screen: GameScreen): void {
    this.currentScreen = screen;

    this.readyScreen.classList.toggle('active', screen === 'READY');
    this.readyScreen.classList.toggle('hidden', screen !== 'READY');

    this.gameOverScreen.classList.toggle('active', screen === 'GAME_OVER');
    this.gameOverScreen.classList.toggle('hidden', screen !== 'GAME_OVER');

    this.submitContainer.classList.toggle('active', screen === 'SUBMIT');
    this.submitContainer.classList.toggle('hidden', screen !== 'SUBMIT');

    this.leaderboardContainer.classList.toggle('active', screen === 'LEADERBOARD');
    this.leaderboardContainer.classList.toggle('hidden', screen !== 'LEADERBOARD');

    this.pausedScreen.classList.toggle('active', screen === 'PAUSED');
    this.pausedScreen.classList.toggle('hidden', screen !== 'PAUSED');

    this.hudControls.classList.toggle('active', screen === 'HUD');
  }

  getCurrentScreen(): GameScreen {
    return this.currentScreen;
  }

  /** True when a jump press should start/restart a run. Both cards invite it
   *  ("PRESS SPACE TO START" / "RUN AGAIN (SPACE)"), and accepting either one
   *  regardless of the run state means a screen/state mismatch can never
   *  strand the player on a card that ignores input. Modals (submit form,
   *  leaderboard, pause) still swallow the key. */
  acceptsStartInput(): boolean {
    return this.currentScreen === 'READY' || this.currentScreen === 'GAME_OVER';
  }
}
