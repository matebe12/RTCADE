/**
 * FBNeo 403개 누락 게임 카테고리 일괄 생성
 */
import * as fs from "fs";

const content = fs.readFileSync("apps/web/src/lib/game-names.ts", "utf8");
const start = content.indexOf("const GAME_CATEGORIES");
const end = content.indexOf("const ARCADE_CORES");
const section = content.slice(start, end);

// 모든 FBNeo 게임
const ALL = [
  '1941','3wonders','captcomm','cawing','dino','dynwar','ffight','forgottn','ghouls','knights',
  'kod','mbombrd','megaman','mercs','msword','mtwins','nemo','pang3','pnickj','punisher',
  'sf2','sf2ce','sf2hf','slammast','strider','unsquad','varth','willow','wof',
  '1944','19xx','armwar','avsp','batcir','csclub','cybots','ddsom','ddtod','dimahoo',
  'dstlk','ecofghtr','gigawing','hsf2','megaman2','mmatrix','mpang','msh','mshvsf','mvsc',
  'nwarr','progear','pzloop2','ringdest','sfa','sfa2','sfa3','sfz2al','sgemf','spf2t',
  'ssf2','ssf2t','vhunt2','vsav','vsav2','xmcota','xmvsf',
  'jojo','jojoba','redearth','sfiii','sfiii2','sfiii3',
  '2020bb','3countb','alpham2','androdun','aof','aof2','aof3','bangbead','bjourney',
  'blazstar','breakrev','bstars','bstars2','burningf','crswd2bl','crsword','doubledr',
  'eightman','fatfursp','fatfury1','fatfury3','ganryu','garou','goalx3','gpilots',
  'irrmaze','kabukikl','karnovr','kof2000','kof2001','kof2002','kof2003','kof94',
  'kof95','kof96','kof97','kof98','kof99','kotm','kotm2','lastblad','lastbld2',
  'lbowling','lresort','magdrop2','magdrop3','maglord','matrim','mslug','mslug3',
  'mslug4','mslug5','mslugx','mutnat','nam1975','ncombat','ncommand','neobombe',
  'neodrift','neogeo','neomrdo','nitd','overtop','panicbom','pbobbl2n','pbobblen',
  'preisle2','pulstar','rbff1','rbff2','rbffspec','roboarmy','rotd','samsh5fe',
  'samsho','samsho2','samsho3','samsho4','sdodgeb','sengoku','sengoku2','sengoku3',
  'shocktr2','shocktro','socbrawl','sonicwi2','sonicwi3','spinmast','ssideki4',
  'strhoop','superspy','svc','tophuntr','trally','turfmast','twinspri','viewpoin',
  'wakuwak7','wjammers','zedblade','zupapa',
  'akatana','alcon','batsugun','ddonpach','ddp3','ddpdfk','ddpsdoj','deathsml','dfkbl',
  'dogyuun','donpachi','dsmbl','espgal','espgal2','esprade','feversos','fireshrk',
  'fixeight','fshark','futari15','futaribl','grindstm','guwange','hellfire','ibara',
  'ibarablk','ket','mmpork','mushisam','outzone','pinkswts','tigerh','truxton',
  'truxton2','twincobr','twinhawk','vimana','zerowing',
  '1942','1943','1943kai','64street','aburner2','actfancr','aerofgt','agallet','airwolf',
  'ajax','aliens','aliensyn','aligator','altbeast','amidar','aquajack','arkanoid','arknoid2',
  'armorcar','armwrest','astdelux','asterix','asteroid','astorm','atetris','aurail','avengers',
  'avspirit','baddudes','badlands','bankp','batman','batrider','bbros','berzerk','bgaregga',
  'biomtoy','bionicc','blktiger','bloodbro','blstroid','blswhstl','bnj','bogeyman','bombjack',
  'bongo','boogwing','brkthru','btime','btoads','bubbles','bublbob2','bublbobl','buckrog',
  'bucky','bwidow','bzone','cabal','captaven','carnival','ccastles','cclimber','centiped',
  'chaknpop','chasehq','chinagat','choplift','circusc','citycon','ckong','ckongpt2','cleopatr',
  'columns','commando','congo','contra','cotton','crimfght','ctribe','cyvern','darkseal',
  'dassault','dbreed','dbz','dbz2','ddcrew2','ddragon','ddragon2','ddragon3','ddux','deadconx',
  'defender','digdug','digdug2','dkong','dkong3','dkongjr','dmnfrnt','docastle','dondokod',
  'drgnbstr','drtoppel','dsaber','dsoccr94','dynagear','edrandy','elevator','elvactr','enduror',
  'eprom','eswat','exedexes','fantzn2','fantzone','fastlane','flicky','foodf','frogger',
  'funkyjet','ga2','gaia','gaiden','galaga','galaga88','galaxian','galivan','galmedes',
  'gangwars','gaplus','gaunt22p','gauntlet2p','gblchmp','geebeeg','gground','ghostb','gijoe',
  'gnbarich','gng','godzilla','gogomile','goldnaxe','gradius3','grdians','growl','gstream',
  'gtmr2','gunbird2','gunforce','gunlock','gunnail','gunsmoke','gyruss','hangon','hbarrel',
  'hcastle','heatbrl','hharry','hitice','hook','hopmappy','horekid','horizon','hvysmsh','ikari',
  'ikari3','imgfight','inthunt','invaders','jackal','jailbrek','jedi','journey','joust',
  'junglek','junofrst','kangaroo','karnov','kchamp','kick','kicker','kingball','klax','krull',
  'kungfum','landmakr','ldrun','ldrun2','ldrun3','ldrun4','lethalth','liblrabl','lightbr',
  'liquidk','lizwiz','lkage','llander','locomotn','loderndf','loht','lwings','macross','macross2',
  'macrossp','mainevt2p','mario','mazinger','metamrph','metmqstr','mgcrystl','mhavoc','mikie',
  'milliped','missile','moomesa','mpatrol','mrdo','mrgoemon','mspacman','mwalk','mystwarr',
  'narc','nbajamte','nbbatman','nemesis','nibbler','ninjak','ninjakd2','ninjakun','nitedrvr',
  'nitrobal','nob','nrallyx','nslashers','nspirit','osman','outfxies','outrun','pacland',
  'pacman','parodius','pbobble3','penbros','pengo','phoenix','pipedrm','pitfight','pleiads',
  'pooyan','popeye','pow','punchout','punkshot2','puyo','puyopuy2','puzzloop','qbert','qix',
  'quartet2','radm','raiden2','rallyx','rambo3','rampage','rampart2p','rastan','rbisland',
  'renegade','ringking','riotcity','robocop','robocop2','robotron','rocnrope','rohga','rthun2',
  'rthunder','rushatck','rygar','s1945','s1945ii','s1945iii','sabotenb','sailormn','salamand',
  'scobra','scontra','scramble','seawolft','seganinj','seicross','sf','shadfrce','shangon',
  'sharrier','shdancer','shinobi','shollow','sidearms','simpsons2p','sinistar','skykid','slapshot',
  'slyspy','smashtv','snowbros','solomon','solrwarr','sonic','sonicfgt','sonson','spacedx',
  'spcinv95','spidman','splatter','spnchout','spyhunt','spyhunt2','srumbler','ssridersubc',
  'starwars','stdragon','stmblade','superman','superpac','sxevious','szaxxon','tankfrce','tapper',
  'tempest','tengai','tetrisp2','tgm2p','thndrbld','thundfox','tigeroad','timeplt','tmnt22pu',
  'tmnt2pj','tnzs','todruaga','toki','toobin','totcarn','trackfld','trojan','tron','tumblep',
  'twocrude','uccops','umk3','upndown','valkyrie','vball','vendetta2pu','viostorm','volfied',
  'vulcan','wb3','wbml','wboy','wildfang','wizdfire','wwfsstar','wwfwfest','xexex','xmen2pa',
  'xmultipl','xybots','yiear','zookeep',
];

// 카테고리별 분류
const categories: Record<string, string> = {};

// Helper to assign category
function cat(games: string[], category: string) {
  for (const g of games) categories[g] = category;
}

// ── Fighting ──
cat(['jojo','jojoba','redearth','sfiii','sfiii2','sfiii3'], 'fighting');
cat(['aof','aof2','aof3','fatfursp','fatfury1','fatfury3','garou','kabukikl','karnovr',
     'kof94','kof95','kof96','kof97','kof98','kof99','kof2000','kof2001','kof2002','kof2003',
     'kotm','kotm2','lastblad','lastbld2','matrim','rbff1','rbff2','rbffspec',
     'samsho','samsho2','samsho3','samsho4','samsh5fe','svc','wakuwak7',
     'doubledr','breakrev','galaxyfg','gowcaizr','fightfev','savagere','wh1','wh2','whp','kizuna'], 'fighting');
cat(['megaman2','ringdest','cybots','sgemf','nwarr','mshvsf','mvsc','xmcota','xmvsf','msh',
     'batcir','armwar','dstlk','vsav','vsav2','vhunt2'], 'fighting');
cat(['hsf2','ssf2','ssf2t','sfa','sfa2','sfa3','spf2t','sfz2al'], 'fighting');
cat(['sf2','sf2ce','sf2hf'], 'fighting');
cat(['burningf','ganryu','eightman'], 'action'); // belt-scroll action, not pure fighting

// ── Action (Beat-em-up / Run & Gun / Platformer) ──
cat(['captcomm','knights','ffight','dino','punisher','wof','nemo','willow','unsquad',
     'kod','dynwar','mbombrd','mtwins','slammast','forgottn','ghouls','strider',
     'cawing','megaman','mercs','msword','pang3','pnickj','3wonders'], 'action');
cat(['avsp','ddsom','ddtod','csclub','progear'], 'action');
cat(['mslug','mslug3','mslug4','mslug5','mslugx','mutnat','nam1975','ncombat','ncommand',
     'neobombe','nitd','roboarmy','rotd','sengoku','sengoku2','sengoku3','shocktro',
     'shocktr2','spinmast','tophuntr','zedblade','zupapa','crsword','crswd2bl','eightman',
     'maglord','preisle2','superspy','bjourney','bangbead','double','neomrdo'], 'action');
cat(['aliens','aliensyn','altbeast','asterix','avengers','avspirit','baddudes','batman',
     'biomtoy','bionicc','blktiger','bloodbro','bogeyman','boogwing','brkthru','btoads',
     'bucky','cabal','captaven','crimfght','ctribe','darkseal','ddragon','ddragon2',
     'ddragon3','ddcrew2','dbreed','deadconx','drgnbstr','dynagear','edrandy','elvactr',
     'eswat','ga2','gaia','gaiden','gijoe','gng','goldnaxe','grdians','growl',
     'hcastle','heatbrl','hh', 'hook','ikari3','inthunt','jackal','jailbrek','kungfum',
     'landmakr','lethalth','lkage','loht','lwings','macross','mazinger','metamrph',
     'metmqstr','mikie','mystwarr','narc','nbbatman','ninjak','ninjakd2','ninjakun',
     'nslashers','nspirit','osman','pacland','pitfight','pow','rambo3','rampage',
     'rbisland','renegade','ringking','riotcity','robocop','robocop2','rocnrope',
     'rohga','rushatck','rygar','shadfrce','shinobi','shdancer','sidearms',
     'simpsons2p','slyspy','smashtv','snowbros','sonic','splatter',
     'ssridersubc','stdragon','stmblade','superman','thundfox','tigeroad','tmnt22pu',
     'tmnt2pj','toki','totcarn','trojan','tumblep','twocrude','uccops','umk3',
     'vendetta2pu','viostorm','vulcan','wb3','wbml','wboy','wildfang','wizdfire',
     'wwfsstar','xmen2pa'], 'action');
cat(['actfancr','bongo','chinagat','citycon','ddragon','ddux','docastle',
     'horekid','horizon','hvysmsh','jedi','journey','junglek','kangaroo',
     'kchamp','kick','kicker','ldrun','ldrun2','ldrun3','ldrun4',
     'lightbr','lizwiz','llander','loderndf','mario','mgcrystl','mrgoemon',
     'mwalk','nob','outfxies','penbros','pipedrm','quartet2','radm',
     'rampart2p','rthun2','rthunder','sabotenb','seganinj','sf',
     'spidman','spnchout','tankfrce','tnzs','todruaga','toobin','trackfld',
     'valkyrie'], 'action');

// ── Shooting (Shmup / Rail Shooter / Run & Gun with shooting focus) ──
cat(['1941','1942','1943','1943kai','1944','19xx','dimahoo','ecofghtr','gigawing','mmatrix'], 'shooting');
cat(['donpachi','ddonpach','ddp3','ddpdfk','ddpsdoj','deathsml','dfkbl','dsmbl',
     'espgal','espgal2','esprade','feversos','futari15','futaribl','guwange','ibara',
     'ibarablk','ket','mmpork','mushisam','pinkswts','akatana','batsugun','dogyuun',
     'fshark','grindstm','outzone','truxton','truxton2','twincobr','twinhawk','vimana',
     'zerowing','alcon','fireshrk','fixeight','hellfire','tigerh'], 'shooting');
cat(['aburner2','aerofgt','agallet','airwolf','ajax','aligator','aquajack','astorm',
     'aurail','batrider','bgaregga','blazstar','bbros','contra','cotton','cyvern',
     'dassault','dbz','dbz2','dsaber','dsoccr94','eprom','exedexes','fantzone',
     'fantzn2','funkyjet','galaga','galaga88','galaxian','galivan','galmedes',
     'gangwars','gaplus','ghostb','gnbarich','godzilla','gradius3','gstream','gtmr2',
     'gunbird2','gunforce','gunlock','gunnail','gunsmoke','gyruss','hbarrel',
     'hharry','ikari','imgfight','invaders','macross2','macrossp','mainevt2p',
     'mhavoc','mpatrol','nemesis','nitedrvr','nitrobal','parodius','phoenix',
     'pleiads','pulstar','raiden2','rthunder','rtype','rtype2','rtypeleo',
     's1945','s1945ii','s1945iii','sailormn','salamand','scontra','scramble',
     'seawolft','seicross','shangon','sharrier','shollow','sinistar','skykid',
     'solrwarr','sonicfgt','sonicwi2','sonicwi3','spacedx','spcinv95','spyhunt',
     'spyhunt2','srumbler','starwars','sxevious','szaxxon','tempest','tengai',
     'thndrbld','timeplt','tron','varth','vball','volfied','xexex','xmultipl',
     'xybots'], 'shooting');
cat(['amidar','asteroid','astdelux','blstroid','bwidow','centiped','defender','missile',
     'robotron','milliped','ccastles','berzerk','bzone','bubbles','buckrog',
     'carnival','foodf','joust','llander','mhavoc','pleiads','space','spyhunt',
     'starwars','tron','zookeep','gyruss'], 'shooting');
// gauntlet-like
cat(['gaunt22p','gauntlet2p'], 'action');

// ── Puzzle ──
cat(['puyo','puyopuy2','pbobblen','pbobbl2n','pbobble3','magdrop2','magdrop3',
     'pang3','puzzloop','pzloop2','mpang','panicbom','columns','qix','tetrisp2',
     'tgm2p','cleopatr','solomon','dondokod','bublbobl','bublbob2','liblrabl',
     'lizwiz','sonson','chaknpop','hopmappy','kingball','locomotn',
     'nrallyx','rallyx','twinspri','upndown','pipedrm','gnbarich','landmakr'], 'puzzle');
cat(['arkanoid','arknoid2','bombjack','pengo','pooyan','docastle','drtoppel',
     'geebeeg','lbowling','nibbler','penbros','pnickj','pooyan','quartet2',
     'quester','rocnrope','todruaga','zookeep'], 'puzzle');

// ── Sports ──
cat(['2020bb','3countb','alpham2','androdun','bstars','bstars2','goalx3',
     'gpilots','lbowling','neodrift','overtop','sdodgeb','socbrawl',
     'ssideki4','strhoop','trally','turfmast','wjammers',
     'nbajamte','slapshot','wwfwfest','wwfsstar','vball',
     'dsoccr94','kick','kicker','hattrick','slapshot'], 'sports');

// ── Etc (Maze / Racing / Misc) ──
cat(['64street','armorcar','armwrest','badlands','bankp','bnj','btime',
     'chasehq','choplift','circusc','ckong','ckongpt2','commando','congo',
     'digdug','digdug2','dkong','dkong3','dkongjr','elevator','enduror',
     'fastlane','flicky','foodf','frogger','gaunt22p','gauntlet2p',
     'gblchmp','geebeeg','gground','hangon','hitice','ikari',
     'irrmaze','jackal','junglek','junofrst','kangaroo','klax','krull',
     'liquidk','lkage','locomotn','loht','mario','mikie','mspacman',
     'mwalk','narc','nibbler','nitedrvr','nitrobal','nrallyx',
     'outrun','pacman','pitfight','pnickj','pooyan','popeye',
     'punchout','punkshot2','qbert','radm','rallyx',
     'rastan','ringking','robocop','robotron','rocnrope',
     'skykid','solomon','sonic','spnchout','superpac',
     'tapper','tetrisp2','tgm2p','timeplt','todruaga',
     'toobin','trackfld','upndown','wboy','yiear'], 'etc');
// racing
cat(['aquajack','chasehq','outrun','radm','enduror','fastlane','hangon',
     'thndrbld','gtmr2','neodrift','trally','overtop','tigeroad'], 'sports');

// Remove duplicates by checking what's already in GAME_CATEGORIES
const missing: string[] = [];
for (const g of ALL) {
  const qKey = `"${g}":`; // quoted key
  const uRegex = new RegExp(`\\b${g}\\s*:`, "i"); // unquoted key
  if (!section.includes(qKey) && !uRegex.test(section)) {
    missing.push(g);
  }
}

// Output only new entries for missing games
console.log("  // ── FBNeo 전체 카테고리 일괄 추가 ──");
const missingWithCats: [string, string][] = [];
for (const g of missing) {
  const c = categories[g] ?? "etc";
  missingWithCats.push([g, c]);
}
missingWithCats.sort((a, b) => a[0].localeCompare(b[0]));

for (const [g, c] of missingWithCats) {
  console.log(`  ${g}: "${c}",`);
}

// Also report anys till uncategorized
const stillUncat = missing.filter(g => !categories[g]);
if (stillUncat.length > 0) {
  console.log(`\n// WARNING: ${stillUncat.length} still uncategorized (using etc):`);
  console.log(stillUncat.join(", "));
}
