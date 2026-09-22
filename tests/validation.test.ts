import { describe, it, expect } from 'vitest';
import { RunToken } from '../src/net/runToken';
import { returnScreenFor } from '../src/ui/screens';

describe('Run Validation & Telemetry', () => {
  it('generates a signed run token payload', () => {
    const token = new RunToken();
    token.start();
    token.recordJump();
    token.recordJump();

    const payload = token.finalize(450);
    expect(payload.score).toBe(450);
    expect(payload.jumpCount).toBe(2);
    expect(payload.durationMs).toBeGreaterThanOrEqual(0);
    expect(payload.signature).toBeDefined();
    expect(payload.signature.length).toBeGreaterThan(0);
  });
});

describe('Leaderboard return screen', () => {
  it('returns a finished run to the game-over card, not the ready screen', () => {
    // Opening the leaderboard from game over and pressing BACK used to show
    // READY while the run sat in GAME_OVER, so neither screen took input.
    expect(returnScreenFor('GAME_OVER')).toBe('GAME_OVER');
    expect(returnScreenFor('SUBMIT')).toBe('GAME_OVER');
  });

  it('returns to the ready screen when opened before a run', () => {
    expect(returnScreenFor('READY')).toBe('READY');
  });
});
