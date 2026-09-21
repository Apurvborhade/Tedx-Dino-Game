import { describe, it, expect } from 'vitest';
import { Difficulty } from '../src/systems/Difficulty';
import { SPEED, HARD_MODE } from '../src/config';
import { getJumpArcLength } from '../src/entities/ObstacleSpawner';

describe('Difficulty & Spawn Curves', () => {
  it('starts at initial speed and increases monotonically', () => {
    const diff = new Difficulty();
    expect(diff.speed).toBe(SPEED.INITIAL);

    diff.update(1.0);
    const speed1s = diff.speed;
    expect(speed1s).toBeGreaterThan(SPEED.INITIAL);

    diff.update(10.0);
    const speed11s = diff.speed;
    expect(speed11s).toBeGreaterThan(speed1s);
    expect(speed11s).toBeLessThanOrEqual(SPEED.MAX);
  });

  it('guarantees jump arc is always greater than widest obstacle', () => {
    for (let s = SPEED.INITIAL; s <= SPEED.MAX; s += 20) {
      const arc = getJumpArcLength(s);
      expect(arc).toBeGreaterThan(40); // widest obstacle is 30px
    }
  });

  it('computes realistic max score bounds for anti-cheat verification', () => {
    const maxScore30s = Difficulty.maxScoreForDuration(30000);
    expect(maxScore30s).toBeGreaterThan(200);
    expect(maxScore30s).toBeLessThan(1500);
  });

  it('adds the hard-mode speed bonus after the first night, ramped in', () => {
    const easy = new Difficulty();
    const hard = new Difficulty();
    for (let i = 0; i < 60 * 120; i++) {
      easy.update(1 / 120, 0);
      hard.update(1 / 120, HARD_MODE.START_SCORE);
    }
    expect(hard.hard).toBe(true);
    expect(easy.hard).toBe(false);
    expect(hard.speed - easy.speed).toBeCloseTo(HARD_MODE.SPEED_BONUS, 1);

    // Ramp: right after crossing the threshold the bonus is still small
    const fresh = new Difficulty();
    fresh.update(1 / 120, HARD_MODE.START_SCORE);
    expect(fresh.speed - Difficulty.speedAtTime(1 / 120)).toBeLessThan(HARD_MODE.SPEED_BONUS * 0.1);
  });
});
