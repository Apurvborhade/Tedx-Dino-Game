import { describe, it, expect } from 'vitest';
import { Difficulty } from '../src/systems/Difficulty';
import { SPEED, HARD_MODE, SPAWN } from '../src/config';
import { ObstacleSpawner, getJumpArcLength, getTapJumpArcLength } from '../src/entities/ObstacleSpawner';
import { ObstaclePool } from '../src/entities/Obstacle';

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

describe('Late-game surge', () => {
  it('keeps accelerating past the asymptote once the surge score is passed', () => {
    const d = new Difficulty();
    for (let i = 0; i < 120 * 120; i++) d.update(1 / 120, SPEED.SURGE_START_SCORE);
    expect(d.surge).toBe(true);
    // The base curve alone can never exceed SPEED.MAX; the surge must.
    expect(d.speed).toBeGreaterThan(SPEED.MAX + HARD_MODE.SPEED_BONUS);
    expect(d.speed).toBeLessThanOrEqual(SPEED.SURGE_MAX);
  });

  it('never exceeds the cap the anti-cheat bound is derived from', () => {
    const d = new Difficulty();
    for (let i = 0; i < 600 * 120; i++) d.update(1 / 120, 99999);
    expect(d.speed).toBeCloseTo(SPEED.SURGE_MAX, 5);
  });

  it('does not surge on a run that never reaches the threshold', () => {
    const d = new Difficulty();
    for (let i = 0; i < 120 * 120; i++) d.update(1 / 120, SPEED.SURGE_START_SCORE - 1);
    expect(d.surge).toBe(false);
    expect(d.speed).toBeLessThanOrEqual(SPEED.MAX + HARD_MODE.SPEED_BONUS);
  });
});

describe('Spawn spacing stays clearable', () => {
  it('never places two obstacles closer than the shortest jump can cross', () => {
    // Walk a whole run at every speed the game can reach, including bursts.
    for (let speed = SPEED.INITIAL; speed <= SPEED.SURGE_MAX; speed += 20) {
      const pool = new ObstaclePool(32);
      const spawner = new ObstacleSpawner(12345);
      const score = 2000; // past every gate: hard mode, bursts, 3-clusters
      for (let i = 0; i < 400; i++) spawner.update(pool, speed, score, 1 / 120);

      const arc = getJumpArcLength(speed);
      const tapArc = getTapJumpArcLength(speed);
      const obs = [...pool.getActive()].sort((a, b) => a.x - b.x);
      for (let i = 1; i < obs.length; i++) {
        const gap = obs[i]!.x - (obs[i - 1]!.x + obs[i - 1]!.width);
        // Either inside one jump (a cluster) or far enough to land and re-jump.
        const clearable = gap <= arc * SPAWN.CLUSTER_MAX_ARC_SPAN || gap >= tapArc;
        expect(clearable, `speed ${speed}: gap ${gap.toFixed(0)}px, tap arc ${tapArc.toFixed(0)}px`).toBe(true);
      }
    }
  });
});
