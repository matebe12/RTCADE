import { isArcadeCore, parseRomName, resolveArcadeLookupValue } from "@/lib/game-names";

/**
 * MAME ROM shortcode → 영어 MAME 데이터베이스 이름 매핑.
 * libretro-thumbnails CDN에서 스크린샷을 가져오기 위한 이름.
 * https://thumbnails.libretro.com/MAME/Named_Snaps/{name}.png
 *
 * 파일명 규칙:
 *  - ':' → '_'
 *  - '/' → '_'
 *  - 나머지는 그대로 (URL 인코딩은 getGameThumbnailUrl에서 처리)
 */
const MAME_THUMBNAIL_NAMES: Record<string, string> = {
  // ── # 숫자 ──
  "19xx": "19XX_ The War Against Destiny (USA 951207)",
  "1941": "1941_ Counter Attack (World)",
  "1942": "1942 (Revision B)",
  "1943": "1943_ The Battle of Midway (US)",
  "1943kai": "1943 Kai_ Midway Kaisen (Japan)",
  "1944": "1944_ The Loop Master (USA 000620)",
  "1945kiii": "1945k III",
  "2020bb": "2020 Super Baseball (set 1)",
  "3countb": "3 Count Bout _ Fire Suplex",
  "3wonders": "Three Wonders (World 910520)",
  "64street": "64th. Street - A Detective Story (World)",
  "88games": "'88 Games",

  // ── A ──
  acrobatm: "Acrobat Mission",
  aburner2: "After Burner II",
  aerofgt: "Aero Fighters",
  airbustr: "Air Buster_ Trouble Specialty Raid Unit (World)",
  airduel: "Air Duel (Japan)",
  ajax: "Ajax",
  aliens: "Aliens (World set 1)",
  aliensyn: "Alien Syndrome (set 1)",
  altbeast: "Altered Beast (Version 1)",
  androdun: "Andro Dunos",
  aodk: "Aggressors of Dark Kombat _ Tsuukai GANGAN Koushinkyoku",
  aof: "Art of Fighting _ Ryuuko no Ken",
  aof2: "Art of Fighting 2 _ Ryuuko no Ken 2",
  aof3: "Art of Fighting 3 - The Path of the Warrior _ Art of Fighting - Ryuuko no Ken Gaiden",
  arabianm: "Arabian Magic (World)",
  area51: "Area 51",
  arkanoid: "Arkanoid (World)",
  armwar: "Armored Warriors (Euro 941024)",
  ashura: "Asura Blade - Sword of Dynasty",
  aso: "ASO - Armored Scrum Object",
  assault: "Assault",
  asterix: "Asterix (ver EAD)",
  asteroid: "Asteroids (rev 4)",
  athena: "Athena",
  avsp: "Alien vs. Predator (Euro 940520)",
  aztarac: "Aztarac",

  // ── B ──
  batrider: "Armed Police Batrider (Europe) (Fri Feb 13 1998)",
  batsugun: "Batsugun",
  baddudes: "Bad Dudes vs. Dragonninja (US)",
  bagman: "Bagman",
  bankp: "Bank Panic",
  baraduke: "Baraduke",
  batcir: "Battle Circuit (Europe 970319)",
  batman: "Batman",
  berzerk: "Berzerk (set 1)",
  bionicc: "Bionic Commando (Euro)",
  blazeon: "Blaze On (Japan)",
  blazstar: "Blazing Star",
  blockout: "Block Out (set 1)",
  bloodbro: "Blood Bros. (World_)",
  blzntrnd: "Blazing Tornado",
  bombjack: "Bomb Jack (set 1)",
  bombrman: "Bomber Man (Japan)",
  bonkadv: "B.C. Kid _ Bonk's Adventure _ Kyukyoku!! PC Genjin",
  bonzeadv: "Bonze Adventure (World)",
  btoads: "Battletoads",
  btime: "Burger Time (Data East set 1)",
  bublbobl: "Bubble Bobble (Japan, Ver 0.1)",
  bublbob2: "Bubble Symphony (Ver 2.5O 1994_10_05)",
  bucky: "Bucky O'Hare (ver EAB)",
  bzone: "Battle Zone (set 1)",

  // ── C ──
  cabal: "Cabal (World, Joystick)",
  cadash: "Cadash (World)",
  captaven: "Captain America and The Avengers (Asia Rev 1.4)",
  captcomm: "Captain Commando (World 911202)",
  cawing: "Carrier Air Wing (World 901012)",
  cclimber: "Crazy Climber (US)",
  centipede: "Centipede (revision 4)",
  circusc: "Circus Charlie (level select, set 1)",
  cninja: "Caveman Ninja (World ver 4)",
  columns: "Columns (World)",
  columns2: "Columns II_ The Voyage Through Time (Japan)",
  commando: "Commando (World)",
  contra: "Contra (US, set 1)",
  crimfght: "Crime Fighters (World 2 players)",
  crsword: "Crossed Swords",
  csclub: "Capcom Sports Club (Euro 971017)",
  cybots: "Cyberbots_ Fullmetal Madness (Euro 950424)",

  // ── D ──
  darius: "Darius (World, rev 2)",
  darius2: "Darius II (World, rev 2)",
  dariusg: "Darius Gaiden - Silver Hawk (Ver 2.5J 1994_09_19)",
  ddragon: "Double Dragon (Japan)",
  ddragon2: "Double Dragon II - The Revenge (World)",
  ddragon3: "Double Dragon 3 - The Rosetta Stone (US)",
  ddsom: "Dungeons _ Dragons_ Shadow over Mystara (Euro 960619)",
  ddtod: "Dungeons _ Dragons_ Tower of Doom (Euro 940412)",
  defender: "Defender (Red label)",
  digdug: "Dig Dug (rev 2)",
  digdug2: "Dig Dug II (New Ver.)",
  dimahoo: "Dimahoo (Euro 000121)",
  dino: "Cadillacs and Dinosaurs (World 930201)",
  dinorex: "Dino Rex (World)",
  djboy: "DJ Boy (World)",
  dkong: "Donkey Kong (US set 1)",
  dkongjr: "Donkey Kong Junior (US)",
  dkong3: "Donkey Kong 3 (US)",
  ddonpach: "DoDonPachi (International, Master Ver. 97_02_05)",
  donpachi: "DonPachi (US)",
  drmario: "Dr. Mario (PlayChoice-10)",
  dstlk: "Darkstalkers_ The Night Warriors (Euro 940705)",

  // ── E ──
  edf: "E.D.F._ Earth Defense Force",
  esprade: "ESP Ra.De. (International, Ver 98_04_22)",
  eswat: "E-Swat - Cyber Police (set 3, World) (FD1094 317-0130)",

  // ── F ──
  fantzone: "Fantasy Zone (Rev A, unprotected)",
  fatfury1: "Fatal Fury - King of Fighters _ Garou Densetsu - Shukumei no Tatakai",
  fatfury2: "Fatal Fury 2 _ Garou Densetsu 2 - Arata-naru Tatakai",
  fatfury3: "Fatal Fury 3 - Road to the Final Victory _ Garou Densetsu 3 - Haruka-naru Tatakai",
  ffight: "Final Fight (World, set 1)",
  fightfev: "Fight Fever (set 1)",
  firebarr: "Fire Barrel (Japan)",
  fireshrk: "Fire Shark",
  fixeight: "FixEight (Europe)",
  flipshot: "Battle Flip Shot",
  forgottn: "Forgotten Worlds (World)",
  frogger: "Frogger",
  funkyjet: "Funky Jet (World)",

  // ── G ──
  gaiden: "Ninja Gaiden (US)",
  galaga: "Galaga (Namco rev. B)",
  galaga88: "Galaga '88 (set 1)",
  galaxian: "Galaxian (Namco set 1)",
  galpanic: "Gals Panic (Unprotected)",
  garou: "Garou - Mark of the Wolves (set 1)",
  gauntlet: "Gauntlet (rev 14)",
  gberet: "Green Beret",
  ghouls: "Ghouls'n Ghosts (World)",
  gng: "Ghosts'n Goblins (World)",
  goldnaxe: "Golden Axe (set 6, US) (8751 317-123A)",
  gokuparo: "Gokujou Parodius - Kako no Eikuu wo Motomete (ver JAD)",
  gradius: "Gradius (Japan, ROM version)",
  gradius2: "Gradius II - GOFER no Yabou (World, set 1)",
  gradius3: "Gradius III (World, program code R)",
  grdians: "Guardians - Denjin Makai II",
  growl: "Growl (World)",
  gunbird: "Gunbird (World)",
  gunbird2: "Gunbird 2",
  gunforce: "Gunforce - Battle Fire Engulfed Terror Island (World)",
  gunsmoke: "Gun.Smoke (World 860306)",
  guwange: "Guwange (Japan, Master Ver. 99_06_24)",
  gwar: "Guerrilla War (US)",

  // ── H ──
  hangon: "Hang-On",
  hcastle: "Haunted Castle (version M)",
  hellfire: "Hellfire (2P set)",
  hook: "Hook (World)",

  // ── I ──
  ikari: "Ikari Warriors (US JAMMA)",
  ikari3: "Ikari III - The Rescue",
  imgfight: "Image Fight (Japan)",
  ironclad: "Ironclad (prototype)",
  invaders: "Space Invaders _ CV Version",

  // ── J ──
  jackal: "Jackal (World, 8-way Joystick)",
  jpark: "Jurassic Park (World)",
  jjsquawk: "J. J. Squawkers",
  jojo: "JoJo's Venture _ JoJo no Kimyou na Bouken (Europe 990108)",
  jojoba:
    "JoJo's Bizarre Adventure_ Heritage for the Future _ JoJo no Kimyou na Bouken_ Mirai e no Isan (Japan 990927)",
  joust: "Joust (White_Green label)",

  // ── K ──
  kabukikl: "Kabuki Klash - Far East of Eden _ Tengai Makyou - Shin Den",
  karatblz: "Karate Blazers (World, set 1)",
  karnov: "Karnov (US)",
  kinst: "Killer Instinct (v1.5d)",
  kinst2: "Killer Instinct 2 (v1.4)",
  klax: "Klax (set 1)",
  knights: "Knights of the Round (World 911127)",
  kof94: "The King of Fighters '94",
  kof95: "The King of Fighters '95 (set 1)",
  kof96: "The King of Fighters '96 (set 1)",
  kof97: "The King of Fighters '97 (set 1)",
  kof99: "The King of Fighters '99 - Millennium Battle (set 1)",
  kof2000: "The King of Fighters 2000",
  kof2001: "The King of Fighters 2001 (set 1)",
  kof2002: "The King of Fighters 2002",
  kof2003: "The King of Fighters 2003 (World _ US, MVS)",
  kotm: "King of the Monsters (set 1)",
  kotm2: "King of the Monsters 2 - The Next Thing",
  kungfum: "Kung-Fu Master",

  // ── L ──
  lastbld2: "The Last Blade 2 _ Bakumatsu Roman - Dai Ni Maku Gekka no Kenshi",
  lemmings: "Lemmings (US prototype)",
  liquidk: "Liquid Kids (World)",

  // ── M ──
  macross: "Super Spacefortress Macross _ Chou-Jikuu Yousai Macross",
  magdrop2: "Magical Drop II",
  magdrop3: "Magical Drop III",
  mappy: "Mappy (US)",
  marble: "Marble Madness (set 1)",
  matrim: "Matrimelee _ Shin Gouketsuji Ichizoku Toukon",
  megaman: "Mega Man_ The Power Battle (CPS1, Asia 951006)",
  megaman2: "Mega Man 2_ The Power Fighters (USA 960708)",
  mercs: "Mercs (World 900302)",
  metalb: "Metal Black (World)",
  mk: "Mortal Kombat (rev 5.0 T-Unit 03_19_93)",
  mk2: "Mortal Kombat II (rev L3.1)",
  mk3: "Mortal Kombat 3 (rev 2.1)",
  mooncrst: "Moon Cresta (Nichibutsu)",
  moonpatr: "Moon Patrol",
  moonwlk: "Michael Jackson's Moonwalker (World)",
  mooua: "Wild West C.O.W.-Boys of Moo Mesa (ver UA)",
  mpatrol: "Moon Patrol",
  mrdo: "Mr. Do!",
  mrdrillr: "Mr. Driller (US, DRI3_VER.A2)",
  msh: "Marvel Super Heroes (Euro 951024)",
  mshvsf: "Marvel Super Heroes Vs. Street Fighter (Euro 970625)",
  mslug: "Metal Slug - Super Vehicle-001",
  mslug2: "Metal Slug 2 - Super Vehicle-001_II",
  mslug3: "Metal Slug 3",
  mslug4: "Metal Slug 4",
  mslug5: "Metal Slug 5",
  mslugx: "Metal Slug X - Super Vehicle-001",
  mspacman: "Ms. Pac-Man",
  msword: "Magic Sword_ Heroic Fantasy (World 900725)",
  mvsc: "Marvel Vs. Capcom_ Clash of Super Heroes (Euro 980123)",

  // ── N ──
  nam1975: "NAM-1975",
  nbajam: "NBA Jam (rev 3.01 04_07_93)",
  nbajamte: "NBA Jam Tournament Edition (rev 4.0 03_23_94)",
  nbahangt: "NBA Hangtime (rev L1.1 04_16_96)",
  nbbatman: "Ninja Baseball Bat Man (US)",
  neobombe: "Neo Bomberman",
  nemesis: "Nemesis",
  ninjaw: "The Ninja Warriors (World)",
  ninjamas: "Ninja Master's - Haou Ninpou Chou",

  // ── O ──
  opwolf: "Operation Wolf (World, set 1)",
  ordyne: "Ordyne (Japan)",
  outrun: "Out Run (sitdown_upright, Rev B)",
  outzone: "Out Zone",
  overtop: "Over Top",

  // ── P ──
  pacman: "Pac-Man (Midway)",
  pacmania: "Pac-Mania",
  pang: "Pang (World)",
  pang3: "Pang! 3 (Euro 950601)",
  paperboy: "Paperboy (rev 3)",
  parodius: "Parodius DA! (World)",
  pbobbl2n: "Puzzle Bobble 2 _ Bust-A-Move Again (Neo-Geo)",
  pengo: "Pengo (set 1 rev c)",
  phoenix: "Phoenix (Amstar)",
  pingpong: "Konami's Ping-Pong",
  pipedrm: "Pipe Dream (World)",
  polepos: "Pole Position (Namco)",
  popeye: "Popeye (revision D)",
  pow: "P.O.W. - Prisoners of War (US version 1)",
  prehisle: "Prehistoric Isle in 1930 (World)",
  progear: "Progear (USA 010117)",
  pspikes2: "Power Spikes II (Crystal System)",
  pulstar: "Pulstar",
  punchout: "Punch-Out!! (Japan)",
  punisher: "The Punisher (World 930422)",
  puyopuy2: "Puyo Puyo 2 (Japan)",

  // ── Q ──
  qbert: "Q-bert",

  // ── R ──
  raiden: "Raiden (set 1)",
  raiden2: "Raiden II (US, set 1)",
  rainbow: "Rainbow Islands (World, Joystick)",
  rallyx: "Rally X (32k Ver.)",
  rampage: "Rampage (Rev 3, 8_27_86)",
  rastan: "Rastan (World Rev 1)",
  rbffspec: "Real Bout Fatal Fury Special _ Real Bout Garou Densetsu Special",
  rtype: "R-Type (World)",
  rtype2: "R-Type II",
  rtypeleo: "R-Type Leo (World)",
  robotron: "Robotron_ 2084 (Solid Blue label)",
  rygar: "Rygar (US set 1)",

  // ── S ──
  s1945: "Strikers 1945 (World)",
  s1945ii: "Strikers 1945 II",
  sailormn: "Pretty Soldier Sailor Moon (Ver. 95_03_22B, Europe)",
  salamand: "Salamander (version 1)",
  samsho: "Samurai Shodown _ Samurai Spirits",
  samsho3: "Samurai Shodown III _ Samurai Spirits - Zankurou Musouken (set 1)",
  samsho4: "Samurai Shodown IV - Amakusa's Revenge _ Samurai Spirits - Amakusa Kourin",
  samsho5: "Samurai Shodown V _ Samurai Spirits Zero (set 1)",
  samsh5sp: "Samurai Shodown V Special",
  savagere: "Savage Reign _ Fu'un Mokushiroku - Kakutou Sousei",
  scontra: "Super Contra",
  scramble: "Scramble",
  sdi: "SDI - Strategic Defense Initiative (Japan, old, System 16A, FD1089B 317-0027)",
  sengoku: "Sengoku _ Sengoku Denshou (set 1)",
  sengoku3: "Sengoku 3 _ Sengoku Densho 2001",
  sf2: "Street Fighter II - The World Warrior (World 910522)",
  sf2ce: "Street Fighter II'_ Champion Edition (World 920513)",
  sf2hf: "Street Fighter II'_ Hyper Fighting (World 921209)",
  ssf2: "Super Street Fighter II_ The New Challengers (World 930911)",
  ssf2t: "Super Street Fighter II Turbo (World 940223)",
  sfa: "Street Fighter Alpha_ Warriors' Dreams (Euro 950727)",
  sfa2: "Street Fighter Alpha 2 (Euro 960229)",
  sfa3: "Street Fighter Alpha 3 (Euro 980904)",
  sfiii3: "Street Fighter III 3rd Strike_ Fight for the Future (Japan 990512)",
  sgemf: "Super Gem Fighter Mini Mix _ Pocket Fighter (World 970904)",
  shinobi: "Shinobi (set 1, System 16A, FD1094 317-0050)",
  shocktro: "Shock Troopers (set 1)",
  simpsons: "The Simpsons (4 Players World, set 1)",
  slapfght: "Slap Fight (set 1)",
  slammast: "Saturday Night Slam Masters (World 930713)",
  snowbro2: "Snow Bros. 2 - With New Elves _ Otenki Paradise",
  snowbros: "Snow Bros. - Nick _ Tom (set 1)",
  snowbros2: "Snow Bros. 2 - With New Elves _ Otenki Paradise",
  socbrawl: "Soccer Brawl",
  solomon: "Solomon's Key (US)",
  sonicwi2: "Aero Fighters 2 _ Sonic Wings 2",
  sonicwi3: "Aero Fighters 3 _ Sonic Wings 3",
  spf2t: "Super Puzzle Fighter II Turbo (Super 960529)",
  spinmast: "Spin Master _ Miracle Adventure",
  ssideki: "Super Sidekicks _ Tokuten Ou",
  ssideki2: "Super Sidekicks 2 - The World Championship _ Tokuten Ou 2 - Real Fight Football",
  ssideki3: "Super Sidekicks 3 - The Next Glory _ Tokuten Ou 3 - Eikou e no Chousen",
  ssriders: "Sunset Riders (4 Players ver EAC)",
  strider: "Strider (World)",
  strider2: "Strider 2 (World 991213)",
  superman: "Superman (World 2 Players)",
  svc: "SNK vs. Capcom - SVC Chaos (MVS)",

  // ── T ──
  tengai: "Tengai (World)",
  tekken: "Tekken (World, TE2_VER.C)",
  tekken2: "Tekken 2 (US, TES3_VER.D)",
  tekken3: "Tekken 3 (Japan, TET1_VER.E1)",
  tempest: "Tempest (rev 3, Revised Hardware)",
  tetris: "Tetris (set 1)",
  tmnt: "Teenage Mutant Ninja Turtles (World 4 Players)",
  tmnt2: "Teenage Mutant Ninja Turtles - Turtles in Time (4 Players ver UAA)",
  toki: "Toki (World, set 1)",
  tophuntr: "Top Hunter - Roddy _ Cathy",
  tron: "Tron (8-way set 1)",
  truxton: "Truxton _ Tatsujin",
  truxton2: "Truxton II _ Tatsujin Oh",
  turfmast: "Neo Turf Masters _ Big Tournament Golf",
  twinbee: "TwinBee (ROM version)",
  twincobr: "Twin Cobra (World)",

  // ── U ──
  umk3: "Ultimate Mortal Kombat 3 (rev 1.2)",

  // ── V ──
  varth: "Varth_ Operation Thunderstorm (World 920714)",
  vendetta: "Vendetta (World, 4 Players, ver. T)",
  vsav: "Vampire Savior_ The Lord of Vampire (Euro 970519)",
  viewpoin: "Viewpoint",
  vigilant: "Vigilante (World, Rev E)",

  // ── W ──
  wakuwak7: "Waku Waku 7",
  wh1: "World Heroes (set 1)",
  wh2: "World Heroes 2",
  whp: "World Heroes Perfect",
  wjammers: "Windjammers _ Flying Power Disc",
  wof: "Warriors of Fate (World 921002)",

  // ── X ──
  xevious: "Xevious (Namco)",
  xexex: "Xexex (ver EAA)",
  xmen: "X-Men (4 Players ver UBB)",
  xmcota: "X-Men_ Children of the Atom (Euro 950331)",
  xmvsf: "X-Men Vs. Street Fighter (Euro 961004)",

  // ── Z ──
  zaxxon: "Zaxxon (set 1)",
  zedblade: "Zed Blade _ Operation Ragnarok",
  zerowing: "Zero Wing (2P set)",
  zupapa: "Zupapa!",

  // ── 추가 인기 게임 ──
  dstlk2: "Night Warriors_ Darkstalkers' Revenge (Euro 950316)",
  hsf2: "Hyper Street Fighter II_ The Anniversary Edition (Asia 040202)",
  rbff1: "Real Bout Fatal Fury _ Real Bout Garou Densetsu",
  lastduel: "Last Duel (US set 1)",
  lresort: "Last Resort",
  buriki: "Buriki One (set 1)",
  gaunt2: "Gauntlet II",
  doapp: "Dead Or Alive++ (Japan)",
};

const THUMBNAIL_CDN_BASE = "https://thumbnails.libretro.com/MAME/Named_Snaps/";
const ROM_FILENAME_EXTENSION_PATTERN = /\.\w+$/;

function getThumbnailBadgeLabel(core: string) {
  switch (core) {
    case "mame2003":
    case "mame2003_plus":
      return "MAME";
    case "fbneo":
      return "FB";
    default:
      return core.toUpperCase();
  }
}

function getThumbnailMonogram(title: string) {
  const compactTitle = title.replace(/\s+/g, "").trim();

  if (!compactTitle) {
    return "RT";
  }

  const words = title.trim().split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).slice(0, 2).toUpperCase();
  }

  return compactTitle.slice(0, 2).toUpperCase();
}

function truncateThumbnailLabel(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripRomExtension(filename: string) {
  return filename.replace(ROM_FILENAME_EXTENSION_PATTERN, "");
}

export function getFallbackGameThumbnailUrl(filename: string, core: string) {
  const title = parseRomName(filename, core);
  const monogram = getThumbnailMonogram(title);
  const badgeLabel = getThumbnailBadgeLabel(core);
  const footerLabel = truncateThumbnailLabel(stripRomExtension(filename).toUpperCase(), 12);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240" role="img" aria-label="${escapeSvgText(title)}">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#08111f" />
          <stop offset="60%" stop-color="#13253f" />
          <stop offset="100%" stop-color="#2d1a0c" />
        </linearGradient>
        <radialGradient id="glowA" cx="0.18" cy="0.2" r="0.9">
          <stop offset="0%" stop-color="#36cfff" stop-opacity="0.68" />
          <stop offset="100%" stop-color="#36cfff" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="glowB" cx="0.85" cy="0.82" r="0.75">
          <stop offset="0%" stop-color="#ff9d42" stop-opacity="0.6" />
          <stop offset="100%" stop-color="#ff9d42" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="240" rx="28" fill="url(#bg)" />
      <rect width="320" height="240" rx="28" fill="url(#glowA)" />
      <rect width="320" height="240" rx="28" fill="url(#glowB)" />
      <rect x="16" y="16" width="288" height="208" rx="22" fill="none" stroke="rgba(255,255,255,0.16)" />
      <rect x="28" y="26" width="72" height="28" rx="14" fill="rgba(4,10,18,0.56)" stroke="rgba(255,255,255,0.18)" />
      <text x="64" y="45" fill="#e8f4ff" font-family="Pretendard, Arial, sans-serif" font-size="16" font-weight="700" text-anchor="middle">${escapeSvgText(badgeLabel)}</text>
      <text x="160" y="138" fill="#f8fafc" font-family="Pretendard, Arial, sans-serif" font-size="92" font-weight="800" letter-spacing="-4" text-anchor="middle">${escapeSvgText(monogram)}</text>
      <text x="28" y="188" fill="#f8fafc" font-family="Pretendard, Arial, sans-serif" font-size="24" font-weight="700">${escapeSvgText(truncateThumbnailLabel(title, 16))}</text>
      <text x="28" y="212" fill="rgba(232,244,255,0.72)" font-family="monospace" font-size="16">${escapeSvgText(footerLabel)}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

/**
 * ROM shortcode에 해당하는 썸네일 이미지 URL을 반환.
 * 매핑에 없으면 null.
 */
export function getGameThumbnailUrl(filename: string, core: string): string | null {
  if (!isArcadeCore(core)) {
    return null;
  }

  const englishName = resolveArcadeLookupValue(filename, MAME_THUMBNAIL_NAMES);
  if (!englishName) return null;

  // URL-encode the name (spaces → %20, etc.)
  const encoded = encodeURIComponent(englishName + ".png")
    // encodeURIComponent encodes too aggressively for URLs;
    // restore characters that the CDN expects unencoded
    .replace(/%20/g, "%20"); // keep %20 as-is

  return THUMBNAIL_CDN_BASE + encoded;
}
