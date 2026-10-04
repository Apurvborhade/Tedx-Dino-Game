// ════════════════════════════════════════════════════════════════════════════
// screens.ts — Screen manager for DOM overlays (Ready, GameOver, etc.)
// ════════════════════════════════════════════════════════════════════════════

import type { ApiClient } from '../net/api';
import type { RunTokenPayload } from '../net/runToken';
import { HandleForm, getSavedHandle } from './HandleForm';
import { LeaderboardView } from './Leaderboard';
import { tedxLogo } from './tedxLogo';

export type GameScreen = 'READY' | 'HUD' | 'GAME_OVER' | 'HANDLE' | 'LEADERBOARD' | 'PAUSED' | 'HIDDEN';

/** Where BACK on the leaderboard should land. The leaderboard is a modal over
 *  whatever opened it, and the run's state machine is still sitting in that
 *  state — dropping a finished run on the ready screen leaves both halves
 *  disagreeing and nothing accepting input. */
export function returnScreenFor(openedFrom: GameScreen): 'READY' | 'GAME_OVER' {
  return openedFrom === 'GAME_OVER' ? 'GAME_OVER' : 'READY';
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
  private handleContainer: HTMLElement;
  private leaderboardContainer: HTMLElement;
  private pausedScreen: HTMLElement;
  private hudControls: HTMLElement;

  private muteBtnHud: HTMLButtonElement;
  private handleForm: HandleForm;
  private api: ApiClient;
  private leaderboardView: LeaderboardView;

  private currentScreen: GameScreen = 'READY';
  private callbacks: ScreenCallbacks;

  constructor(overlayRoot: HTMLElement, api: ApiClient, callbacks: ScreenCallbacks) {
    this.overlayRoot = overlayRoot;
    this.api = api;
    this.callbacks = callbacks;

    this.overlayRoot.innerHTML = `
      <div id="screen-ready" class="screen-panel active">
        <div class="card center-content">
          <div class="tedx-wordmark">${tedxLogo()}</div>
          <h1 class="hero-title">KAALCHAKRA</h1>
          <p class="hero-subtitle">THE WHEEL OF TIME</p>
          <div class="hero-wheel-container">
            <div class="hero-wheel-icon"></div>
          </div>
          <div class="cta-prompt pulse">TAP SCREEN OR PRESS SPACE TO START</div>
          <div class="hero-subtitle">TAP · SPACE = JUMP &nbsp;&nbsp; HOLD = HIGHER</div>
          <div class="player-line hidden" id="ready-player-line">
            <div>
              <span class="player-label">PLAYING AS</span>
              <span class="player-handle" id="ready-player-handle"></span>
            </div>
            <button type="button" class="link-btn" id="ready-change-btn">CHANGE</button>
          </div>
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
          <div class="tedx-wordmark tedx-wordmark-small">${tedxLogo()}</div>
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
          <div class="form-status" id="go-save-status"></div>
          <div class="button-column">
            <button type="button" class="btn btn-primary btn-large" id="go-retry-btn">RUN AGAIN (SPACE)</button>
            <button type="button" class="btn btn-secondary" id="go-lb-btn">LEADERBOARD</button>
          </div>
        </div>
      </div>

      <div id="screen-handle" class="screen-panel hidden"></div>
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
    this.handleContainer = this.overlayRoot.querySelector('#screen-handle')!;
    this.leaderboardContainer = this.overlayRoot.querySelector('#screen-leaderboard')!;
    this.pausedScreen = this.overlayRoot.querySelector('#screen-paused')!;
    this.hudControls = this.overlayRoot.querySelector('#screen-hud')!;
    this.muteBtnHud = this.overlayRoot.querySelector('#hud-sound-btn')!;

    this.handleForm = new HandleForm(this.handleContainer, {
      onSaved: () => {
        this.showReady();
        this.callbacks.onStart();
      },
      onCancel: () => {
        this.showReady();
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

    const readyChangeBtn = this.overlayRoot.querySelector('#ready-change-btn')!;
    readyChangeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showHandleForm();
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

    const goLbBtn = this.overlayRoot.querySelector('#go-lb-btn')!;
    goLbBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showLeaderboard(this.lastRank);
    });

    // HUD buttons
    this.muteBtnHud.addEventListener('click', (e) => {
      e.stopPropagation();
      this.callbacks.onToggleMute();
    });
  }

  private lastIsNewBest = false;
  /** Rank of the player's best run, from the last successful save. */
  private lastRank: number | undefined;
  /** Bumped per run so a slow save can't write its result onto a later run's card. */
  private saveSeq = 0;
  private returnScreen: 'READY' | 'GAME_OVER' = 'READY';

  showReady(): void {
    const handle = getSavedHandle();
    const line = this.readyScreen.querySelector('#ready-player-line')!;
    line.classList.toggle('hidden', !handle);
    this.readyScreen.querySelector('#ready-player-handle')!.textContent = handle ? `@${handle}` : '';
    this.setScreen('READY');
  }

  showHandleForm(): void {
    this.setScreen('HANDLE');
    this.handleForm.open();
  }

  /** Called when the player tries to start a run. With no handle saved yet,
   *  opens the handle form instead (it starts the run itself once saved). */
  ensureHandle(): boolean {
    if (getSavedHandle()) return true;
    this.showHandleForm();
    return false;
  }

  showHud(): void {
    this.setScreen('HUD');
  }

  showGameOver(score?: number, highScore?: number, isNewBest?: boolean, token?: RunTokenPayload): void {
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

    // A fresh run's result (not a return from the leaderboard): save it.
    if (score !== undefined && token !== undefined) {
      this.autoSave(score, token);
    }

    this.setScreen('GAME_OVER');
  }

  /** Every finished run goes straight to the leaderboard under the saved
   *  handle; the board keeps each player's best, so worse runs don't hurt. */
  private async autoSave(score: number, token: RunTokenPayload): Promise<void> {
    const seq = ++this.saveSeq;
    const statusEl = this.gameOverScreen.querySelector('#go-save-status')!;
    const handle = getSavedHandle();

    if (!handle || score <= 0) {
      statusEl.textContent = '';
      return;
    }

    statusEl.textContent = 'SAVING SCORE...';
    const res = await this.api.submitScore(handle, score, token);
    if (seq !== this.saveSeq) return;

    if (res.success) {
      this.lastRank = res.rank;
      statusEl.textContent = `SAVED AS @${handle.toUpperCase()} · RANK #${res.rank}`;
    } else {
      statusEl.textContent = res.error || 'COULD NOT SAVE SCORE';
    }
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

    this.handleContainer.classList.toggle('active', screen === 'HANDLE');
    this.handleContainer.classList.toggle('hidden', screen !== 'HANDLE');

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
   *  strand the player on a card that ignores input. Modals (handle form,
   *  leaderboard, pause) still swallow the key. */
  acceptsStartInput(): boolean {
    return this.currentScreen === 'READY' || this.currentScreen === 'GAME_OVER';
  }
}
