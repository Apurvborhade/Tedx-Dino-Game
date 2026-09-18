// ════════════════════════════════════════════════════════════════════════════
// SubmitForm.ts — Name input sanitization, validation, submission handling
// ════════════════════════════════════════════════════════════════════════════

import { LEADERBOARD_CONFIG } from '../config';
import { safeGetItem, safeSetItem } from '../systems/storage';
import type { ApiClient } from '../net/api';
import type { RunTokenPayload } from '../net/runToken';

const NAME_KEY = 'kalachakra.player_name';

export class SubmitForm {
  private container: HTMLElement;
  private inputEl: HTMLInputElement;
  private submitBtn: HTMLButtonElement;
  private cancelBtn: HTMLButtonElement;
  private statusEl: HTMLElement;
  private scoreEl: HTMLElement;

  private api: ApiClient;
  private onSubmitSuccess?: (rank: number, isTop10: boolean) => void;
  private onCancel?: () => void;

  private currentScore = 0;
  private currentToken: RunTokenPayload | null = null;
  private isSubmitting = false;

  constructor(
    container: HTMLElement,
    api: ApiClient,
    callbacks: {
      onSubmitSuccess: (rank: number, isTop10: boolean) => void;
      onCancel: () => void;
    }
  ) {
    this.container = container;
    this.api = api;
    this.onSubmitSuccess = callbacks.onSubmitSuccess;
    this.onCancel = callbacks.onCancel;

    this.container.innerHTML = `
      <div class="modal-card">
        <h2 class="title-text">SUBMIT SCORE</h2>
        <div class="score-display-large" id="submit-score-val">000000</div>
        <p class="subtitle-text">ENTER YOUR NAME FOR THE LEADERBOARD</p>
        <div class="input-wrapper">
          <input 
            type="text" 
            id="player-name-input" 
            maxlength="${LEADERBOARD_CONFIG.NAME_MAX_LEN}" 
            placeholder="YOUR NAME" 
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
          />
        </div>
        <div class="form-status" id="submit-status"></div>
        <div class="button-row">
          <button type="button" class="btn btn-secondary" id="submit-cancel-btn">BACK</button>
          <button type="button" class="btn btn-primary" id="submit-confirm-btn">SUBMIT</button>
        </div>
      </div>
    `;

    this.inputEl = this.container.querySelector('#player-name-input')!;
    this.submitBtn = this.container.querySelector('#submit-confirm-btn')!;
    this.cancelBtn = this.container.querySelector('#submit-cancel-btn')!;
    this.statusEl = this.container.querySelector('#submit-status')!;
    this.scoreEl = this.container.querySelector('#submit-score-val')!;

    this.setupListeners();
  }

  private setupListeners(): void {
    // Input sanitization: letters, numbers, spaces only, uppercase
    this.inputEl.addEventListener('input', () => {
      const sanitized = this.inputEl.value
        .toUpperCase()
        .replace(/[^A-Z0-9 ]/g, '')
        .slice(0, LEADERBOARD_CONFIG.NAME_MAX_LEN);
      this.inputEl.value = sanitized;
      this.statusEl.textContent = '';
    });

    this.inputEl.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        this.submit();
      }
    });

    this.submitBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.submit();
    });

    this.cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onCancel) this.onCancel();
    });
  }

  open(score: number, token: RunTokenPayload): void {
    this.currentScore = score;
    this.currentToken = token;
    this.scoreEl.textContent = String(score).padStart(6, '0');
    this.statusEl.textContent = '';
    this.isSubmitting = false;
    this.submitBtn.disabled = false;
    this.submitBtn.textContent = 'SUBMIT';

    // Pre-fill last used name
    const savedName = safeGetItem(NAME_KEY) || '';
    this.inputEl.value = savedName;

    setTimeout(() => {
      this.inputEl.focus();
    }, 100);
  }

  private async submit(): Promise<void> {
    if (this.isSubmitting || !this.currentToken) return;

    const rawName = this.inputEl.value.trim();
    if (rawName.length < 2) {
      this.statusEl.textContent = 'NAME TOO SHORT (MIN 2 CHARS)';
      return;
    }

    this.isSubmitting = true;
    this.submitBtn.disabled = true;
    this.submitBtn.textContent = 'SENDING...';
    this.statusEl.textContent = '';

    // Remember name
    safeSetItem(NAME_KEY, rawName);

    try {
      const res = await this.api.submitScore(rawName, this.currentScore, this.currentToken);
      if (res.success) {
        if (this.onSubmitSuccess) {
          this.onSubmitSuccess(res.rank, res.isTop10);
        }
      } else {
        this.statusEl.textContent = res.error || 'SUBMISSION FAILED';
        this.submitBtn.disabled = false;
        this.submitBtn.textContent = 'RETRY';
        this.isSubmitting = false;
      }
    } catch {
      this.statusEl.textContent = 'NETWORK ERROR (QUEUED)';
      this.submitBtn.disabled = false;
      this.submitBtn.textContent = 'RETRY';
      this.isSubmitting = false;
    }
  }
}
