-- ════════════════════════════════════════════════════════════════════════════
-- 001_init.sql — Supabase PostgreSQL Schema for Kalachakra Leaderboard
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Scores Table
create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) >= 2 and char_length(name) <= 12),
  score integer not null check (score >= 0 and score <= 999999),
  duration_ms integer not null check (duration_ms > 0),
  jump_count integer not null default 0,
  ip_hash text,
  user_agent text
);

-- 2. Indexes for fast leaderboard queries
create index if not exists idx_scores_score_desc on public.scores (score desc);
create index if not exists idx_scores_created_at on public.scores (created_at desc);

-- 3. Row Level Security (RLS)
alter table public.scores enable row level security;

-- Public can read scores
create policy "Allow public read access"
  on public.scores
  for select
  using (true);

-- Only edge functions / service role can insert scores directly
create policy "Service role insert only"
  on public.scores
  for insert
  with check (auth.role() = 'service_role');

-- 4. Top 10 Leaderboard View
create or replace view public.top_scores as
select
  id,
  name,
  score,
  created_at,
  dense_rank() over (order by score desc) as rank
from public.scores
order by score desc
limit 10;
