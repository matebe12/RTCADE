import * as fs from "fs";

const content = fs.readFileSync("apps/web/src/lib/game-names.ts", "utf8");

// FBNeo 505 games
const GAMES = [
  "1941","3wonders","captcomm","cawing","dino","dynwar","ffight","forgottn","ghouls","knights",
  "kod","mbombrd","megaman","mercs","msword","mtwins","nemo","pang3","pnickj","punisher",
  "sf2","sf2ce","sf2hf","slammast","strider","unsquad","varth","willow","wof",
  "1944","19xx","armwar","avsp","batcir","csclub","cybots","ddsom","ddtod","dimahoo",
  "dstlk","ecofghtr","gigawing","hsf2","megaman2","mmatrix","mpang","msh","mshvsf","mvsc",
  "nwarr","progear","pzloop2","ringdest","sfa","sfa2","sfa3","sfz2al","sgemf","spf2t",
  "ssf2","ssf2t","vhunt2","vsav","vsav2","xmcota","xmvsf",
  "jojo","jojoba","redearth","sfiii","sfiii2","sfiii3",
  "akatana","alcon","batsugun","ddonpach","ddp3","dogyuun","donpachi","espgal","esprade",
  "feversos","fireshrk","fixeight","fshark","grindstm","guwange","hellfire","ibara","ket",
  "mmpork","mushisam","outzone","pinkswts","tigerh","truxton","truxton2","twincobr","twinhawk",
  "vimana","zerowing",
  "alpham2","bangbead","bjourney","breakrev","bstars","bstars2","burningf","crswd2bl","doubledr",
  "eightman","ganryu","gpilots","irrmaze","karnovr","lbowling","maglord","mutnat","ncombat",
  "ncommand","neodrift","neomrdo","nitd","preisle2","roboarmy","rotd","sdodgeb","sengoku2",
  "shocktr2","ssideki4","superspy","trally","twinspri",
  "2020bb","3countb","aof","aof2","aof3","androdun","blazstar","crsword","fatfursp","fatfury1",
  "fatfury3","garou","goalx3","kabukikl","kof2000","kof2001","kof2002","kof2003","kof94",
  "kof95","kof96","kof97","kof98","kof99","kotm","kotm2","lastblad","lastbld2","lresort",
  "magdrop2","magdrop3","matrim","mslug","mslug3","mslug4","mslug5","mslugx","nam1975",
  "neobombe","overtop","panicbom","pbobbl2n","pbobblen","pulstar","rbff1","rbff2","rbffspec",
  "samsho","samsho2","samsho3","samsho4","sengoku","sengoku3","shocktro","socbrawl","sonicwi2",
  "sonicwi3","spinmast","strhoop","svc","tophuntr","turfmast","viewpoin","wakuwak7","wjammers",
  "zedblade","zupapa",
];

const missing: string[] = [];
for (const g of GAMES) {
  // TS object keys without quotes: `key:` or `key :`
  // TS object keys with quotes: `"key":` or `"key" :`
  // We also need to match exact word boundaries to avoid partial matches
  const patterns = [
    new RegExp("\\b" + g + "\\s*:\\s*\"", "i"),    // unquoted key
    new RegExp("\"" + g + "\"\\s*:\\s*\"", "i"),     // quoted key
    new RegExp("^\\s*" + g + "\\s*:", "im"),         // start of line
  ];
  let found = false;
  for (const regex of patterns) {
    if (regex.test(content)) { found = true; break; }
  }
  if (!found) missing.push(g);
}

console.log("Missing Korean names (" + missing.length + "):");
if (missing.length === 0) {
  console.log("  All covered!");
} else {
  for (let i = 0; i < missing.length; i += 5) {
    console.log("  " + missing.slice(i, i + 5).join(", "));
  }
}
