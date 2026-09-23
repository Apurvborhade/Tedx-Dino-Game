// ════════════════════════════════════════════════════════════════════════════
// api.ts — Supabase leaderboard API client + offline fallback queue
// ════════════════════════════════════════════════════════════════════════════

import type { RunTokenPayload } from './runToken';
import { safeGetItem, safeSetItem } from '../systems/storage';

export interface LeaderboardEntry {
  name: string;
  score: number;
  rank?: number;
  isSelf?: boolean;
}

export interface SubmitScoreResponse {
  success: boolean;
  rank: number;
  isTop10: boolean;
  error?: string;
}

const OFFLINE_QUEUE_KEY = 'kalachakra.offline_queue';
const TIMEOUT_MS = 6000;

interface QueuedSubmission {
  name: string;
  score: number;
  token: RunTokenPayload;
  timestamp: number;
}

export class ApiClient {
  private endpoint: string;
  private isEnabled: boolean;

  constructor() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    this.endpoint = supabaseUrl ? `${supabaseUrl}/functions/v1/submit-score` : '';
    this.isEnabled = import.meta.env.VITE_LEADERBOARD_ENABLED === 'true' && !!this.endpoint;
  }

  async submitScore(name: string, score: number, token: RunTokenPayload): Promise<SubmitScoreResponse> {
    if (!this.isEnabled) {
      // Mock / Offline response
      return this.mockSubmit(name, score);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({ name, score, token }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 4xx = the server rejected this run (bad name, implausible score…).
      // That's final — surface it, don't queue it or fake a rank.
      if (res.status >= 400 && res.status < 500) {
        let message = 'SUBMISSION REJECTED';
        try {
          const body = await res.json();
          if (typeof body?.error === 'string') message = body.error.toUpperCase();
        } catch {
          // keep generic message
        }
        return { success: false, rank: 0, isTop10: false, error: message };
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      return {
        success: true,
        rank: data.rank ?? 1,
        isTop10: (data.rank ?? 1) <= 10,
      };
    } catch (err: unknown) {
      // Network error / timeout / 5xx: keep the run and retry on next boot.
      clearTimeout(timeoutId);
      console.warn('[API] Submission failed, queuing offline:', err);
      this.enqueueOffline({ name, score, token, timestamp: Date.now() });
      return { success: false, rank: 0, isTop10: false, error: 'NETWORK ERROR (QUEUED)' };
    }
  }

  async fetchLeaderboard(): Promise<LeaderboardEntry[]> {
    if (!this.isEnabled) {
      return this.mockLeaderboard();
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
      const res = await fetch(
        `${supabaseUrl}/rest/v1/leaderboard?select=name,score&order=score.desc&limit=10`,
        {
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data: Array<{ name: string; score: number }> = await res.json();
      return data.map((entry, idx) => ({
        name: entry.name,
        score: entry.score,
        rank: idx + 1,
      }));
    } catch (err) {
      // Live mode: never show the seeded demo names as if they were real.
      clearTimeout(timeoutId);
      console.warn('[API] Fetch leaderboard failed:', err);
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  private mockSubmit(name: string, score: number): SubmitScoreResponse {
    const localScores = this.getLocalMockScores();
    localScores.push({ name, score });
    localScores.sort((a, b) => b.score - a.score);
    const trimmed = localScores.slice(0, 10);
    safeSetItem('kalachakra.mock_lb', JSON.stringify(trimmed));

    const rank = localScores.findIndex((e) => e.name === name && e.score === score) + 1;
    return {
      success: true,
      rank: rank > 0 ? rank : 1,
      isTop10: rank <= 10,
    };
  }

  private mockLeaderboard(): LeaderboardEntry[] {
    const raw = safeGetItem('kalachakra.mock_lb');
    if (raw) {
      try {
        const parsed: Array<{ name: string; score: number }> = JSON.parse(raw);
        return parsed.map((e, idx) => ({ ...e, rank: idx + 1 }));
      } catch {
        // ignore
      }
    }

    // Default seeded leaderboard for TEDxDYPDPU demo
    return [
      { name: 'CHRONOS', score: 1840, rank: 1 },
      { name: 'ARYABHATTA', score: 1420, rank: 2 },
      { name: 'KAALCHAKRA', score: 1190, rank: 3 },
      { name: 'TEDXDYP', score: 980, rank: 4 },
      { name: 'VORTEX', score: 750, rank: 5 },
      { name: 'WHEEL_X', score: 540, rank: 6 },
      { name: 'TIMEKEEPER', score: 430, rank: 7 },
      { name: 'ECHO', score: 310, rank: 8 },
      { name: 'NOVA', score: 220, rank: 9 },
      { name: 'RUNNER', score: 150, rank: 10 },
    ];
  }

  private getLocalMockScores(): Array<{ name: string; score: number }> {
    const raw = safeGetItem('kalachakra.mock_lb');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        // ignore
      }
    }
    return this.mockLeaderboard();
  }

  private enqueueOffline(item: QueuedSubmission): void {
    const raw = safeGetItem(OFFLINE_QUEUE_KEY);
    const queue: QueuedSubmission[] = raw ? JSON.parse(raw) : [];
    queue.push(item);
    // Keep max 5 queued runs
    if (queue.length > 5) queue.shift();
    safeSetItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  }

  async drainOfflineQueue(): Promise<void> {
    if (!this.isEnabled) return;
    const raw = safeGetItem(OFFLINE_QUEUE_KEY);
    if (!raw) return;

    try {
      const queue: QueuedSubmission[] = JSON.parse(raw);
      if (queue.length === 0) return;

      safeSetItem(OFFLINE_QUEUE_KEY, '[]');
      for (const item of queue) {
        await this.submitScore(item.name, item.score, item.token);
      }
    } catch (err) {
      console.warn('[API] Failed to flush offline queue:', err);
    }
  }
}
