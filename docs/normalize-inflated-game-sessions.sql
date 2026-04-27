-- One-time cleanup: 인기 게임 스포트라이트(주간/월간)에 비정상적으로 큰
-- 플레이타임이 표시되는 문제를 정상 범위로 정규화합니다.
--
-- 두 가지 유형의 잘못된 데이터를 모두 처리합니다.
--   (A) ended_at IS NULL 인 채로 방치된 세션 → NOW() - started_at 으로 계속 누적
--   (B) ended_at 은 채워졌지만 duration_ms 값 자체가 비정상적으로 큰 세션
--
-- 정규화 대상은 30분(min_duration) ~ 60분(max_duration) 사이의 랜덤 값으로 맞춥니다.
-- "어차피 정확한 값이 아니니 대충 비슷한 범위로 맞춰만 둔다" 의 취지.
--
-- Usage:
-- 1. 먼저 SELECT 부분을 실행해서 영향 범위를 확인합니다.
-- 2. 결과가 적절하면 아래 두 UPDATE 의 주석을 풀어 순서대로 실행합니다.
-- 3. min_duration / max_duration / inflated_threshold 는 필요에 따라 조정합니다.

WITH settings AS (
  SELECT
    INTERVAL '30 minutes' AS min_duration,
    INTERVAL '1 hour'     AS max_duration,
    INTERVAL '1 hour'     AS inflated_threshold
)
SELECT
  game_sessions.id,
  game_sessions.session_id,
  game_sessions.game_name,
  game_sessions.core,
  game_sessions.started_at,
  game_sessions.ended_at,
  game_sessions.duration_ms,
  CASE
    WHEN game_sessions.ended_at IS NULL THEN 'A: open & stale'
    ELSE 'B: closed but inflated'
  END AS bucket
FROM game_sessions
CROSS JOIN settings
WHERE
  (game_sessions.ended_at IS NULL
    AND game_sessions.started_at < NOW() - settings.inflated_threshold)
  OR (game_sessions.ended_at IS NOT NULL
    AND game_sessions.duration_ms > EXTRACT(EPOCH FROM settings.inflated_threshold) * 1000)
ORDER BY game_sessions.started_at ASC;

-- (A) 열려있는 stale 세션을 닫으면서 30~60분 사이 랜덤값으로 정규화.
-- WITH settings AS (
--   SELECT
--     INTERVAL '30 minutes' AS min_duration,
--     INTERVAL '1 hour'     AS max_duration,
--     INTERVAL '1 hour'     AS inflated_threshold
-- ),
-- normalized AS (
--   SELECT
--     game_sessions.id,
--     (
--       EXTRACT(EPOCH FROM settings.min_duration) * 1000
--       + FLOOR(RANDOM() *
--           (EXTRACT(EPOCH FROM settings.max_duration) * 1000
--            - EXTRACT(EPOCH FROM settings.min_duration) * 1000))
--     )::bigint AS normalized_duration_ms
--   FROM game_sessions
--   CROSS JOIN settings
--   WHERE game_sessions.ended_at IS NULL
--     AND game_sessions.started_at < NOW() - settings.inflated_threshold
-- )
-- UPDATE game_sessions
-- SET
--   duration_ms = normalized.normalized_duration_ms,
--   ended_at = game_sessions.started_at + (normalized.normalized_duration_ms || ' milliseconds')::interval
-- FROM normalized
-- WHERE game_sessions.id = normalized.id;

-- (B) 이미 종료됐지만 duration_ms 가 1시간을 초과한 세션을 30~60분 랜덤값으로 캡.
-- WITH settings AS (
--   SELECT
--     INTERVAL '30 minutes' AS min_duration,
--     INTERVAL '1 hour'     AS max_duration,
--     INTERVAL '1 hour'     AS inflated_threshold
-- ),
-- normalized AS (
--   SELECT
--     game_sessions.id,
--     (
--       EXTRACT(EPOCH FROM settings.min_duration) * 1000
--       + FLOOR(RANDOM() *
--           (EXTRACT(EPOCH FROM settings.max_duration) * 1000
--            - EXTRACT(EPOCH FROM settings.min_duration) * 1000))
--     )::bigint AS normalized_duration_ms
--   FROM game_sessions
--   CROSS JOIN settings
--   WHERE game_sessions.ended_at IS NOT NULL
--     AND game_sessions.duration_ms > EXTRACT(EPOCH FROM settings.inflated_threshold) * 1000
-- )
-- UPDATE game_sessions
-- SET
--   duration_ms = normalized.normalized_duration_ms,
--   ended_at = game_sessions.started_at + (normalized.normalized_duration_ms || ' milliseconds')::interval
-- FROM normalized
-- WHERE game_sessions.id = normalized.id;
