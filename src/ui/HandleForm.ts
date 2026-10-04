// ════════════════════════════════════════════════════════════════════════════
// HandleForm.ts — Asks for the player's Instagram handle once, before their
// first run. Scores are then saved under it automatically on every game over.
// ════════════════════════════════════════════════════════════════════════════

import { safeGetItem, safeSetItem } from '../systems/storage';
import { HANDLE_MAX_LEN, sanitizeHandle, validateHandle } from '../net/handle';

// Key kept from when this field was a display name: renaming it would drop
// every returning player's saved value.
const NAME_KEY = 'kalachakra.player_name';

/** The saved handle, or null if the player hasn't entered a usable one yet.
 *  Anything saved back when this field was a display name gets sanitized
 *  here, or dropped if nothing valid survives. */
export function getSavedHandle(): string | null {
  const handle = sanitizeHandle(safeGetItem(NAME_KEY) || '');
  return validateHandle(handle) ? null : handle;
}

export class HandleForm {
  private container: HTMLElement;
  private inputEl: HTMLInputElement;
  private saveBtn: HTMLButtonElement;
  private cancelBtn: HTMLButtonElement;
  private statusEl: HTMLElement;

  private onSaved: (handle: string) => void;
  private onCancel: () => void;

  constructor(
    container: HTMLElement,
    callbacks: {
      onSaved: (handle: string) => void;
      onCancel: () => void;
    }
  ) {
    this.container = container;
    this.onSaved = callbacks.onSaved;
    this.onCancel = callbacks.onCancel;

    this.container.innerHTML = `
      <div class="modal-card">
        <h2 class="title-text">WHO'S RUNNING?</h2>
        <p class="subtitle-text">ENTER YOUR INSTAGRAM ID — YOUR SCORES<br />GO ON THE LEADERBOARD AUTOMATICALLY</p>
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
        <div class="form-status" id="handle-status"></div>
        <div class="button-row">
          <button type="button" class="btn btn-secondary" id="handle-cancel-btn">BACK</button>
          <button type="button" class="btn btn-primary" id="handle-save-btn">PLAY</button>
        </div>
      </div>
    `;

    this.inputEl = this.container.querySelector('#player-name-input')!;
    this.saveBtn = this.container.querySelector('#handle-save-btn')!;
    this.cancelBtn = this.container.querySelector('#handle-cancel-btn')!;
    this.statusEl = this.container.querySelector('#handle-status')!;

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
        this.save();
      }
    });

    this.saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.save();
    });

    this.cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onCancel();
    });
  }

  open(): void {
    this.statusEl.textContent = '';
    this.inputEl.value = getSavedHandle() ?? '';

    setTimeout(() => {
      this.inputEl.focus();
    }, 100);
  }

  private save(): void {
    const handle = sanitizeHandle(this.inputEl.value);
    const problem = validateHandle(handle);
    if (problem) {
      this.statusEl.textContent = problem;
      return;
    }

    safeSetItem(NAME_KEY, handle);
    this.inputEl.blur();
    this.onSaved(handle);
  }
}
