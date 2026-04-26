-- One-time cleanup for stale game_sessions rows left open before
-- server-side auto-finalization was deployed.
--
-- Usage:
-- 1. Review the candidate rows from the first SELECT.
-- 2. If the result looks correct, run the UPDATE section below.
-- 3. Adjust stale_after / max_duration if your production traffic needs a different window.

WITH settings AS (
  SELECT
    INTERVAL '2 hours' AS stale_after,
    INTERVAL '2 hours' AS max_duration
),
stale_sessions AS (
  SELECT
    game_sessions.session_id,
    game_sessions.game_name,
    game_sessions.rom_path,
    game_sessions.core,
    game_sessions.started_at,
    LEAST(NOW(), game_sessions.started_at + settings.max_duration) AS normalized_ended_at,
    FLOOR(
      EXTRACT(
        EPOCH FROM (
          LEAST(NOW(), game_sessions.started_at + settings.max_duration) - game_sessions.started_at
        )
      ) * 1000
    )::bigint AS normalized_duration_ms
  FROM game_sessions
  CROSS JOIN settings
  WHERE game_sessions.ended_at IS NULL
    AND game_sessions.started_at < NOW() - settings.stale_after
)
SELECT
  session_id,
  game_name,
  rom_path,
  core,
  started_at,
  normalized_ended_at,
  normalized_duration_ms
FROM stale_sessions
ORDER BY started_at ASC;

-- After review, run this update.
-- WITH settings AS (
--   SELECT
--     INTERVAL '2 hours' AS stale_after,
--     INTERVAL '2 hours' AS max_duration
-- ),
-- stale_sessions AS (
--   SELECT
--     game_sessions.session_id,
--     LEAST(NOW(), game_sessions.started_at + settings.max_duration) AS normalized_ended_at,
--     FLOOR(
--       EXTRACT(
--         EPOCH FROM (
--           LEAST(NOW(), game_sessions.started_at + settings.max_duration) - game_sessions.started_at
--         )
--       ) * 1000
--     )::bigint AS normalized_duration_ms
--   FROM game_sessions
--   CROSS JOIN settings
--   WHERE game_sessions.ended_at IS NULL
--     AND game_sessions.started_at < NOW() - settings.stale_after
-- )
-- UPDATE game_sessions
-- SET
--   ended_at = stale_sessions.normalized_ended_at,
--   duration_ms = GREATEST(game_sessions.duration_ms, stale_sessions.normalized_duration_ms)
-- FROM stale_sessions
-- WHERE game_sessions.session_id = stale_sessions.session_id;