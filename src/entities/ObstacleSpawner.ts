// ════════════════════════════════════════════════════════════════════════════
// ObstacleSpawner.ts — Spawn timing, type selection, spacing guarantees
// ════════════════════════════════════════════════════════════════════════════

import { SPAWN, OBSTACLE_TYPES, VIRTUAL, PHYSICS, FLYERS, HARD_MODE, type ObstacleTypeName } from '../config';
import { Rng } from '../core/Rng';
import { ObstaclePool } from './Obstacle';

const TYPE_NAMES: readonly ObstacleTypeName[] = ['STONE_SMALL', 'STONE_TALL', 'PILLAR_BROKEN', 'THORN_CLUSTER', 'HANGING_GATE', 'OBELISK'] as const;

/** Maximum number of variants per obstacle type */
const MAX_VARIANTS = 3;

export class ObstacleSpawner {
  private rng: Rng;
  private nextSpawnX: number;
  private lastTypes: ObstacleTypeName[] = [];
  private lastWasCluster = false;
  private consecutiveClusterCount = 0;

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

    // ── Flyer check ──────────────────────────────────────────────────────────
    const flyerChance = hard ? HARD_MODE.FLYER_CHANCE : FLYERS.FLYER_CHANCE;
    if (score >= FLYERS.MIN_SCORE && this.rng.chance(flyerChance)) {
      this.spawnFlyer(pool);
      const gap = this.calculateGap(worldSpeed, 'TIME_BIRD', false, hard);
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

    // Cluster logic. A hanging gate never clusters: ducking under it and
    // then jumping a stone 30px later isn't humanly possible.
    let isCluster = false;
    const clusterChance = hard ? HARD_MODE.CLUSTER_CHANCE : SPAWN.CLUSTER_CHANCE;
    const clusterable = eligibleTypes.filter(t => !OBSTACLE_TYPES[t].isHanging);
    if (score >= SPAWN.CLUSTER_MIN_SCORE &&
        !OBSTACLE_TYPES[type].isHanging &&
        clusterable.length > 0 &&
        !this.lastWasCluster &&
        this.consecutiveClusterCount < 2 &&
        this.rng.chance(clusterChance)) {
      // Spawn second obstacle close by
      const clusterGap = this.rng.range(20, 34);
      const clusterType = this.rng.pick(clusterable);
      const clusterVariant = this.rng.int(0, MAX_VARIANTS - 1);
      pool.spawn(clusterType, this.nextSpawnX + OBSTACLE_TYPES[type].width + clusterGap, clusterVariant);
      isCluster = true;
      this.consecutiveClusterCount++;
    } else {
      this.consecutiveClusterCount = 0;
    }
    this.lastWasCluster = isCluster;

    // Calculate next gap
    const gap = this.calculateGap(worldSpeed, type, isCluster, hard);
    const obstacleEndX = isCluster
      ? this.nextSpawnX + OBSTACLE_TYPES[type].width + 34 + OBSTACLE_TYPES[type].width
      : this.nextSpawnX + OBSTACLE_TYPES[type].width;
    this.nextSpawnX = obstacleEndX + gap;
  }

  private spawnFlyer(pool: ObstaclePool): void {
    // Pick altitude: LOW (18px), MID (34px trap), HIGH (52px)
    const roll = this.rng.range(0, 1);
    let altitudeAboveGround: number;
    if (roll < 0.33) {
      altitudeAboveGround = FLYERS.LOW_Y;
    } else if (roll < 0.66) {
      altitudeAboveGround = FLYERS.MID_Y;
    } else {
      altitudeAboveGround = FLYERS.HIGH_Y;
    }
    // flyY = absolute top-Y of sprite in virtual coords
    const flyY = VIRTUAL.GROUND_Y - altitudeAboveGround - OBSTACLE_TYPES.TIME_BIRD.height;
    const variant = this.rng.int(0, MAX_VARIANTS - 1);
    pool.spawn('TIME_BIRD', this.nextSpawnX, variant, flyY);
  }

  private calculateGap(worldSpeed: number, _type: ObstacleTypeName, _isCluster: boolean, hard = false): number {
    // Base gap scaled by speed (tighter after the first night)
    const factor = hard ? HARD_MODE.GAP_SPEED_FACTOR : SPAWN.GAP_SPEED_FACTOR;
    const baseGap = SPAWN.MIN_GAP_PX + worldSpeed * factor * this.rng.range(0.8, 1.6);

    // Compute minimum clearable gap from physics
    const minClearableGap = this.getMinClearableGap(worldSpeed);

    // Clamp
    const gap = Math.max(minClearableGap, Math.min(baseGap, SPAWN.MAX_GAP_PX));
    return gap;
  }

  /** Compute the minimum gap that is physically clearable at the given speed */
  private getMinClearableGap(worldSpeed: number): number {
    // The player needs to land, react, and re-jump
    // Minimum gap = reaction buffer (~0.15s) * speed + margin
    const reactionBuffer = 0.15;
    const minGap = reactionBuffer * worldSpeed + 24; // 24px margin

    // Never less than MIN_GAP_PX
    return Math.max(minGap, SPAWN.MIN_GAP_PX);
  }
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
