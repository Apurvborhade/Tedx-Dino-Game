-- ════════════════════════════════════════════════════════════════════════════
-- 003_leaderboard_index.sql — Let the `leaderboard` view (distinct on name,
-- best score first) walk an index instead of sorting the whole table on every
-- 20-second poll from every open game-over screen.
-- ════════════════════════════════════════════════════════════════════════════

create index if not exists idx_scores_name_score
  on public.scores (name, score desc, created_at asc);
