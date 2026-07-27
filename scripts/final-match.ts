/**
 * MAME 2003+ XML에서 파싱된 데이터로 FBNeo 누락 게임의 MAME 영어 이름 찾기
 */
import * as fs from "fs";

// MAME XML에서 파싱된 전체 매핑 (parse-mame-xml.ts에서 생성)
const MAME_MAP: Record<string, string> = JSON.parse(fs.readFileSync("scripts/mame-names.json", "utf-8"));

const CLONE_SUFFIX_PATTERN = /(?:[_-]?[a-z])$/;
const MAX_CLONE_STEPS = 2;

function stripExt(fn: string) { return fn.replace(/\.\w+$/, ""); }

function resolveLookup(lookup: Record<string, unknown>, filename: string): string | null {
  const base = stripExt(filename).toLowerCase();
  if (Object.prototype.hasOwnProperty.call(lookup, base)) return base;
  let candidate = base;
  for (let step = 0; step < MAX_CLONE_STEPS; step++) {
    const last = candidate.at(-1);
    const prev = candidate.at(-2);
    if (last && prev === last) break;
    const next = candidate.replace(CLONE_SUFFIX_PATTERN, "");
    if (next === candidate || next.length < 3) break;
    candidate = next;
    if (Object.prototype.hasOwnProperty.call(lookup, candidate)) return candidate;
  }
  return null;
}

// 332개 누락 게임 (from audit-thumbnails output)
const MISSING = [
  // CPS1
  "dynwar","kod","mbombrd","mtwins","nemo","pnickj","unsquad","willow",
  // CPS2
  "ecofghtr","gigawing","mmatrix","mpang","nwarr","pzloop2","ringdest","sfz2al","vhunt2","vsav2",
  // CPS3
  "redearth","sfiii","sfiii2",
  // fbneo
  "actfancr","agallet","airwolf","aligator","amidar","aquajack","arknoid2","armorcar","armwrest","astdelux",
  "astorm","atetris","aurail","avengers","avspirit","badlands","bbros","bgaregga","biomtoy","blktiger",
  "blstroid","blswhstl","bnj","bogeyman","bongo","boogwing","brkthru","bubbles","buckrog","bwidow",
  "carnival","ccastles","centiped","chaknpop","chasehq","chinagat","choplift","citycon","ckong","ckongpt2",
  "cleopatr","congo","cotton","ctribe","cyvern","darkseal","dassault","dbreed","dbz","dbz2",
  "ddcrew2","ddux","deadconx","docastle","dondokod","drgnbstr","drtoppel","dsaber","dsoccr94","dynagear",
  "edrandy","elevator","elvactr","enduror","eprom","exedexes","fantzn2","fastlane","flicky","foodf",
  "ga2","gaia","galivan","galmedes","gangwars","gaplus","gaunt22p","gauntlet2p","gblchmp","geebeeg",
  "gground","ghostb","gijoe","gnbarich","godzilla","gogomile","gstream","gtmr2","gunlock","gunnail",
  "gyruss","hbarrel","heatbrl","hharry","hitice","hopmappy","horekid","horizon","hvysmsh","inthunt",
  "jailbrek","jedi","journey","junglek","junofrst","kangaroo","kchamp","kick","kicker","kingball",
  "krull","landmakr","ldrun","ldrun2","ldrun3","ldrun4","lethalth","liblrabl","lightbr","lizwiz",
  "lkage","llander","locomotn","loderndf","loht","lwings","macross2","mainevt2p","mario","mazinger",
  "metamrph","metmqstr","mgcrystl","mhavoc","mikie","milliped","missile","moomesa","mrgoemon","mwalk",
  "mystwarr","narc","nibbler","ninjak","ninjakd2","ninjakun","nitedrvr","nitrobal","nob","nrallyx",
  "nslashers","nspirit","osman","outfxies","pacland","pbobble3","penbros","pitfight","pleiads","pooyan",
  "punkshot2","puyo","puzzloop","qix","quartet2","radm","rambo3","rampart2p","rbisland","renegade",
  "ringking","riotcity","robocop","robocop2","rocnrope","rohga","rthun2","rthunder","rushatck","sabotenb",
  "scobra","seawolft","seganinj","seicross","sf","shadfrce","shangon","sharrier","shdancer","shollow",
  "sidearms","simpsons2p","sinistar","skykid","slapshot","slyspy","smashtv","solrwarr","sonic","sonicfgt",
  "sonson","spacedx","spcinv95","spidman","splatter","spnchout","spyhunt","spyhunt2","srumbler","ssridersubc",
  "starwars","stdragon","stmblade","superpac","sxevious","szaxxon","tankfrce","tapper","tetrisp2","tgm2p",
  "thndrbld","thundfox","tigeroad","timeplt","tmnt22pu","tnzs","todruaga","toobin","totcarn","trackfld",
  "trojan","tumblep","twocrude","uccops","upndown","valkyrie","vball","vendetta2pu","viostorm","volfied",
  "vulcan","wb3","wbml","wboy","wildfang","wizdfire","wwfsstar","wwfwfest","xmen2pa","xmultipl",
  "xybots","yiear","zookeep",
  // neogeo
  "alpham2","bangbead","bjourney","breakrev","bstars","bstars2","burningf","crswd2bl","doubledr","eightman",
  "ganryu","gpilots","irrmaze","lbowling","maglord","mutnat","ncombat","ncommand","neodrift","neogeo",
  "neomrdo","nitd","preisle2","roboarmy","rotd","samsh5fe","sdodgeb","sengoku2","shocktr2","ssideki4",
  "superspy","trally","twinspri",
  // toaplan_cave_stg
  "akatana","alcon","ddp3","ddpdfk","ddpsdoj","deathsml","dfkbl","dogyuun","dsmbl","espgal",
  "espgal2","feversos","fshark","futari15","futaribl","grindstm","ibara","ibarablk","ket","mmpork",
  "mushisam","pinkswts","tigerh","twinhawk","vimana",
];

console.log("=== Finding MAME English Names for Missing FBNeo Games ===\n");

const found: [string, string][] = [];
const notFound: string[] = [];

for (const game of MISSING) {
  const key = resolveLookup(MAME_MAP, game + ".zip");
  if (key) {
    // Check if this is a clone - if parent has a different name, prefer parent
    found.push([game, MAME_MAP[key]]);
  } else {
    notFound.push(game);
  }
}

console.log(`Found: ${found.length}`);
console.log(`Not found in MAME XML: ${notFound.length}\n`);

if (notFound.length > 0) {
  console.log("=== Not found (may be FBNeo-only titles) ===");
  for (const g of notFound) {
    console.log(`  ${g}`);
  }
  console.log();
}

console.log("=== New MAME_THUMBNAIL_NAMES entries (copy to game-thumbnails.ts) ===\n");

// 알파벳순 정렬된 출력
for (const [sc, desc] of found.sort((a, b) => a[0].localeCompare(b[0]))) {
  // 이스케이프 처리
  const escapedDesc = desc.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  console.log(`  "${sc}": "${escapedDesc}",`);
}

console.log(`\n총 ${found.length}개 신규 매핑`);
