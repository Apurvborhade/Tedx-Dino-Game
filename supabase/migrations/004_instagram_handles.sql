-- ════════════════════════════════════════════════════════════════════════════
-- 004_instagram_handles.sql — The leaderboard now identifies players by their
-- Instagram handle instead of a free-text name, for the follow-to-enter
-- giveaway. Handles run to 30 characters, so the old 2-12 check would reject
-- most of them with a bare "Database insert failed".
--
-- The column keeps the name `name`: renaming it would mean rewriting the
-- `leaderboard` view and the Edge Function insert in the same breath, and
-- existing rows already hold old-style display names.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.scores
  drop constraint if exists scores_name_check;

alter table public.scores
  add constraint scores_name_check
  check (char_length(name) >= 2 and char_length(name) <= 30);
