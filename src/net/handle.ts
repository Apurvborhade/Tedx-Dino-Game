// ════════════════════════════════════════════════════════════════════════════
// handle.ts — Instagram handle sanitizing and validation
//
// Instagram allows 1-30 characters of a-z, 0-9, "." and "_"; a handle may not
// start or end with a period, and may not contain two in a row. Handles are
// case-insensitive, so we store them lowercase and compare lowercase.
//
// The Edge Function repeats these rules — it cannot import this file, so if
// you change them here, change supabase/functions/submit-score/index.ts too.
// ════════════════════════════════════════════════════════════════════════════

export const HANDLE_MIN_LEN = 2;
export const HANDLE_MAX_LEN = 30;

/** Strip everything Instagram would not accept, as the player types. */
export function sanitizeHandle(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')          // people type the @; Instagram does not store it
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, HANDLE_MAX_LEN);
}

/** null when the handle is usable, otherwise why it is not (already uppercased
 *  for display in the 1-bit UI). */
export function validateHandle(handle: string): string | null {
  if (handle.length < HANDLE_MIN_LEN) return `HANDLE TOO SHORT (MIN ${HANDLE_MIN_LEN} CHARS)`;
  if (handle.length > HANDLE_MAX_LEN) return `HANDLE TOO LONG (MAX ${HANDLE_MAX_LEN} CHARS)`;
  if (!/^[a-z0-9._]+$/.test(handle)) return 'ONLY LETTERS, NUMBERS, . AND _';
  if (handle.startsWith('.') || handle.endsWith('.')) return 'CANNOT START OR END WITH A DOT';
  if (handle.includes('..')) return 'NO TWO DOTS IN A ROW';
  return null;
}
