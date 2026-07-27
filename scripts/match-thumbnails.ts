/**
 * libretro-thumbnails MAME Named_Snaps 전체 파일 목록을 가져와서
 * FBNeo ROM 숏코드와 자동 매칭하는 스크립트
 */
import * as https from "https";

const CLONE_SUFFIX_PATTERN = /(?:[_-]?[a-z])$/;
const MAX_CLONE_STEPS = 2;

function stripExt(fn: string) { return fn.replace(/\.\w+$/, ""); }

function resolveLookupKey(lookup: Record<string, unknown>, filename: string): string | null {
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

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "Accept": "application/vnd.github+json", "User-Agent": "RTCADE" } }, (res) => {
      let data = "";
      res.on("data", (chunk: Buffer) => data += chunk.toString());
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

async function fetchAllMameSnaps(): Promise<string[]> {
  const allNames: string[] = [];
  let page = 1;
  while (true) {
    const url = `https://api.github.com/repos/libretro-thumbnails/MAME/contents/Named_Snaps?per_page=100&page=${page}`;
    console.log(`  Fetching page ${page}...`);
    const data = await httpGet(url);
    let items: any[];
    try {
      items = JSON.parse(data);
    } catch {
      // Check for rate limit
      if (data.includes("API rate limit")) {
        console.error("  Rate limited! " + data.slice(0, 200));
        break;
      }
      break;
    }
    if (!Array.isArray(items)) {
      if (data.includes("message")) console.error("  Error: " + data.slice(0, 200));
      break;
    }
    if (items.length === 0) break;
    for (const item of items) {
      if (item.type === "file" && item.name.endsWith(".png")) {
        allNames.push(item.name.replace(".png", ""));
      }
    }
    if (items.length < 100) break;
    page++;
    // Small delay between pages to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }
  return allNames;
}

// FBNEO 게임 목록
const FBNEO: Record<string, string[]> = {
  cps1: ["1941","3wonders","captcomm","cawing","dino","dynwar","ffight","forgottn","ghouls","knights","kod","mbombrd","megaman","mercs","msword","mtwins","nemo","pang3","pnickj","punisher","sf2","sf2ce","sf2hf","slammast","strider","unsquad","varth","willow","wof"],
  cps2: ["1944","19xx","armwar","avsp","batcir","csclub","cybots","ddsom","ddtod","dimahoo","dstlk","ecofghtr","gigawing","hsf2","megaman2","mmatrix","mpang","msh","mshvsf","mvsc","nwarr","progear","pzloop2","ringdest","sfa","sfa2","sfa3","sfz2al","sgemf","spf2t","ssf2","ssf2t","vhunt2","vsav","vsav2","xmcota","xmvsf"],
  cps3: ["jojo","jojoba","redearth","sfiii","sfiii2","sfiii3"],
  fbneo: ["1942","1943","1943kai","64street","aburner2","actfancr","aerofgt","agallet","airwolf","ajax","aliens","aliensyn","aligator","altbeast","amidar","aquajack","arkanoid","arknoid2","armorcar","armwrest","astdelux","asterix","asteroid","astorm","atetris","aurail","avengers","avspirit","baddudes","badlands","bankp","batman","batrider","bbros","berzerk","bgaregga","biomtoy","bionicc","blktiger","bloodbro","blstroid","blswhstl","bnj","bogeyman","bombjack","bongo","boogwing","brkthru","btime","btoads","bubbles","bublbob2","bublbobl","buckrog","bucky","bwidow","bzone","cabal","captaven","carnival","ccastles","cclimber","centiped","chaknpop","chasehq","chinagat","choplift","circusc","citycon","ckong","ckongpt2","cleopatr","columns","commando","congo","contra","cotton","crimfght","ctribe","cyvern","darkseal","dassault","dbreed","dbz","dbz2","ddcrew2","ddragon","ddragon2","ddragon3","ddux","deadconx","defender","digdug","digdug2","dkong","dkong3","dkongjr","dmnfrnt","docastle","dondokod","drgnbstr","drtoppel","dsaber","dsoccr94","dynagear","edrandy","elevator","elvactr","enduror","eprom","eswat","exedexes","fantzn2","fantzone","fastlane","flicky","foodf","frogger","funkyjet","ga2","gaia","gaiden","galaga","galaga88","galaxian","galivan","galmedes","gangwars","gaplus","gaunt22p","gauntlet2p","gblchmp","geebeeg","gground","ghostb","gijoe","gnbarich","gng","godzilla","gogomile","goldnaxe","gradius3","grdians","growl","gstream","gtmr2","gunbird2","gunforce","gunlock","gunnail","gunsmoke","gyruss","hangon","hbarrel","hcastle","heatbrl","hharry","hitice","hook","hopmappy","horekid","horizon","hvysmsh","ikari","ikari3","imgfight","inthunt","invaders","jackal","jailbrek","jedi","journey","joust","junglek","junofrst","kangaroo","karnov","kchamp","kick","kicker","kingball","klax","krull","kungfum","landmakr","ldrun","ldrun2","ldrun3","ldrun4","lethalth","liblrabl","lightbr","liquidk","lizwiz","lkage","llander","locomotn","loderndf","loht","lwings","macross","macross2","macrossp","mainevt2p","mario","mazinger","metamrph","metmqstr","mgcrystl","mhavoc","mikie","milliped","missile","moomesa","mpatrol","mrdo","mrgoemon","mspacman","mwalk","mystwarr","narc","nbajamte","nbbatman","nemesis","nibbler","ninjak","ninjakd2","ninjakun","nitedrvr","nitrobal","nob","nrallyx","nslashers","nspirit","osman","outfxies","outrun","pacland","pacman","parodius","pbobble3","penbros","pengo","phoenix","pipedrm","pitfight","pleiads","pooyan","popeye","pow","punchout","punkshot2","puyo","puyopuy2","puzzloop","qbert","qix","quartet2","radm","raiden2","rallyx","rambo3","rampage","rampart2p","rastan","rbisland","renegade","ringking","riotcity","robocop","robocop2","robotron","rocnrope","rohga","rthun2","rthunder","rushatck","rygar","s1945","s1945ii","s1945iii","sabotenb","sailormn","salamand","scobra","scontra","scramble","seawolft","seganinj","seicross","sf","shadfrce","shangon","sharrier","shdancer","shinobi","shollow","sidearms","simpsons2p","sinistar","skykid","slapshot","slyspy","smashtv","snowbros","solomon","solrwarr","sonic","sonicfgt","sonson","spacedx","spcinv95","spidman","splatter","spnchout","spyhunt","spyhunt2","srumbler","ssridersubc","starwars","stdragon","stmblade","superman","superpac","sxevious","szaxxon","tankfrce","tapper","tempest","tengai","tetrisp2","tgm2p","thndrbld","thundfox","tigeroad","timeplt","tmnt22pu","tmnt2pj","tnzs","todruaga","toki","toobin","totcarn","trackfld","trojan","tron","tumblep","twocrude","uccops","umk3","upndown","valkyrie","vball","vendetta2pu","viostorm","volfied","vulcan","wb3","wbml","wboy","wildfang","wizdfire","wwfsstar","wwfwfest","xexex","xmen2pa","xmultipl","xybots","yiear","zookeep"],
  neogeo: ["2020bb","3countb","alpham2","androdun","aof","aof2","aof3","bangbead","bjourney","blazstar","breakrev","bstars","bstars2","burningf","crswd2bl","crsword","doubledr","eightman","fatfursp","fatfury1","fatfury3","ganryu","garou","goalx3","gpilots","irrmaze","kabukikl","karnovr","kof2000","kof2001","kof2002","kof2003","kof94","kof95","kof96","kof97","kof98","kof99","kotm","kotm2","lastblad","lastbld2","lbowling","lresort","magdrop2","magdrop3","maglord","matrim","mslug","mslug3","mslug4","mslug5","mslugx","mutnat","nam1975","ncombat","ncommand","neobombe","neodrift","neogeo","neomrdo","nitd","overtop","panicbom","pbobbl2n","pbobblen","preisle2","pulstar","rbff1","rbff2","rbffspec","roboarmy","rotd","samsh5fe","samsho","samsho2","samsho3","samsho4","sdodgeb","sengoku","sengoku2","sengoku3","shocktr2","shocktro","socbrawl","sonicwi2","sonicwi3","spinmast","ssideki4","strhoop","superspy","svc","tophuntr","trally","turfmast","twinspri","viewpoin","wakuwak7","wjammers","zedblade","zupapa"],
  toaplan_cave_stg: ["akatana","alcon","batsugun","ddonpach","ddp3","ddpdfk","ddpsdoj","deathsml","dfkbl","dogyuun","donpachi","dsmbl","espgal","espgal2","esprade","feversos","fireshrk","fixeight","fshark","futari15","futaribl","grindstm","guwange","hellfire","ibara","ibarablk","ket","mmpork","mushisam","outzone","pinkswts","tigerh","truxton","truxton2","twincobr","twinhawk","vimana","zerowing"],
};

async function main() {
  console.log("Fetching MAME Named_Snaps file list from GitHub...");
  const allSnaps = await fetchAllMameSnaps();
  console.log(`Fetched ${allSnaps.length} thumbnail names\n`);

  // Build a lookup: lowercase snapshot name → original name
  const snapLookup = new Map<string, string>();
  for (const name of allSnaps) {
    snapLookup.set(name.toLowerCase(), name);
  }

  // For each missing game, search for a match
  console.log("=== MAME Thumbnail Name Matching ===\n");

  const matched: Record<string, string> = {};
  const unmatched: string[] = [];

  for (const [category, games] of Object.entries(FBNEO)) {
    for (const game of games) {
      // Try exact match first (game name appears verbatim in snapshot name)
      let found: string | null = null;

      for (const [lower, original] of snapLookup) {
        // Strategy 1: snapshot name starts with the game's title
        // Strategy 2: contains the ROM shortcode
        // Strategy 3: normalized comparison
        const normalized = lower.replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
        const words = normalized.split(" ");

        // Check if the ROM shortcode appears as a word
        if (words.includes(game.toLowerCase())) {
          found = original;
          break;
        }
      }

      // Try partial matching: snapshot name contains ROM shortcode as substring
      if (!found) {
        for (const [lower, original] of snapLookup) {
          if (lower.includes(game.toLowerCase())) {
            found = original;
            break;
          }
        }
      }

      if (found) {
        matched[game] = found;
      } else {
        unmatched.push(game);
      }
    }
  }

  console.log(`Matched: ${Object.keys(matched).length}`);
  console.log(`Unmatched: ${unmatched.length}\n`);

  if (unmatched.length > 0) {
    console.log("=== Unmatched games ===");
    console.log(unmatched.join("\n"));
  }

  // Filter to only show NEW mappings (not already in MAME_THUMBNAIL_NAMES)
  console.log(`\n=== New MAME_THUMBNAIL_NAMES entries (${Object.keys(matched).length} games) ===`);
  for (const [game, name] of Object.entries(matched).sort()) {
    console.log(`  ${game}: "${name}",`);
  }
}

main().catch(console.error);
