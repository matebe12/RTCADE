/**
 * MAME/Arcade ROM short-code → human-readable game name lookup.
 * Covers the most popular titles; unknown ROMs fall back to filename humanization.
 */
const MAME_NAMES: Record<string, string> = {
  // Metal Slug series
  mslug: "메탈슬러그",
  mslug2: "메탈슬러그 2",
  mslug3: "메탈슬러그 3",
  mslug4: "메탈슬러그 4",
  mslug5: "메탈슬러그 5",
  mslugx: "메탈슬러그 X",
  // KOF series
  kof94: "KOF '94",
  kof95: "KOF '95",
  kof96: "KOF '96",
  kof97: "KOF '97",
  kof98: "KOF '98",
  kof99: "KOF '99",
  kof2000: "KOF 2000",
  kof2001: "KOF 2001",
  kof2002: "KOF 2002",
  kof2003: "KOF 2003",
  // Street Fighter
  sf2: "Street Fighter II",
  sf2ce: "Street Fighter II: Champion Edition",
  sf2hf: "Street Fighter II: Hyper Fighting",
  ssf2: "Super Street Fighter II",
  ssf2t: "Super Street Fighter II Turbo",
  sfa: "Street Fighter Alpha",
  sfa2: "Street Fighter Alpha 2",
  sfa3: "Street Fighter Alpha 3",
  sf3: "Street Fighter III",
  sf3_2nd: "Street Fighter III: 2nd Impact",
  sf3_3rd: "Street Fighter III: 3rd Strike",
  // Capcom fighters
  vsav: "Vampire Savior",
  vsav2: "Vampire Savior 2",
  mvsc: "Marvel vs. Capcom",
  mshvsf: "Marvel Super Heroes vs. Street Fighter",
  xmvsf: "X-Men vs. Street Fighter",
  xmcota: "X-Men: Children of the Atom",
  // SNK fighters
  samsho: "사무라이 쇼다운",
  samsho2: "사무라이 쇼다운 2",
  samsho3: "사무라이 쇼다운 3",
  samsho4: "사무라이 쇼다운 4",
  samsho5: "사무라이 쇼다운 5",
  fatfury1: "아랑전설",
  fatfury2: "아랑전설 2",
  fatfursp: "아랑전설 스페셜",
  fatfury3: "아랑전설 3",
  garou: "가로우: 늑대의 각인",
  rbff1: "Real Bout 아랑전설",
  rbff2: "Real Bout 아랑전설 2",
  aof: "용호의 권",
  aof2: "용호의 권 2",
  aof3: "용호의 권 3",
  wh1: "월드히어로즈",
  wh2: "월드히어로즈 2",
  wh2j: "월드히어로즈 2 Jet",
  whp: "월드히어로즈 퍼펙트",
  matrim: "Matrimelee",
  lastblad: "Last Blade",
  lastbld2: "Last Blade 2",
  // Run & Gun / Beat 'em up
  captcomm: "캡틴 코만도",
  dino: "캐딜락 & 다이노사우르스",
  punisher: "퍼니셔",
  ffight: "파이널 파이트",
  knights: "Knights of the Round",
  sengoku3: "전국전설 2001",
  // Shoot 'em up
  "1944": "1944: The Loop Master",
  "1943": "1943: The Battle of Midway",
  "19xx": "19XX: The War Against Destiny",
  progear: "Progear",
  guwange: "구완게",
  ddonpach: "도돈파치",
  dfeveron: "다이펑커론",
  esprade: "에스프레이드",
  // Puzzle / misc
  pang3: "팡 3",
  bublbobl: "버블보블",
  snowbros: "스노우 브라더스",
  puzloop: "퍼즐루프",
  // Side scrollers
  simpsons: "심슨 가족",
  tmnt: "닌자거북이",
  tmnt2: "닌자거북이 2",
  xmen: "X-Men",
  avsp: "에일리언 vs. 프레데터",
  // Sports
  nbahangt: "NBA Hangtime",
  nbajam: "NBA Jam",
  // Puzzle Fighter
  sgemf: "Super Gem Fighter Mini Mix",
  spf2t: "Super Puzzle Fighter II Turbo",
  // Bomberman
  bbmanw: "봄버맨 월드",
  // Tetris
  tetris: "테트리스",
  // Pac-Man
  pacman: "팩맨",
  mspacman: "미즈 팩맨",
  // Donkey Kong
  dkong: "동키콩",
  dkongjr: "동키콩 Jr.",
  // Galaga
  galaga: "갤러가",
  galaxian: "갤럭시안",
  // Contra
  contra: "콘트라",
  // Misc classics
  digdug: "딕덕",
  frogger: "프로거",
  qbert: "큐버트",
  joust: "쥬스트",
  defender: "디펜더",
  tempest: "템페스트",
  centipede: "센티피드",
  asteroid: "아스테로이드",
  spaceinv: "스페이스 인베이더",
  // Windjammers
  wjammers: "윈드잼머스",
  // Power Instinct
  powerins: "Power Instinct",
  // Guilty Gear
  ggx: "Guilty Gear X",
  // Misc Neo Geo
  blazstar: "Blazing Star",
  pulstar: "Pulstar",
  twinbee: "트윈비",
  pbobblen: "Puzzle Bobble",
  magdrop3: "Magical Drop 3",
  stakwin: "Stakes Winner",
  turfmast: "Neo Turf Masters",
  ironclad: "Ironclad",
  shocktr2: "Shock Troopers: 2nd Squad",
  shocktro: "Shock Troopers",
  rotd: "Rage of the Dragons",
  kabukikl: "Kabuki Klash",
  sonicwi3: "Aero Fighters 3",
  viewpoin: "Viewpoint",
  tpgolf: "Top Player's Golf",
  overtop: "Over Top",
  neobombe: "Neo Bomberman",
};

/**
 * Convert a ROM filename like "mslug3.zip" or "Super_Mario_Bros.nes"
 * into a human-friendly display name.
 */
export function parseRomName(filename: string, core: string): string {
  // Strip extension
  const base = filename.replace(/\.\w+$/, "");

  // For MAME/arcade cores, try the lookup table first
  if (core === "mame2003" || core === "mame2003_plus" || core === "arcade" || core === "fbneo") {
    const known = MAME_NAMES[base.toLowerCase()];
    if (known) return known;
  }

  // Fallback: humanize the filename
  return base
    .replace(/[_-]/g, " ") // underscores/hyphens → spaces
    .replace(/([a-z])([A-Z])/g, "$1 $2") // camelCase split
    .replace(/\s+/g, " ") // collapse whitespace
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase()); // title case
}
