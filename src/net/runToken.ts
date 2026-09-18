// ════════════════════════════════════════════════════════════════════════════
// runToken.ts — Client-side run telemetry and validation token
// ════════════════════════════════════════════════════════════════════════════

export interface RunTokenPayload {
  runId: string;
  startTime: number;
  durationMs: number;
  jumpCount: number;
  score: number;
  signature: string;
}

export class RunToken {
  private runId: string = '';
  private startTime: number = 0;
  private jumpCount = 0;
  private active = false;

  start(): void {
    this.runId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    this.startTime = Date.now();
    this.jumpCount = 0;
    this.active = true;
  }

  recordJump(): void {
    if (this.active) {
      this.jumpCount++;
    }
  }

  finalize(finalScore: number): RunTokenPayload {
    this.active = false;
    const durationMs = Math.max(1, Date.now() - this.startTime);
    
    // Simple verification signature: simple hash for anti-tampering
    const raw = `${this.runId}:${this.startTime}:${durationMs}:${this.jumpCount}:${finalScore}:kalachakra_secret`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }

    return {
      runId: this.runId,
      startTime: this.startTime,
      durationMs,
      jumpCount: this.jumpCount,
      score: finalScore,
      signature: Math.abs(hash).toString(16),
    };
  }
}
