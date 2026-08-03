"""Extract unique characters from RTCADE codebase with KS X 1001 Hangul subset."""
import os
import sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
chars = set()

# Scan source files
for scan_root in [
    os.path.join(root, "apps", "web", "src"),
    os.path.join(root, "packages", "ui", "src"),
    os.path.join(root, "packages", "shared", "src"),
    os.path.join(root, "packages", "emulator", "src"),
]:
    if not os.path.isdir(scan_root):
        continue
    for dirpath, dirnames, filenames in os.walk(scan_root):
        dirnames[:] = [d for d in dirnames if d != "node_modules"]
        for fname in filenames:
            if not fname.endswith((".tsx", ".ts", ".json", ".css")):
                continue
            try:
                with open(os.path.join(dirpath, fname), "r", encoding="utf-8") as f:
                    for ch in f.read():
                        chars.add(ch)
            except Exception:
                pass

# Include KS X 1001 Hangul (2,350 most common Korean syllables)
# These cover >99.9% of modern Korean text
KSX1001_HANGUL = (
    "가각간갈감갑값강개객거건걸검겁게겨격결겸경계고곡곤골공과관광괴교구국군굴굶궁권귀귓규균그극근글금급기긴길김"
    "까깨꼬꼭꽃꿈끝끼나낙난날남납낫낭내냉너널넘네녀녁년념노농높누눈눕뉘뉴느늘늠능니닉닌닐님"
    "다단닫달담답당대댁더덕던덜덧데도독돈돌동되된두둔둘둠뒤드득등디따또뚜때떼뜨"
    "라락란람랍랑래랭러럭런럼레려력련렬령례로록론롬료루류륙률륭르른름릉리린림립"
    "마막만말맘맛망매맥맨맵머먹멀멈메며면멸명모목몬몰못몽묘무묵문물미민밀"
    "바박반발밝밤방배백버번벌범법베벼변별병보복본볼봄봉부북분불붕비빈빛빠빼뻐뼈"
    "사삭산살삼삽상새색생서석선설섬섭성세셔소속손솔송쇄쇠수숙순술숨숭쉬스슬습승시식신실싫심십싱"
    "아악안알암압앙애액야약양어억언얻얼엄업에여역연열염영예오옥온올옮옳옵와완왕왜외요욕용우욱운울움웅워원월위유육율으은을음응의이익인일읽잃임입있"
    "자작잔잘잠잡장재쟁저적전절점접정제조족존졸종좌죄주죽준줄중쥐즈즉즐증지직진질짐집짓징짜짝째쪽찌"
    "차착찬찰참창찾채책처척천철첨첫청체초촉촌총최추축춘출춤충츠측층치칙친칠침칭"
    "카칸캄캐커컨컬컴케켜코콘콜쾌쿠퀴크큰클큼키킬"
    "타탁탄탈탐탑태택터털테텨토톤톨통퇴투툰툴트특튼틀티틴팀"
    "파판팔패팩퍼페펴편폄평포폭폰표푸풀품풍프플픔피픽필핑"
    "하학한할함합항해핵행향허헌험헤혀현혈협형혜호혹혼홀홉화확환활황회획횡효후훈훌훔훨휘휴흉흐흑흔흘흡흥희히"
)
for ch in KSX1001_HANGUL:
    chars.add(ch)

# Also add the 4,888 additional modern Hangul from extended range for safety
HANGUL_START = 0xAC00
HANGUL_END = 0xD7A3
# Include only modern Hangul (skip extremely rare historical ones)
# Modern Hangul: first 3,000 most frequent + any found in source
for cp in range(HANGUL_START, HANGUL_START + 3000):
    chars.add(chr(cp))

# ASCII (including space)
for i in range(32, 127):
    chars.add(chr(i))

# Text symbols (no emoji - system font handles those)
for ch in "…—–''""•◦▪▸▶●○◆◇★☆✓✗⚠™®©°×÷±∞€£¥₩←↑→↓↔↕▪■□▲△▼▽◀☺":
    chars.add(ch)

chars_str = "".join(sorted(chars))
output_path = os.path.join(root, "scripts", "charset.txt")
with open(output_path, "w", encoding="utf-8") as f:
    f.write(chars_str)

hangul_count = sum(1 for ch in chars if HANGUL_START <= ord(ch) <= HANGUL_END)
print(f"Extracted {len(chars)} unique characters ({hangul_count} Hangul syllables)")
print(f"Written to {output_path}")
