import type { GameCategory } from "@/lib/game-names";
import { getRomCategory, isArcadeCore, parseRomName } from "@/lib/game-names";
import type { RomInfo } from "@/stores/useNetplayLobbyStore";

/**
 * 오늘의 추천 게임 하나를 표현한다.
 * ROM 카탈로그 API의 `path`를 그대로 가지고 있어
 * NetplayLobby의 자동 방 생성 시 정확히 매칭된다.
 */
export interface TodaysPick {
  filename: string;
  core: string;
  path: string;
  displayName: string;
  category: GameCategory;
  bios?: string;
}

/**
 * 순서 있는 카테고리 목록. 추천 시 이 순서로 라운드 로빈한다.
 * "etc"는 의도적으로 제외 — 추천 품질을 위해 known 카테고리만 우선.
 */
const CATEGORY_ORDER: GameCategory[] = [
  "fighting",
  "action",
  "shooting",
  "puzzle",
  "sports",
];

// ── 시드 기반 PRNG (mulberry32) ──────────────────────────────────

/**
 * 문자열을 32비트 해시로 변환한다 (djb2).
 */
function hashString(s: string): number {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

/**
 * mulberry32 PRNG 팩토리.
 * 반환된 함수는 호출될 때마다 0 이상 1 미만의 의사난수를 생성한다.
 */
function seededRandom(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates 셔플 (원본 불변). */
function shuffleSeeded<T>(arr: T[], rng: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ── 추천 알고리즘 ────────────────────────────────────────────────

/**
 * ROM 목록에서 오늘 날짜 기준으로 추천 게임을 뽑는다.
 * 같은 날짜 + 같은 ROM 목록이면 항상 같은 결과를 반환한다 (결정론적).
 *
 * 알고리즘:
 * 1. 아케이드 코어 ROM만 필터링
 * 2. 날짜(YYYY-MM-DD) → 시드 → PRNG
 * 3. 카테고리별로 나눠서 ["fighting","action","shooting","puzzle","sports"] 순으로
 *    각 카테고리에서 Fisher-Yates 셔플 후 1개씩 선택
 * 4. 5개에 못 미치면 전체 풀에서 중복 제외하고 추가 선택
 *
 * @param roms - 서버에서 받은 전체 ROM 목록
 * @param date - 기준 날짜 (기본: 오늘)
 * @param count - 추천 개수 (기본: 5)
 */
export function pickTodaysGames(
  roms: RomInfo[],
  date: Date = new Date(),
  count = 5,
): TodaysPick[] {
  // 1. 아케이드 코어만 대상
  const arcadeRoms = roms.filter((rom) => isArcadeCore(rom.core));
  if (arcadeRoms.length === 0) return [];

  // 2. 날짜 기반 시드
  const dateKey = date.toISOString().slice(0, 10); // "2026-08-04"
  const rng = seededRandom(hashString(dateKey));

  // ROM → TodaysPick 변환 헬퍼
  const toPick = (rom: RomInfo): TodaysPick => ({
    filename: rom.filename,
    core: rom.core,
    path: rom.path,
    displayName: parseRomName(rom.filename, rom.core),
    category: getRomCategory(rom.filename, rom.core),
    bios: rom.bios,
  });

  // 3. 카테고리별 그룹화
  const byCategory = new Map<GameCategory, RomInfo[]>();
  for (const rom of arcadeRoms) {
    const cat = getRomCategory(rom.filename, rom.core);
    const bucket = byCategory.get(cat);
    if (bucket) {
      bucket.push(rom);
    } else {
      byCategory.set(cat, [rom]);
    }
  }

  const picks: TodaysPick[] = [];
  const pickedPaths = new Set<string>();

  // 4. 라운드 로빈 — 각 카테고리에서 1개씩
  for (const cat of CATEGORY_ORDER) {
    if (picks.length >= count) break;
    const bucket = byCategory.get(cat);
    if (!bucket || bucket.length === 0) continue;
    const shuffled = shuffleSeeded(bucket, rng);
    const chosen = shuffled[0];
    picks.push(toPick(chosen));
    pickedPaths.add(chosen.path);
  }

  // 5. 부족하면 전체 풀에서 추가
  if (picks.length < count) {
    const remaining = arcadeRoms.filter((rom) => !pickedPaths.has(rom.path));
    const shuffled = shuffleSeeded(remaining, rng);
    for (const rom of shuffled) {
      if (picks.length >= count) break;
      if (pickedPaths.has(rom.path)) continue;
      picks.push(toPick(rom));
      pickedPaths.add(rom.path);
    }
  }

  return picks;
}
