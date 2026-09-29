import { describe, it, expect } from 'vitest';
import { Difficulty } from '../src/systems/Difficulty';
import { SPEED, HARD_MODE, SPAWN, ENDGAME_MODE } from '../src/config';
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

  it('never exceeds the surge cap before score 1500', () => {
    const d = new Difficulty();
    for (let i = 0; i < 600 * 120; i++) d.update(1 / 120, 1499);
    expect(d.speed).toBeCloseTo(SPEED.SURGE_MAX, 5);
  });

  it('does not surge on a run that never reaches the threshold', () => {
    const d = new Difficulty();
    for (let i = 0; i < 120 * 120; i++) d.update(1 / 120, SPEED.SURGE_START_SCORE - 1);
    expect(d.surge).toBe(false);
    expect(d.speed).toBeLessThanOrEqual(SPEED.MAX + HARD_MODE.SPEED_BONUS);
  });
});

describe('Endgame tier (score >= 1500)', () => {
  it('keeps accelerating gradually past SURGE_MAX after score 1500 up to ENDGAME_MODE.SPEED_MAX', () => {
    const d = new Difficulty();
    // Reach score 1499 (surge cap)
    for (let i = 0; i < 120 * 120; i++) d.update(1 / 120, 1499);
    expect(d.speed).toBeCloseTo(SPEED.SURGE_MAX, 1);
    expect(d.endgame).toBe(false);

    // Cross into score 1500: acceleration begins seamlessly without sudden jump
    d.update(1.0, 1500);
    expect(d.endgame).toBe(true);
    expect(d.speed).toBeGreaterThan(SPEED.SURGE_MAX);

    // Run for extended time in endgame: caps at ENDGAME_MODE.SPEED_MAX (980)
    for (let i = 0; i < 600 * 120; i++) d.update(1 / 120, 2000);
    expect(d.speed).toBeCloseTo(ENDGAME_MODE.SPEED_MAX, 5);
  });
});

describe('Spawn spacing stays clearable', () => {
  it('never places two obstacles closer than the shortest jump can cross', () => {
    // Walk a whole run at every speed the game can reach, including bursts.
    for (let speed = SPEED.INITIAL; speed <= SPEED.SURGE_MAX; speed += 20) {
      const pool = new ObstaclePool(32);
      const spawner = new ObstacleSpawner(12345);
      const score = 1400; // before endgame
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

  it('never places two obstacles closer than the shortest jump can cross in endgame with randomized gaps', () => {
    for (let speed = SPEED.SURGE_MAX; speed <= ENDGAME_MODE.SPEED_MAX; speed += 20) {
      const pool = new ObstaclePool(32);
      const spawner = new ObstacleSpawner(54321);
      const score = 2000; // in endgame (>= 1500)
      for (let i = 0; i < 400; i++) spawner.update(pool, speed, score, 1 / 120);

      const arc = getJumpArcLength(speed, ENDGAME_MODE.JUMP_IMPULSE_SCALE, ENDGAME_MODE.MAX_HOLD_SCALE);
      const tapArc = getTapJumpArcLength(speed, ENDGAME_MODE.JUMP_IMPULSE_SCALE);
      const obs = [...pool.getActive()].sort((a, b) => a.x - b.x);
      for (let i = 1; i < obs.length; i++) {
        const gap = obs[i]!.x - (obs[i - 1]!.x + obs[i - 1]!.width);
        const clearable = gap <= arc * SPAWN.CLUSTER_MAX_ARC_SPAN || gap >= tapArc;
        expect(clearable, `speed ${speed}: gap ${gap.toFixed(0)}px, tap arc ${tapArc.toFixed(0)}px`).toBe(true);
      }
    }
  });

  it('exhibits randomized spacing variance (tight reflex gaps and wide breathers) in endgame', () => {
    const pool = new ObstaclePool(64);
    const spawner = new ObstacleSpawner(99999);
    const speed = 900;
    const score = 2000;

    const recordedGaps: number[] = [];
    const tracker = { lastTrailingEdge: null as number | null };
    const origSpawn = pool.spawn.bind(pool);
    pool.spawn = (type, x, variant, y) => {
      const ob = origSpawn(type, x, variant, y);
      if (tracker.lastTrailingEdge !== null) {
        const gap = x - tracker.lastTrailingEdge;
        recordedGaps.push(gap);
      }
      if (ob) {
        tracker.lastTrailingEdge = x + ob.width;
      }
      return ob;
    };

    // Run for several simulated seconds to collect multiple spawns
    for (let i = 0; i < 3000; i++) {
      if (tracker.lastTrailingEdge !== null) {
        tracker.lastTrailingEdge -= speed * (1 / 120);
      }
      spawner.update(pool, speed, score, 1 / 120);
    }

    const arc = getJumpArcLength(speed, ENDGAME_MODE.JUMP_IMPULSE_SCALE, ENDGAME_MODE.MAX_HOLD_SCALE);
    const nonClusterGaps = recordedGaps.filter(g => g > arc * SPAWN.CLUSTER_MAX_ARC_SPAN);

    expect(nonClusterGaps.length).toBeGreaterThan(10);

    // Must have a noticeable spread of gaps
    const minObserved = Math.min(...nonClusterGaps);
    const maxObserved = Math.max(...nonClusterGaps);
    expect(maxObserved - minObserved).toBeGreaterThan(200);

    // Both tighter gaps (<600px) and wider gaps (>700px) should occur
    const hasTighter = nonClusterGaps.some(g => g < 600);
    const hasWider = nonClusterGaps.some(g => g > 700);
    expect(hasTighter).toBe(true);
    expect(hasWider).toBe(true);
  });
});
