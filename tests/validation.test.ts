import { describe, it, expect } from 'vitest';
import { RunToken } from '../src/net/runToken';
import { returnScreenFor } from '../src/ui/screens';
import { HANDLE_MAX_LEN, sanitizeHandle, validateHandle } from '../src/net/handle';

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

describe('Instagram handle validation', () => {
  it('strips the @ and anything Instagram would not accept', () => {
    expect(sanitizeHandle('@TEDxDYPDPU')).toBe('tedxdypdpu');
    expect(sanitizeHandle('  Apurva Borhade ')).toBe('apurvaborhade');
    expect(sanitizeHandle('a@b#c!d')).toBe('abcd');
    expect(sanitizeHandle('keeps.dots_and_underscores')).toBe('keeps.dots_and_underscores');
  });

  it('caps at the 30 characters Instagram allows', () => {
    expect(sanitizeHandle('a'.repeat(50))).toHaveLength(30);
  });

  it('accepts a normal handle', () => {
    expect(validateHandle('tedxdypdpu')).toBeNull();
    expect(validateHandle('a_b.c123')).toBeNull();
  });

  it("rejects what Instagram itself would reject", () => {
    expect(validateHandle('a')).toMatch(/SHORT/);
    expect(validateHandle('.leading')).toMatch(/DOT/);
    expect(validateHandle('trailing.')).toMatch(/DOT/);
    expect(validateHandle('two..dots')).toMatch(/TWO DOTS/);
  });

  it('agrees with the length the database now allows', () => {
    // supabase/migrations/004 widened the check to 2-30; a handle that passes
    // here must not be rejected by the insert.
    expect(HANDLE_MAX_LEN).toBe(30);
    expect(validateHandle('b'.repeat(HANDLE_MAX_LEN))).toBeNull();
  });
});
