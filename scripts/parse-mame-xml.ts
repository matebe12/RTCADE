/**
 * MAME 2003-Plus XML을 파싱해 ROM 숏코드 → 영어 이름 매핑 생성
 * libretro CDN에서 사용할 MAME_THUMBNAIL_NAMES 추가 데이터 생성
 */
import * as https from "https";
import * as fs from "fs";

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "RTCADE" } }, (res) => {
      let data = "";
      res.on("data", (chunk: Buffer) => data += chunk.toString());
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

const XML_URL = "https://raw.githubusercontent.com/libretro/libretro-database/master/metadat/mame/MAME%202003-Plus%20XML.xml";

// 기존 MAME_THUMBNAIL_NAMES (이미 매핑된 것들은 제외)
const EXISTING = new Set([
  "19xx","1941","1942","1943","1943kai","1944","1945kiii","2020bb","3countb","3wonders","64street","88games",
  "acrobatm","aburner2","aerofgt","airbustr","airduel","ajax","aliens","aliensyn","altbeast","androdun","aodk",
  "aof","aof2","aof3","arabianm","area51","arkanoid","armwar","ashura","aso","assault","asterix","asteroid","athena",
  "avsp","aztarac","batrider","batsugun","baddudes","bagman","bankp","baraduke","batcir","batman","berzerk",
  "bionicc","blazeon","blazstar","blockout","bloodbro","blzntrnd","bombjack","bombrman","bonkadv","bonzeadv",
  "btoads","btime","bublbobl","bublbob2","bucky","bzone","cabal","cadash","captaven","captcomm","cawing",
  "cclimber","centiped","circusc","cninja","columns","columns2","commando","contra","crimfght","crsword",
  "csclub","cybots","darius","darius2","dariusg","ddragon","ddragon2","ddragon3","ddsom","ddtod","defender",
  "digdug","digdug2","dimahoo","dino","dinorex","djboy","dkong","dkongjr","dkong3","ddonpach","donpachi",
  "drmario","dstlk","edf","esprade","eswat","fantzone","fatfury1","fatfury2","fatfury3","ffight","fightfev",
  "firebarr","fireshrk","fixeight","flipshot","forgottn","frogger","funkyjet","gaiden","galaga","galaga88",
  "galaxian","galpanic","garou","gauntlet","gberet","galaxyfg","ghouls","gng","goalx3","goldnaxe","gokuparo",
  "gowcaizr","gradius","gradius2","gradius3","grdians","growl","gunbird","gunbird2","gunforce","gunsmoke",
  "guwange","gwar","hangon","hcastle","hellfire","hook","ikari","ikari3","imgfight","ironclad","invaders",
  "jackal","jpark","jjsquawk","jojo","jojoba","joust","kabukikl","karatblz","karnov","kinst","kinst2","klax",
  "knights","kof94","kof95","kof96","kof97","kof99","kof2000","kof2001","kof2002","kof2003","kizuna","kotm",
  "kotm2","kungfum","lastbld2","lemmings","liquidk","macross","magdrop2","magdrop3","mappy","marble","matrim",
  "megaman","megaman2","mercs","metalb","mk","mk2","mk3","mooncrst","moonpatr","moonwlk","mooua","mpatrol",
  "mrdo","mrdrillr","msh","mshvsf","mslug","mslug2","mslug3","mslug4","mslug5","mslugx","mspacman","msword",
  "mvsc","nam1975","nbajam","nbajamte","nbahangt","nbbatman","neobombe","nemesis","ninjaw","ninjamas",
  "opwolf","ordyne","outrun","outzone","overtop","pacman","pacmania","pang","pang3","paperboy","panicbom",
  "parodius","pbobbl2n","pengo","phoenix","pingpong","pipedrm","polepos","popeye","pow","prehisle","progear",
  "pspikes2","pulstar","punchout","punisher","puyopuy2","qbert","raiden","raiden2","rainbow","rallyx","rampage",
  "rastan","rbffspec","rtype","rtype2","rtypeleo","robotron","rygar","s1945","s1945ii","sailormn","salamand",
  "samsho","samsho3","samsho4","samsho5","samsh5sp","savagere","scontra","scramble","sdi","sengoku","sengoku3",
  "sf2","sf2ce","sf2hf","ssf2","ssf2t","sfa","sfa2","sfa3","sfiii3","sgemf","shinobi","shocktro","simpsons",
  "slapfght","slammast","snowbro2","snowbros","snowbros2","socbrawl","solomon","sonicwi2","sonicwi3","spf2t",
  "spinmast","ssideki","ssideki2","ssideki3","ssriders","strider","strider2","strhoop","superman","suprmrio",
  "svc","tengai","tekken","tekken2","tekken3","tempest","tetris","tmnt","tmnt2","toki","tophuntr","tron",
  "truxton","truxton2","turfmast","twinbee","twincobr","umk3","varth","vendetta","vsav","viewpoin","vigilant",
  "wakuwak7","wh1","wh2","whp","wjammers","wof","xevious","xexex","xmen","xmcota","xmvsf","zaxxon","zedblade",
  "zerowing","zupapa","dstlk2","hsf2","rbff1","lastduel","lresort","buriki","gaunt2","doapp",
  // Also VERIFIED_THUMBNAIL_URLS
  "dmnfrnt","fatfursp","kof98","lastblad","pbobblen","rbff2","s1945iii","samsho2","suprmrio","wboy3",
]);

async function main() {
  console.log("Downloading MAME 2003-Plus XML...");
  const xml = await httpGet(XML_URL);
  console.log(`Downloaded ${xml.length} bytes\n`);

  // Parse game entries
  const gameRegex = /<game name="([^"]+)"[^>]*>[\s\S]*?<description>([^<]+)<\/description>/g;
  const mameMap: Record<string, string> = {};

  let match;
  while ((match = gameRegex.exec(xml)) !== null) {
    const shortcode = match[1].toLowerCase();
    const description = match[2];
    mameMap[shortcode] = description;
  }

  console.log(`Parsed ${Object.keys(mameMap).length} game entries\n`);

  // New entries not already in MAME_THUMBNAIL_NAMES
  const newEntries: [string, string][] = [];
  for (const [sc, desc] of Object.entries(mameMap)) {
    if (!EXISTING.has(sc)) {
      newEntries.push([sc, desc]);
    }
  }

  console.log(`New entries (not in existing MAME_THUMBNAIL_NAMES): ${newEntries.length}`);
  console.log(`\n=== Copy-paste into MAME_THUMBNAIL_NAMES ===\n`);

  for (const [sc, desc] of newEntries.sort()) {
    console.log(`  "${sc}": "${desc.replace(/"/g, '\\"')}",`);
  }

  // Save as JSON for later processing
  fs.writeFileSync("scripts/mame-names.json", JSON.stringify(mameMap, null, 2));
  console.log(`\n\nSaved full MAME name map to scripts/mame-names.json`);
}

main().catch(console.error);
