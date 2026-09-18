import { describe, it, expect } from 'vitest';
import { RunToken } from '../src/net/runToken';

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
