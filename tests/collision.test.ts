import { describe, it, expect } from 'vitest';
import { aabbOverlap, ObstaclePool, type ObstacleData } from '../src/entities/Obstacle';
import { VIRTUAL } from '../src/config';

describe('AABB Collision', () => {
  it('detects direct overlap', () => {
    const boxA = { x: 50, y: 100, w: 20, h: 20 };
    const boxB = { x: 60, y: 110, w: 20, h: 20 };
    expect(aabbOverlap(boxA, boxB)).toBe(true);
  });

  it('detects disjoint boxes with no false positive', () => {
    const boxA = { x: 50, y: 100, w: 20, h: 20 };
    const boxB = { x: 100, y: 100, w: 20, h: 20 };
    expect(aabbOverlap(boxA, boxB)).toBe(false);
  });

  it('detects adjacent edge touch as no collision', () => {
    const boxA = { x: 50, y: 100, w: 20, h: 20 };
    const boxB = { x: 70, y: 100, w: 20, h: 20 }; // touches right at x=70
    expect(aabbOverlap(boxA, boxB)).toBe(false);
  });

  it('correctly calculates obstacle hitbox from ground baseline', () => {
    const ob: ObstacleData = {
      type: 'STONE_TALL',
      x: 200,
      width: 18,
      height: 34,
      variant: 0,
      active: true,
      flyY: 0,
    };
    const hitbox = ObstaclePool.getHitbox(ob, VIRTUAL.GROUND_Y);
    // Ground-anchored: topY = GROUND_Y - height; then 2px inset applied
    expect(hitbox.x).toBe(202);        // x + 2
    expect(hitbox.y).toBe(VIRTUAL.GROUND_Y - 34 + 2); // topY + 2
    expect(hitbox.w).toBe(14);         // width - 4
    expect(hitbox.h).toBe(32);         // height - 2
  });
});
