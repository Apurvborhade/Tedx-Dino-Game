// ════════════════════════════════════════════════════════════════════════════
// ObstacleSpawner.ts — Spawn timing, type selection, spacing guarantees
// ════════════════════════════════════════════════════════════════════════════

import { SPAWN, OBSTACLE_TYPES, VIRTUAL, PHYSICS, FLYERS, HARD_MODE, type ObstacleTypeName } from '../config';
import { Rng } from '../core/Rng';
import { ObstaclePool } from './Obstacle';

const TYPE_NAMES: readonly ObstacleTypeName[] = ['STONE_SMALL', 'STONE_TALL', 'PILLAR_BROKEN', 'THORN_CLUSTER', 'OBELISK'] as const;

/** Maximum number of variants per obstacle type */
const MAX_VARIANTS = 3;

export class ObstacleSpawner {
  private rng: Rng;
  private nextSpawnX: number;
  private lastTypes: ObstacleTypeName[] = [];
  private lastWasCluster = false;
  private consecutiveClusterCount = 0;
  /** Spawns left in the current tightened stretch (see SPAWN.BURST_*) */
  private burstRemaining = 0;

  constructor(seed: number) {
    this.rng = new Rng(seed);
    this.nextSpawnX = VIRTUAL.WIDTH + 100; // first obstacle slightly off-screen
  }

  reset(seed: number): void {
    this.rng = new Rng(seed);
    this.nextSpawnX = VIRTUAL.WIDTH + 100;
    this.lastTypes.length = 0;
    this.lastWasCluster = false;
    this.consecutiveClusterCount = 0;
    this.burstRemaining = 0;
  }

  update(pool: ObstaclePool, worldSpeed: number, score: number, dt: number): void {
    // Move all active obstacles
    for (const ob of pool.active) {
      ob.x -= worldSpeed * dt;
    }

    // Despawn off-screen
    for (let i = pool.active.length - 1; i >= 0; i--) {
      const ob = pool.active[i]!;
      if (ob.x + ob.width < -40) {
        pool.despawn(ob);
      }
    }

    // Scroll spawn point
    this.nextSpawnX -= worldSpeed * dt;

    // Spawn when ready
    if (this.nextSpawnX <= VIRTUAL.WIDTH) {
      this.spawnObstacle(pool, worldSpeed, score);
    }
  }

  private spawnObstacle(pool: ObstaclePool, worldSpeed: number, score: number): void {
    const hard = score >= HARD_MODE.START_SCORE;
    const burst = this.takeBurstSlot(score, hard);

    // ── Flyer check ──────────────────────────────────────────────────────────
    const flyerChance = hard ? HARD_MODE.FLYER_CHANCE : FLYERS.FLYER_CHANCE;
    if (score >= FLYERS.MIN_SCORE && this.rng.chance(flyerChance)) {
      this.spawnFlyer(pool);
      const gap = this.calculateGap(worldSpeed, hard, burst);
      this.nextSpawnX += OBSTACLE_TYPES.TIME_BIRD.width + gap;
      return;
    }

    // ── Ground obstacle ───────────────────────────────────────────────────────
    const eligibleTypes = TYPE_NAMES.filter(t => score >= OBSTACLE_TYPES[t].minScore);
    let type = this.rng.pick(eligibleTypes);

    // Prevent same type 3 times consecutively
    if (this.lastTypes.length >= 2 &&
        this.lastTypes[this.lastTypes.length - 1] === type &&
        this.lastTypes[this.lastTypes.length - 2] === type) {
      const otherTypes = eligibleTypes.filter(t => t !== type);
      if (otherTypes.length > 0) {
        type = this.rng.pick(otherTypes);
      }
    }

    const variant = this.rng.int(0, MAX_VARIANTS - 1);
    pool.spawn(type, this.nextSpawnX, variant);

    // Track type history
    this.lastTypes.push(type);
    if (this.lastTypes.length > 3) this.lastTypes.shift();

    // Cluster logic: extra obstacles packed close enough that a single jump
    // spans the lot. How many fit is physics, not taste — the whole cluster
    // has to sit inside a fraction of the jump arc at the current speed.
    let isCluster = false;
    let obstacleEndX = this.nextSpawnX + OBSTACLE_TYPES[type].width;
    const clusterChance = hard ? HARD_MODE.CLUSTER_CHANCE : SPAWN.CLUSTER_CHANCE;
    if (score >= SPAWN.CLUSTER_MIN_SCORE &&
        !this.lastWasCluster &&
        this.consecutiveClusterCount < 2 &&
        this.rng.chance(clusterChance)) {
      const maxMembers = score >= SPAWN.CLUSTER_THIRD_MIN_SCORE ? SPAWN.CLUSTER_MAX_MEMBERS : 2;
      const maxSpan = getJumpArcLength(worldSpeed) * SPAWN.CLUSTER_MAX_ARC_SPAN;
      for (let member = 1; member < maxMembers; member++) {
        const clusterGap = this.rng.range(20, 34);
        const clusterType = this.rng.pick(eligibleTypes);
        const clusterX = obstacleEndX + clusterGap;
        const spanIfAdded = clusterX + OBSTACLE_TYPES[clusterType].width - this.nextSpawnX;
        if (spanIfAdded > maxSpan) break;
        pool.spawn(clusterType, clusterX, this.rng.int(0, MAX_VARIANTS - 1));
        obstacleEndX = clusterX + OBSTACLE_TYPES[clusterType].width;
        isCluster = true;
      }
    }
    if (isCluster) {
      this.consecutiveClusterCount++;
    } else {
      this.consecutiveClusterCount = 0;
    }
    this.lastWasCluster = isCluster;

    // Calculate next gap
    const gap = this.calculateGap(worldSpeed, hard, burst);
    this.nextSpawnX = obstacleEndX + gap;
  }

  private spawnFlyer(pool: ObstaclePool): void {
    // Pick altitude: LOW (ground-skimming) or HIGH (wing height); both are
    // below the grounded hitbox, so either way the bird must be jumped.
    const altitudeAboveGround = this.rng.chance(0.5) ? FLYERS.LOW_Y : FLYERS.HIGH_Y;
    // flyY = absolute top-Y of sprite in virtual coords
    const flyY = VIRTUAL.GROUND_Y - altitudeAboveGround - OBSTACLE_TYPES.TIME_BIRD.height;
    const variant = this.rng.int(0, MAX_VARIANTS - 1);
    pool.spawn('TIME_BIRD', this.nextSpawnX, variant, flyY);
  }

  /** True when this spawn belongs to a tightened stretch of track. */
  private takeBurstSlot(score: number, hard: boolean): boolean {
    if (this.burstRemaining > 0) {
      this.burstRemaining--;
      return true;
    }
    const chance = hard ? HARD_MODE.BURST_CHANCE : SPAWN.BURST_CHANCE;
    if (score >= SPAWN.BURST_MIN_SCORE && this.rng.chance(chance)) {
      this.burstRemaining = this.rng.int(SPAWN.BURST_MIN_LEN, SPAWN.BURST_MAX_LEN) - 1;
      return true;
    }
    return false;
  }

  private calculateGap(worldSpeed: number, hard = false, burst = false): number {
    // Base gap scaled by speed (tighter after the first night)
    const factor = hard ? HARD_MODE.GAP_SPEED_FACTOR : SPAWN.GAP_SPEED_FACTOR;
    let baseGap = SPAWN.MIN_GAP_PX + worldSpeed * factor * this.rng.range(0.8, 1.6);
    if (burst) baseGap *= SPAWN.BURST_GAP_SCALE;

    // Compute minimum clearable gap from physics
    const minClearableGap = this.getMinClearableGap(worldSpeed);

    // Clamp. The floor wins over MAX_GAP_PX: an unclearable gap is a bug,
    // an unusually wide one is just a breather.
    const gap = Math.max(minClearableGap, Math.min(baseGap, SPAWN.MAX_GAP_PX));
    return gap;
  }

  /** Compute the minimum gap that is physically clearable at the given speed.
   *  The quickest way over an obstacle is a tapped jump with no hold, so the
   *  next one cannot be closer than that arc — otherwise the wheel is still
   *  airborne when it arrives and no input could have saved it. */
  private getMinClearableGap(worldSpeed: number): number {
    const tapArc = getTapJumpArcLength(worldSpeed);
    const reactionBuffer = 0.12 * worldSpeed; // land, see the next one, jump
    return Math.max(tapArc + reactionBuffer + 16, SPAWN.MIN_GAP_PX);
  }
}

/** Horizontal distance covered by the shortest possible jump — a tap with no
 *  hold. This is the floor on obstacle spacing. */
export function getTapJumpArcLength(worldSpeed: number): number {
  const airTime = (2 * -PHYSICS.JUMP_VELOCITY) / PHYSICS.GRAVITY;
  return worldSpeed * airTime;
}

/** Calculate jump arc length for a given speed (useful for testing) */
export function getJumpArcLength(worldSpeed: number): number {
  const v0 = -PHYSICS.JUMP_VELOCITY;
  const holdTime = Math.min(PHYSICS.MAX_HOLD_TIME, v0 / (PHYSICS.GRAVITY * PHYSICS.HOLD_GRAVITY_SCALE));
  const vAfterHold = v0 - PHYSICS.GRAVITY * PHYSICS.HOLD_GRAVITY_SCALE * holdTime;
  const timeAfterHold = vAfterHold / PHYSICS.GRAVITY;
  const totalRiseTime = holdTime + timeAfterHold;
  const totalAirTime = totalRiseTime * 2;
  return worldSpeed * totalAirTime;
}
