// ════════════════════════════════════════════════════════════════════════════
// loadtest.mjs — Simulate N concurrent players against a deployed build.
//
//   node scripts/loadtest.mjs --url https://your-site.pages.dev \
//        [--users 100] [--duration 90] [--submit]
//
// Each virtual player: loads the page + assets (the QR-scan burst), then loops
// "play a run → game over → (submit score) → watch the leaderboard, which
// polls every 20s". Static traffic goes to --url, leaderboard reads go to
// Supabase REST and submissions (only with --submit) go to the Edge Function,
// both read from .env. Submissions use names LOADTEST0..19 so they can be
// cleaned up afterwards:  delete from scores where name like 'LOADTEST%';
// ════════════════════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => a.startsWith('--')
    ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]]
    : []).filter(x => x.length),
);
const SITE = (args.url ?? 'http://localhost:4173').replace(/\/$/, '');
const USERS = Number(args.users ?? 100);
const DURATION = Number(args.duration ?? 90) * 1000;
const SUBMIT = args.submit === true;

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter(l => l.includes('=')).map(l => l.split('=').map(s => s.trim())),
);
const SUPABASE = env.VITE_SUPABASE_URL;
const ANON = env.VITE_SUPABASE_ANON_KEY;

// ── Stats ────────────────────────────────────────────────────────────────────
const stats = new Map();
function record(name, ms, ok, status) {
  let s = stats.get(name);
  if (!s) stats.set(name, s = { samples: [], errors: 0, statuses: {} });
  s.samples.push(ms);
  if (!ok) s.errors++;
  s.statuses[status] = (s.statuses[status] ?? 0) + 1;
}
async function timed(name, fn) {
  const t0 = performance.now();
  try {
    const res = await fn();
    record(name, performance.now() - t0, res.ok, res.status);
    return res;
  } catch (err) {
    record(name, performance.now() - t0, false, err?.cause?.code ?? err?.name ?? 'ERR');
    return null;
  }
}
const pct = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(arr.length * p))];

// ── Traffic ──────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);

async function loadPage() {
  const res = await timed('page: index.html', () => fetch(`${SITE}/`, { cache: 'no-store' }));
  if (!res?.ok) return;
  const html = await res.text();
  const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(m => m[1]);
  await Promise.all([
    ...assets.map(a => timed('page: js/css', () => fetch(new URL(a, SITE + '/')))),
    timed('page: bg webp', () => fetch(`${SITE}/game-bg/day1.webp`)),
    timed('page: bg webp', () => fetch(`${SITE}/game-bg/night.webp`)),
  ]);
}

function fetchLeaderboard() {
  return timed('api: leaderboard read', () => fetch(
    `${SUPABASE}/rest/v1/leaderboard?select=name,score&order=score.desc&limit=10`,
    { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } },
  ));
}

function submitScore(i, durationMs) {
  // Stay inside the Edge Function's plausibility bound (21 score/s + 50) and
  // keep scores tiny so LOADTEST names never reach the real top 10.
  const score = Math.min(Math.floor(durationMs / 1000 * rand(3, 8)), 40);
  const token = { runId: `lt-${i}-${Date.now()}`, startTime: Date.now() - durationMs, durationMs, jumpCount: 12, score, signature: '0' };
  return timed('api: submit score', () => fetch(`${SUPABASE}/functions/v1/submit-score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON },
    body: JSON.stringify({ name: `LOADTEST${i % 20}`, score, token }),
  }));
}

async function player(i, deadline) {
  await sleep(rand(0, 3000));           // the crowd scans the QR within ~3s
  await loadPage();
  while (Date.now() < deadline) {
    const run = rand(8000, 25000);      // one run
    await sleep(Math.min(run, deadline - Date.now()));
    if (Date.now() >= deadline) break;
    if (SUBMIT) await submitScore(i, Math.round(run));
    await fetchLeaderboard();           // game-over screen opens the board
    const watch = rand(5000, 30000);    // …and polls it every 20s while open
    const end = Math.min(Date.now() + watch, deadline);
    while (Date.now() + 20000 < end) {
      await sleep(20000);
      await fetchLeaderboard();
    }
    await sleep(Math.max(0, end - Date.now()));
  }
}

// ── Run ──────────────────────────────────────────────────────────────────────
console.log(`Load test: ${USERS} players for ${DURATION / 1000}s`);
console.log(`  static → ${SITE}`);
console.log(`  api    → ${SUPABASE}${SUBMIT ? ' (with score submissions)' : ' (reads only)'}\n`);

const deadline = Date.now() + DURATION;
const t0 = Date.now();
await Promise.all(Array.from({ length: USERS }, (_, i) => player(i, deadline)));
const elapsed = (Date.now() - t0) / 1000;

console.log(`${'endpoint'.padEnd(24)} ${'reqs'.padStart(5)} ${'err'.padStart(4)} ${'p50'.padStart(7)} ${'p95'.padStart(7)} ${'p99'.padStart(7)} ${'max'.padStart(7)}  statuses`);
let totalErr = 0;
for (const [name, s] of [...stats.entries()].sort()) {
  const a = s.samples.sort((x, y) => x - y);
  totalErr += s.errors;
  const f = (v) => `${v.toFixed(0)}ms`.padStart(7);
  console.log(`${name.padEnd(24)} ${String(a.length).padStart(5)} ${String(s.errors).padStart(4)} ${f(pct(a, 0.5))} ${f(pct(a, 0.95))} ${f(pct(a, 0.99))} ${f(a[a.length - 1])}  ${JSON.stringify(s.statuses)}`);
}
const total = [...stats.values()].reduce((n, s) => n + s.samples.length, 0);
console.log(`\n${total} requests in ${elapsed.toFixed(0)}s (${(total / elapsed).toFixed(1)} req/s avg), ${totalErr} errors`);
process.exit(totalErr ? 1 : 0);
