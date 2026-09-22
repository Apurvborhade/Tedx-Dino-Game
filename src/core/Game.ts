// ════════════════════════════════════════════════════════════════════════════
// Game.ts — Main game coordinator and state machine
// ════════════════════════════════════════════════════════════════════════════

import { Viewport } from './Viewport';
import { Loop } from './Loop';
import { Input } from './Input';
import { Player } from '../entities/Player';
import { Ground } from '../entities/Ground';
import { ObstaclePool, aabbOverlap } from '../entities/Obstacle';
import { ObstacleSpawner } from '../entities/ObstacleSpawner';
import { Backdrop } from '../entities/Backdrop';
import { Score } from '../systems/Score';
import { Difficulty } from '../systems/Difficulty';
import { Theme } from '../systems/Theme';
import { Audio } from '../systems/Audio';
import { Renderer } from '../render/Renderer';
import { ScreenManager } from '../ui/screens';
import { ApiClient } from '../net/api';
import { RunToken } from '../net/runToken';

export type GameState = 'BOOT' | 'READY' | 'PLAYING' | 'DYING' | 'GAME_OVER' | 'PAUSED';

export class Game {
  state: GameState = 'BOOT';

  private viewport: Viewport;
  private loop: Loop;
  private input: Input;
  private player: Player;
  private ground: Ground;
  private obstacles: ObstaclePool;
  private spawner: ObstacleSpawner;
  private backdrop: Backdrop;
  private score: Score;
  private difficulty: Difficulty;
  private theme: Theme;
  private audio: Audio;
  private renderer: Renderer;
  private screens: ScreenManager;
  private api: ApiClient;
  private runToken: RunToken;

  private distanceTravelled = 0;
  private deathTimer = 0;
  private runSeed = 0;

  constructor(canvas: HTMLCanvasElement, uiOverlay: HTMLElement) {
    this.viewport = new Viewport(canvas);
    this.audio = new Audio();
    this.api = new ApiClient();
    this.runToken = new RunToken();

    this.player = new Player();
    this.ground = new Ground();
    this.obstacles = new ObstaclePool(8);
    this.spawner = new ObstacleSpawner(Date.now());
    this.backdrop = new Backdrop();
    this.score = new Score();
    this.difficulty = new Difficulty();
    this.theme = new Theme();
    this.renderer = new Renderer(this.viewport);

    this.screens = new ScreenManager(uiOverlay, this.api, {
      onStart: () => this.startRun(),
      onRestart: () => this.startRun(),
      onToggleMute: () => this.toggleMute(),
      onTogglePause: () => this.togglePause(),
    });

    this.input = new Input(uiOverlay);
    this.input.onFirstGesture = () => {
      this.audio.init();
    };

    this.loop = new Loop(
      (dt) => this.update(dt),
      (alpha) => this.render(alpha)
    );

    this.boot();
  }

  private boot(): void {
    this.state = 'READY';
    this.screens.showReady();
    this.screens.updateAudioUi(this.audio.muted);
    this.loop.start();
    this.api.drainOfflineQueue();
  }

  private startRun(): void {
    this.audio.init();
    this.state = 'PLAYING';
    this.runSeed = Date.now();
    this.distanceTravelled = 0;
    this.deathTimer = 0;

    this.player.reset();
    this.obstacles.reset();
    this.spawner.reset(this.runSeed);
    this.score.reset();
    this.difficulty.reset();
    this.theme.reset();
    this.ground.reset();
    this.backdrop.reset();

    this.runToken.start();
    this.screens.showHud();
    this.player.tryJump(true);
    this.audio.playJump();
  }

  toggleMute(): void {
    this.audio.toggleMute();
    this.screens.updateAudioUi(this.audio.muted);
  }

  togglePause(): void {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      this.screens.showPaused();
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      this.screens.showHud();
    }
  }

  private update(dt: number): void {
    this.input.update(dt);
    this.renderer.update(dt);

    if (this.state === 'READY') {
      if (
        this.screens.getCurrentScreen() === 'READY' &&
        (this.input.jumpPressed || this.input.hasBufferedJump())
      ) {
        this.input.consumeJump();
        this.startRun();
        return;
      }
      this.player.update(dt, false, 30);
      this.backdrop.update(dt, 30);
      this.ground.update(dt, 30);
      return;
    }

    if (this.state === 'GAME_OVER') {
      if (
        this.screens.getCurrentScreen() === 'GAME_OVER' &&
        (this.input.jumpPressed || this.input.hasBufferedJump())
      ) {
        this.input.consumeJump();
        this.startRun();
      }
      return;
    }

    if (this.state === 'DYING') {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) {
        this.state = 'GAME_OVER';
        this.score.finalize();
        const payload = this.runToken.finalize(this.score.value);
        this.screens.showGameOver(
          this.score.value,
          this.score.highScore,
          this.score.isNewBest,
          payload
        );
      }
      return;
    }

    if (this.state !== 'PLAYING') {
      return;
    }

    // 1. Jump input processing with coyote time & jump buffering
    if (this.input.jumpPressed || this.input.hasBufferedJump()) {
      const jumped = this.player.tryJump(this.input.jumpHeld);
      if (jumped) {
        this.input.consumeJump();
        this.runToken.recordJump();
        this.audio.playJump();
      }
    }

    // 2. Difficulty & world speed
    const diffResult = this.difficulty.update(dt, this.score.value);
    if (diffResult.speedChanged && Math.floor(this.difficulty.speed) % 100 === 0) {
      this.audio.playSpeedUp();
    }
    if (diffResult.hardModeStarted) {
      this.audio.playSpeedUp();
    }
    const worldSpeed = this.difficulty.speed;
    const distanceStep = worldSpeed * dt;
    this.distanceTravelled += distanceStep;

    // 3. Score & Milestone sound
    const scoreResult = this.score.update(this.distanceTravelled, dt);
    if (scoreResult.milestone) {
      this.audio.playMilestone();
    }

    // 4. Era & Day/Night Theme transitions
    const themeResult = this.theme.update(this.score.value, dt);
    if (themeResult.eraChanged) {
      this.backdrop.regenerate(this.theme.era, this.theme.isNight());
      this.ground.regenerateStrip(this.theme.era);
      this.audio.playTransition();
    }
    if (themeResult.paletteChanged) {
      this.applyCssTheme();
    }

    // 5. Player physics
    this.player.update(dt, this.input.jumpHeld, worldSpeed);

    // 6. Ground & Backdrop parallax
    this.ground.update(dt, worldSpeed);
    this.backdrop.update(dt, worldSpeed);

    // 7. Obstacle spawning & movement
    this.spawner.update(this.obstacles, worldSpeed, this.score.value, dt);

    // 8. Collision detection
    if (this.checkCollisions()) {
      this.onCollision();
    }
  }

  private checkCollisions(): boolean {
    const playerBox = this.player.getHitbox();
    const activeObs = this.obstacles.getActive();

    for (let i = 0; i < activeObs.length; i++) {
      const obs = activeObs[i]!;
      const obsBox = ObstaclePool.getHitbox(obs);

      if (aabbOverlap(playerBox, obsBox)) {
        return true;
      }
    }
    return false;
  }

  private onCollision(): void {
    this.state = 'DYING';
    this.deathTimer = 0.45;
    this.player.die();
    this.audio.playHit();
    this.renderer.triggerShake(0.35, 5);
  }

  private applyCssTheme(): void {
    const root = document.documentElement;
    root.style.setProperty('--ink', this.theme.palette.ink);
    // Sync page bg + theme-color meta through viewport so there is never a seam
    this.viewport.applyPageBackground(this.theme.palette.paper);
  }

  private render(alpha: number): void {
    this.renderer.render(
      this.player,
      this.ground,
      this.obstacles,
      this.backdrop,
      this.theme,
      this.score,
      this.state,
      this.audio.muted,
      alpha
    );
  }

  destroy(): void {
    this.loop.stop();
    this.viewport.destroy();
    this.audio.destroy();
  }
}
