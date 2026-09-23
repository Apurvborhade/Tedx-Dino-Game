// ════════════════════════════════════════════════════════════════════════════
// Leaderboard.ts — Leaderboard screen UI with polling & highlight
// ════════════════════════════════════════════════════════════════════════════

import { LEADERBOARD_CONFIG } from '../config';
import type { ApiClient, LeaderboardEntry } from '../net/api';

export class LeaderboardView {
  private container: HTMLElement;
  private tableBody: HTMLElement;
  private statusEl: HTMLElement;
  private closeBtn: HTMLButtonElement;
  private refreshBtn: HTMLButtonElement;
  private api: ApiClient;

  private pollTimer: number = 0;
  private onClose?: () => void;
  private highlightRank?: number;

  constructor(
    container: HTMLElement,
    api: ApiClient,
    callbacks: { onClose: () => void }
  ) {
    this.container = container;
    this.api = api;
    this.onClose = callbacks.onClose;

    this.container.innerHTML = `
      <div class="modal-card leaderboard-card">
        <div class="header-row">
          <h2 class="title-text">HALL OF FAME</h2>
          <button type="button" class="icon-btn" id="lb-refresh-btn" title="Refresh">↻</button>
        </div>
        <p class="subtitle-text">TEDxDYPDPU • TOP RUNNERS</p>
        <p class="giveaway-note">GIVEAWAY: YOU MUST FOLLOW <b>@TEDXDYPDPU</b> ON INSTAGRAM<br />ENTRIES FROM ACCOUNTS THAT DO NOT FOLLOW ARE NOT ELIGIBLE</p>
        <div class="leaderboard-table-wrapper" data-no-jump>
          <table class="leaderboard-table">
            <thead>
              <tr>
                <th class="col-rank">#</th>
                <th class="col-name">INSTAGRAM</th>
                <th class="col-score">SCORE</th>
              </tr>
            </thead>
            <tbody id="leaderboard-body">
              <tr><td colspan="3" class="loading-cell">LOADING...</td></tr>
            </tbody>
          </table>
        </div>
        <div class="form-status" id="lb-status"></div>
        <div class="button-row">
          <button type="button" class="btn btn-primary" id="lb-close-btn">BACK</button>
        </div>
      </div>
    `;

    this.tableBody = this.container.querySelector('#leaderboard-body')!;
    this.statusEl = this.container.querySelector('#lb-status')!;
    this.closeBtn = this.container.querySelector('#lb-close-btn')!;
    this.refreshBtn = this.container.querySelector('#lb-refresh-btn')!;

    this.setupListeners();
  }

  private setupListeners(): void {
    this.closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
      if (this.onClose) this.onClose();
    });

    this.refreshBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.fetchAndRender();
    });
  }

  open(highlightRank?: number): void {
    this.highlightRank = highlightRank;
    this.statusEl.textContent = '';
    this.fetchAndRender();

    // Start polling
    clearInterval(this.pollTimer);
    this.pollTimer = window.setInterval(() => {
      this.fetchAndRender(true);
    }, LEADERBOARD_CONFIG.REFRESH_MS);
  }

  close(): void {
    clearInterval(this.pollTimer);
  }

  private async fetchAndRender(silent = false): Promise<void> {
    if (!silent) {
      this.statusEl.textContent = 'FETCHING...';
    }

    try {
      const entries = await this.api.fetchLeaderboard();
      this.renderTable(entries);
      this.statusEl.textContent = '';
    } catch {
      this.statusEl.textContent = 'COULD NOT LOAD SCORES';
    }
  }

  private renderTable(entries: LeaderboardEntry[]): void {
    if (entries.length === 0) {
      this.tableBody.innerHTML = `<tr><td colspan="3" class="loading-cell">NO RUNS YET. BE THE FIRST!</td></tr>`;
      return;
    }

    let html = '';
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!;
      const rank = entry.rank ?? (i + 1);
      const isSelf = this.highlightRank === rank;
      const rankClass = rank === 1 ? 'rank-gold' : rank === 2 ? 'rank-silver' : rank === 3 ? 'rank-bronze' : '';
      const selfClass = isSelf ? 'highlight-row' : '';

      html += `
        <tr class="${rankClass} ${selfClass}">
          <td class="col-rank">${rank}</td>
          <td class="col-name">${this.escapeHtml(entry.name)}</td>
          <td class="col-score">${String(entry.score).padStart(6, '0')}</td>
        </tr>
      `;
    }

    this.tableBody.innerHTML = html;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
