// ════════════════════════════════════════════════════════════════════════════
// Obstacle.ts — Single obstacle instance with pooling
// ════════════════════════════════════════════════════════════════════════════

import { type ObstacleTypeName, OBSTACLE_TYPES, VIRTUAL } from '../config';

export interface ObstacleData {
  type: ObstacleTypeName;
  x: number;
  width: number;
  height: number;
  variant: number;
  active: boolean;
  /** Absolute Y of the obstacle's top edge. 0 means ground-anchored (computed from GROUND_Y - height). */
  flyY: number;
}

/** Object pool for obstacles — no per-frame allocation */
export class ObstaclePool {
  private pool: ObstacleData[] = [];
  active: ObstacleData[] = [];

  constructor(size = 8) {
    for (let i = 0; i < size; i++) {
      this.pool.push({
        type: 'STONE_SMALL',
        x: 0,
        width: 0,
        height: 0,
        variant: 0,
        active: false,
        flyY: 0,
      });
    }
  }

  spawn(type: ObstacleTypeName, x: number, variant: number, flyY = 0): ObstacleData | null {
    let ob = this.pool.pop();
    if (!ob) {
      ob = { type: 'STONE_SMALL', x: 0, width: 0, height: 0, variant: 0, active: false, flyY: 0 };
    }
    const def = OBSTACLE_TYPES[type];
    ob.type = type;
    ob.x = x;
    ob.width = def.width;
    ob.height = def.height;
    ob.variant = variant;
    ob.active = true;
    ob.flyY = flyY;
    this.active.push(ob);
    return ob;
  }

  update(dt: number, worldSpeed: number): void {
    const shift = worldSpeed * dt;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const ob = this.active[i]!;
      ob.x -= shift;
      if (ob.x + ob.width < -20) {
        this.despawn(ob);
      }
    }
  }

  despawn(ob: ObstacleData): void {
    ob.active = false;
    const idx = this.active.indexOf(ob);
    if (idx >= 0) {
      this.active.splice(idx, 1);
    }
    this.pool.push(ob);
  }

  reset(): void {
    for (const ob of this.active) {
      ob.active = false;
      this.pool.push(ob);
    }
    this.active.length = 0;
  }

  getActive(): ObstacleData[] {
    return this.active;
  }

  /** Absolute top edge: hanging types drop from y=0, flyers carry their own
   *  top, everything else stands on the ground. */
  static getTopY(ob: ObstacleData, groundY: number = VIRTUAL.GROUND_Y): number {
    if (OBSTACLE_TYPES[ob.type].isHanging) return 0;
    return ob.flyY > 0 ? ob.flyY : groundY - ob.height;
  }

  /** Get AABB for collision */
  static getHitbox(ob: ObstacleData, groundY: number = VIRTUAL.GROUND_Y): { x: number; y: number; w: number; h: number } {
    const topY = ObstaclePool.getTopY(ob, groundY);
    return {
      x: ob.x + 2,           // 2px inset on each side for forgiveness
      y: topY + 2,
      w: ob.width - 4,
      h: ob.height - 2,
    };
  }
}

/** AABB overlap test */
export function aabbOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}
