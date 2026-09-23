// ════════════════════════════════════════════════════════════════════════════
// Player.ts — Kaalchakra wheel: position, velocity, jump, rotation, hitbox
// ════════════════════════════════════════════════════════════════════════════

import { PHYSICS, PLAYER_CONFIG, VIRTUAL } from '../config';

export class Player {
  x: number = PLAYER_CONFIG.X;
  y = VIRTUAL.GROUND_Y;
  prevY = VIRTUAL.GROUND_Y;
  velocityY = 0;
  onGround = true;
  isDead = false;

  // Jump hold tracking
  private holdTime = 0;
  private jumpHeld = false;

  // Coyote time
  private timeSinceOnGround = 0;

  // Rotation
  distanceTravelled = 0;
  rotationFrame = 0;
  private airRotationAccum = 0;

  // Death tilt
  deathTilt = 0;

  // Dust particles
  dustParticles: DustParticle[] = [];
  private dustPool: DustParticle[] = [];

  constructor() {
    // Pre-allocate dust pool
    for (let i = 0; i < 8; i++) {
      this.dustPool.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0 });
    }
  }

  reset(): void {
    this.x = PLAYER_CONFIG.X;
    this.y = VIRTUAL.GROUND_Y;
    this.prevY = VIRTUAL.GROUND_Y;
    this.velocityY = 0;
    this.onGround = true;
    this.isDead = false;
    this.holdTime = 0;
    this.jumpHeld = false;
    this.timeSinceOnGround = 0;
    this.distanceTravelled = 0;
    this.rotationFrame = 0;
    this.airRotationAccum = 0;
    this.deathTilt = 0;
    this.dustParticles.length = 0;
  }

  /** Attempt to jump. Returns true if jump was executed. */
  tryJump(jumpHeld: boolean): boolean {
    const canJump = this.onGround || this.timeSinceOnGround <= PHYSICS.COYOTE_TIME;
    if (!canJump || this.isDead) return false;

    this.velocityY = PHYSICS.JUMP_VELOCITY;
    this.onGround = false;
    this.jumpHeld = jumpHeld;
    this.holdTime = 0;
    this.timeSinceOnGround = Infinity; // consume coyote time
    return true;
  }

  update(dt: number, jumpHeld: boolean, worldSpeed: number): void {
    if (this.isDead) return;

    this.prevY = this.y;
    this.jumpHeld = jumpHeld;

    // Update coyote timer
    if (this.onGround) {
      this.timeSinceOnGround = 0;
    } else {
      this.timeSinceOnGround += dt;
    }

    // Airborne physics
    if (!this.onGround) {
      this.holdTime += dt;

      // Variable jump height
      if (this.jumpHeld && this.velocityY < 0 && this.holdTime < PHYSICS.MAX_HOLD_TIME) {
        this.velocityY += PHYSICS.GRAVITY * PHYSICS.HOLD_GRAVITY_SCALE * dt;
      } else {
        this.velocityY += PHYSICS.GRAVITY * dt;
      }

      // Terminal velocity
      this.velocityY = Math.min(this.velocityY, PHYSICS.MAX_FALL_SPEED);

      this.y += this.velocityY * dt;

      // Landing
      if (this.y >= VIRTUAL.GROUND_Y) {
        this.y = VIRTUAL.GROUND_Y;
        this.velocityY = 0;
        this.onGround = true;
        this.holdTime = 0;
        this.emitDust(worldSpeed);
      }

      // Air rotation (slower)
      this.airRotationAccum += worldSpeed * 0.6 * dt;
    }

    // Ground rotation
    this.distanceTravelled += worldSpeed * dt;

    if (this.onGround) {
      this.rotationFrame = Math.floor(this.distanceTravelled / PLAYER_CONFIG.ROLL_PX_PER_FRAME) % PLAYER_CONFIG.ROLL_FRAMES;
    } else {
      this.rotationFrame = Math.floor(this.airRotationAccum / PLAYER_CONFIG.ROLL_PX_PER_FRAME) % PLAYER_CONFIG.ROLL_FRAMES;
    }

    // Update dust
    this.updateDust(dt);
  }

  die(): void {
    this.isDead = true;
    this.deathTilt = 15 * Math.PI / 180; // 15° tilt
  }

  /** Get interpolated Y for rendering */
  getInterpolatedY(alpha: number): number {
    return this.prevY + (this.y - this.prevY) * alpha;
  }

  /** Get hitbox AABB */
  getHitbox(): { x: number; y: number; w: number; h: number } {
    const inset = PLAYER_CONFIG.HITBOX_INSET;
    const size = PLAYER_CONFIG.SPRITE_SIZE;
    return {
      x: this.x + inset,
      y: this.y - size + inset,
      w: size - inset * 2,
      h: size - inset * 2,
    };
  }

  private emitDust(worldSpeed: number): void {
    const count = 3 + Math.floor(Math.random() * 3); // 3-5 particles
    for (let i = 0; i < count; i++) {
      let particle = this.dustPool.pop();
      if (!particle) {
        particle = { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0 };
      }
      particle.x = this.x + PLAYER_CONFIG.SPRITE_SIZE / 2 + (Math.random() - 0.5) * 8;
      particle.y = VIRTUAL.GROUND_Y;
      particle.vx = -worldSpeed * 0.3 + (Math.random() - 0.5) * 40;
      particle.vy = -(20 + Math.random() * 40);
      particle.life = 0.2;
      particle.maxLife = 0.2;
      this.dustParticles.push(particle);
    }
  }

  private updateDust(dt: number): void {
    for (let i = this.dustParticles.length - 1; i >= 0; i--) {
      const p = this.dustParticles[i]!;
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 100 * dt; // mini gravity
      if (p.life <= 0) {
        this.dustPool.push(p);
        this.dustParticles.splice(i, 1);
      }
    }
  }
}

export interface DustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}
