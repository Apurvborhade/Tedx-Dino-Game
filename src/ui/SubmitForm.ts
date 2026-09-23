// ════════════════════════════════════════════════════════════════════════════
// SubmitForm.ts — Instagram handle input, validation, submission handling
// ════════════════════════════════════════════════════════════════════════════

import { safeGetItem, safeSetItem } from '../systems/storage';
import { HANDLE_MAX_LEN, sanitizeHandle, validateHandle } from '../net/handle';
import type { ApiClient } from '../net/api';
import type { RunTokenPayload } from '../net/runToken';

// Key kept from when this field was a display name: renaming it would drop
// every returning player's saved value.
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
        <p class="subtitle-text">ENTER YOUR INSTAGRAM ID FOR THE LEADERBOARD</p>
        <div class="input-wrapper">
          <input 
            type="text" 
            id="player-name-input" 
            maxlength="${HANDLE_MAX_LEN}" 
            placeholder="@yourhandle" 
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
            inputmode="text"
          />
        </div>
        <p class="giveaway-note">FOLLOW <b>@TEDXDYPDPU</b> ON INSTAGRAM TO ENTER<br />NOT FOLLOWING = NOT ELIGIBLE FOR THE GIVEAWAY</p>
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
    // Input sanitization: Instagram's own character set, lowercase
    this.inputEl.addEventListener('input', () => {
      const sanitized = sanitizeHandle(this.inputEl.value);
      if (sanitized !== this.inputEl.value) this.inputEl.value = sanitized;
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

    // Pre-fill the last handle. Anything saved back when this field was a
    // display name gets sanitized here, or dropped if nothing survives.
    this.inputEl.value = sanitizeHandle(safeGetItem(NAME_KEY) || '');

    setTimeout(() => {
      this.inputEl.focus();
    }, 100);
  }

  private async submit(): Promise<void> {
    if (this.isSubmitting || !this.currentToken) return;

    const handle = sanitizeHandle(this.inputEl.value);
    const problem = validateHandle(handle);
    if (problem) {
      this.statusEl.textContent = problem;
      return;
    }

    this.isSubmitting = true;
    this.submitBtn.disabled = true;
    this.submitBtn.textContent = 'SENDING...';
    this.statusEl.textContent = '';

    // Remember the handle
    safeSetItem(NAME_KEY, handle);

    try {
      const res = await this.api.submitScore(handle, this.currentScore, this.currentToken);
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
