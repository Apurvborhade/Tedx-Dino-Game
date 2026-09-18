import { describe, it, expect } from 'vitest';
import { PHYSICS, VIRTUAL, PLAYER_CONFIG } from '../src/config';
import { Player } from '../src/entities/Player';

describe('Player Physics', () => {
  it('initializes at ground height and onGround = true', () => {
    const player = new Player();
    expect(player.y).toBe(VIRTUAL.GROUND_Y);
    expect(player.onGround).toBe(true);
    expect(player.velocityY).toBe(0);
  });

  it('jumps with correct initial velocity', () => {
    const player = new Player();
    const jumped = player.tryJump(true);
    expect(jumped).toBe(true);
    expect(player.velocityY).toBe(PHYSICS.JUMP_VELOCITY);
    expect(player.onGround).toBe(false);
  });

  it('respects coyote time window', () => {
    const player = new Player();
    // Move player off ground without jumping
    player.onGround = false;
    player.update(0.02, false, 200); // 0.02s < coyote time (0.06s)
    const jumped = player.tryJump(false);
    expect(jumped).toBe(true);
  });

  it('reaches apex and returns to ground cleanly', () => {
    const player = new Player();
    player.tryJump(false); // short tap jump

    const dt = 1 / 120;
    let maxApexHeight = 0;
    let frames = 0;

    while (frames < 240) {
      player.update(dt, false, 260);
      const heightAboveGround = VIRTUAL.GROUND_Y - player.y;
      if (heightAboveGround > maxApexHeight) {
        maxApexHeight = heightAboveGround;
      }
      if (player.onGround && frames > 10) {
        break;
      }
      frames++;
    }

    expect(maxApexHeight).toBeGreaterThan(40);
    expect(player.onGround).toBe(true);
    expect(player.y).toBe(VIRTUAL.GROUND_Y);
  });

  it('calculates hitbox with inset', () => {
    const player = new Player();
    const box = player.getHitbox();
    expect(box.w).toBe(PLAYER_CONFIG.SPRITE_SIZE - PLAYER_CONFIG.HITBOX_INSET * 2);
    expect(box.h).toBe(PLAYER_CONFIG.SPRITE_SIZE - PLAYER_CONFIG.HITBOX_INSET * 2);
  });
});
