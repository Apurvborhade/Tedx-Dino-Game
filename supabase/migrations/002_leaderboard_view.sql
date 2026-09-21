-- ════════════════════════════════════════════════════════════════════════════
-- 002_leaderboard_view.sql — Best run per player name for the public board
-- ════════════════════════════════════════════════════════════════════════════

create or replace view public.leaderboard as
select distinct on (name)
  name,
  score,
  created_at
from public.scores
order by name, score desc, created_at asc;

grant select on public.leaderboard to anon, authenticated;
