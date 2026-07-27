# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fbneo-test.spec.ts >> FBNeo Solo Play >> Solo kof97 FBNeo 부팅 + Canvas 렌더링 + 키입력
- Location: fbneo-test.spec.ts:45:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e8]:
        - link "RTCADE 추억의 게임을 다시 연결하는 공간" [ref=e10] [cursor=pointer]:
          - /url: /
          - generic [ref=e11]: RTCADE
          - generic [ref=e12]: 추억의 게임을 다시 연결하는 공간
        - navigation [ref=e13]:
          - link "홈" [ref=e14] [cursor=pointer]:
            - /url: /
          - link "플레이" [ref=e18] [cursor=pointer]:
            - /url: /netplay
          - link "공지사항" [ref=e22] [cursor=pointer]:
            - /url: /notices
          - link "설정" [ref=e26] [cursor=pointer]:
            - /url: /settings
        - generic [ref=e30]:
          - button "사용자 여정 튜토리얼 다시 보기" [ref=e31] [cursor=pointer]
          - button "다크 모드로 전환" [ref=e34] [cursor=pointer]
          - button "🎮 QA-Tester 프로필 편집" [ref=e37] [cursor=pointer]:
            - generic [ref=e38]:
              - generic [ref=e39]: 🎮
              - generic [ref=e40]: QA-Tester
            - generic [ref=e41]: 프로필 편집
    - main [ref=e42]:
      - generic [ref=e49]:
        - generic [ref=e50]:
          - button [ref=e51] [cursor=pointer]
          - generic [ref=e54]: 게임을 선택하세요
        - generic [ref=e55]:
          - textbox "게임 검색..." [ref=e60]
          - generic [ref=e61]:
            - button "초대 코드 방" [ref=e62] [cursor=pointer]
            - button "공개 방" [ref=e66] [cursor=pointer]
          - paragraph [ref=e70]: 선택한 게임으로 초대 코드 방을 만듭니다. 코드를 공유한 사람만 참가할 수 있습니다.
          - generic [ref=e71]:
            - button "전체 4" [ref=e72] [cursor=pointer]
            - button "⚔️ 격투 2" [ref=e73] [cursor=pointer]
            - button "💥 액션 1" [ref=e74] [cursor=pointer]
            - button "🧩 퍼즐 1" [ref=e75] [cursor=pointer]
          - generic [ref=e79]:
            - generic [ref=e80]:
              - generic [ref=e81]:
                - generic [ref=e82]: ⚔️
                - paragraph [ref=e83]: 격투
                - generic [ref=e84]: "2"
              - generic [ref=e85]:
                - button "KOF '97 썸네일 크게 보기" [ref=e86]:
                  - img "KOF '97" [ref=e87]
                  - generic [ref=e88]: 크게 보기
                - button "KOF '97 fbneo kof97.zip" [ref=e89]:
                  - generic [ref=e90]: KOF '97
                  - generic [ref=e91]:
                    - generic [ref=e92]: fbneo
                    - generic [ref=e93]: kof97.zip
                - button "즐겨찾기 추가" [ref=e94] [cursor=pointer]
              - generic [ref=e97]:
                - button "KOF 2001 썸네일 크게 보기" [ref=e98]:
                  - img "KOF 2001" [ref=e99]
                  - generic [ref=e100]: 크게 보기
                - button "KOF 2001 MAME 2003+ kof2001.zip" [ref=e101]:
                  - generic [ref=e102]: KOF 2001
                  - generic [ref=e103]:
                    - generic [ref=e104]: MAME 2003+
                    - generic [ref=e105]: kof2001.zip
                - button "즐겨찾기 추가" [ref=e106] [cursor=pointer]
            - generic [ref=e109]:
              - generic [ref=e110]:
                - generic [ref=e111]: 💥
                - paragraph [ref=e112]: 액션
                - generic [ref=e113]: "1"
              - generic [ref=e114]:
                - button "데몬 프론트 썸네일 크게 보기" [ref=e115]:
                  - img "데몬 프론트" [ref=e116]
                  - generic [ref=e117]: 크게 보기
                - button "데몬 프론트 FBNeo (아케이드) dmnfrnt.zip" [ref=e118]:
                  - generic [ref=e119]: 데몬 프론트
                  - generic [ref=e120]:
                    - generic [ref=e121]: FBNeo (아케이드)
                    - generic [ref=e122]: dmnfrnt.zip
                - button "즐겨찾기 추가" [ref=e123] [cursor=pointer]
            - generic [ref=e126]:
              - generic [ref=e127]:
                - generic [ref=e128]: 🧩
                - paragraph [ref=e129]: 퍼즐
                - generic [ref=e130]: "1"
              - generic [ref=e131]:
                - button "뿌요뿌요 2 썸네일 크게 보기" [ref=e132]:
                  - img "뿌요뿌요 2" [ref=e133]
                  - generic [ref=e134]: 크게 보기
                - button "뿌요뿌요 2 MAME 2003+ puyopuy2.zip" [ref=e135]:
                  - generic [ref=e136]: 뿌요뿌요 2
                  - generic [ref=e137]:
                    - generic [ref=e138]: MAME 2003+
                    - generic [ref=e139]: puyopuy2.zip
                - button "즐겨찾기 추가" [ref=e140] [cursor=pointer]
  - region "Notifications alt+T"
```

# Test source

```ts
  12  | function collectConsole(page: any, label: string) {
  13  |   page.on("console", (msg: any) => {
  14  |     if (msg.type() === "error") console.log(`[${label} ERR]`, msg.text());
  15  |   });
  16  |   page.on("pageerror", (err: Error) => console.log(`[${label} PAGE_ERR]`, err.message));
  17  | }
  18  | 
  19  | async function ensureNickname(page: any, name: string) {
  20  |   const dialog = page.locator("[role=dialog]");
  21  |   if (await dialog.isVisible({ timeout: 3000 }).catch(() => false)) {
  22  |     const input = dialog.locator("input").first();
  23  |     if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
  24  |       await input.fill(name);
  25  |       await input.press("Enter");
  26  |       await page.waitForTimeout(1500);
  27  |     }
  28  |   }
  29  | }
  30  | 
  31  | async function dismissTutorial(page: any) {
  32  |   await page.keyboard.press("Escape");
  33  |   await page.waitForTimeout(300);
  34  |   const nextBtn = page.locator(".driver-popover-next-btn");
  35  |   if (await nextBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
  36  |     await nextBtn.click();
  37  |     await page.waitForTimeout(500);
  38  |   }
  39  | }
  40  | 
  41  | // ── Tests ──────────────────────────────────────────────
  42  | 
  43  | test.describe("FBNeo Solo Play", () => {
  44  | 
  45  |   test("Solo kof97 FBNeo 부팅 + Canvas 렌더링 + 키입력", async ({ browser }) => {
  46  |     const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  47  |     const page = await context.newPage();
  48  |     collectConsole(page, "HOST");
  49  | 
  50  |     // 1. 접속
  51  |     await page.goto(BASE + "/netplay", { waitUntil: "networkidle" });
  52  |     await page.waitForTimeout(1000);
  53  | 
  54  |     // 2. 닉네임 + 튜토리얼
  55  |     await ensureNickname(page, "QA-Tester");
  56  |     await dismissTutorial(page);
  57  | 
  58  |     // 3. "혼자하기" 탭 클릭
  59  |     const soloBtn = page.locator("button").filter({ hasText: "혼자하기" });
  60  |     if (await soloBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
  61  |       await soloBtn.click({ force: true });
  62  |       await page.waitForTimeout(500);
  63  |     }
  64  | 
  65  |     await dismissTutorial(page);
  66  | 
  67  |     // 4. "게임 선택" or "새로운 방 만들기" 버튼 → ROM 브라우저
  68  |     const browseBtn = page.locator("button").filter({ hasText: /게임 선택|방 만들기/ }).first();
  69  |     if (await browseBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
  70  |       await browseBtn.click({ force: true });
  71  |     }
  72  |     await page.waitForTimeout(1000);
  73  | 
  74  |     // 5. kof97 게임 카드 찾아서 "혼자하기" 버튼 클릭
  75  |     // GameCard는 카드 안에 여러 버튼이 있음. "혼자하기" 또는 "Start Solo" 찾기
  76  |     const soloStartBtns = page.locator("button").filter({ hasText: /혼자하기|Start Solo/i });
  77  |     const btnCount = await soloStartBtns.count();
  78  |     console.log(`Found ${btnCount} solo start buttons`);
  79  | 
  80  |     if (btnCount > 0) {
  81  |       // kof97과 가장 가까운 버튼 찾기 (kof97 텍스트 근처)
  82  |       await soloStartBtns.first().click({ force: true });
  83  |       console.log("Clicked solo start");
  84  |     }
  85  | 
  86  |     // 6. WASM + ROM 로딩 대기 (19MB neogeo WASM + 28MB ROM)
  87  |     console.log("⏳ Waiting for FBNeo load...");
  88  |     await page.waitForTimeout(5000);
  89  | 
  90  |     // "로딩 중" 텍스트가 사라질 때까지 대기
  91  |     try {
  92  |       await page.locator("text=/로딩|loading/i").first().waitFor({ state: "hidden", timeout: 30000 });
  93  |       console.log("Loading indicator gone");
  94  |     } catch {
  95  |       console.log("Loading indicator still present or not found");
  96  |     }
  97  | 
  98  |     await page.waitForTimeout(3000);
  99  |     await page.screenshot({ path: "test-results/after-load.png", fullPage: true });
  100 | 
  101 |     // 7. Canvas 찾기
  102 |     const canvas = page.locator("canvas").first();
  103 |     const hasCanvas = await canvas.isVisible({ timeout: 5000 }).catch(() => false);
  104 |     console.log(`Canvas found: ${hasCanvas}`);
  105 | 
  106 |     // Canvas가 없으면 body text 확인해서 에러 찾기
  107 |     if (!hasCanvas) {
  108 |       const bodyText = await page.locator("body").textContent();
  109 |       console.log("Body text sample:", bodyText?.slice(0, 500));
  110 |     }
  111 | 
> 112 |     expect(hasCanvas).toBe(true);
      |                       ^ Error: expect(received).toBe(expected) // Object.is equality
  113 | 
  114 |     // 8. Canvas 크기 확인
  115 |     const box = await canvas.boundingBox();
  116 |     expect(box).not.toBeNull();
  117 |     console.log(`Canvas: ${box!.width}x${box!.height}`);
  118 | 
  119 |     // 9. 키보드 입력 테스트
  120 |     await canvas.focus();
  121 |     await page.waitForTimeout(500);
  122 | 
  123 |     const inputs = [
  124 |       "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
  125 |       "KeyA", "KeyS", "KeyD", "KeyF",
  126 |       "Digit1", "Digit5",
  127 |     ];
  128 | 
  129 |     // 단일 키
  130 |     for (const key of inputs) {
  131 |       await page.keyboard.down(key);
  132 |       await page.waitForTimeout(60);
  133 |       await page.keyboard.up(key);
  134 |       await page.waitForTimeout(20);
  135 |     }
  136 | 
  137 |     // 콤보 (대각선 + 펀치)
  138 |     await page.keyboard.down("ArrowDown");
  139 |     await page.keyboard.down("ArrowRight");
  140 |     await page.waitForTimeout(30);
  141 |     await page.keyboard.down("KeyA");
  142 |     await page.waitForTimeout(150);
  143 |     await page.keyboard.up("KeyA");
  144 |     await page.keyboard.up("ArrowRight");
  145 |     await page.keyboard.up("ArrowDown");
  146 | 
  147 |     // 연속 펀치
  148 |     for (const k of ["KeyA", "KeyA", "KeyD"]) {
  149 |       await page.keyboard.down(k);
  150 |       await page.waitForTimeout(50);
  151 |       await page.keyboard.up(k);
  152 |       await page.waitForTimeout(30);
  153 |     }
  154 | 
  155 |     console.log("✅ All keyboard inputs sent:", inputs.join(", "));
  156 | 
  157 |     await page.waitForTimeout(1000);
  158 |     await page.screenshot({ path: "test-results/after-inputs.png", fullPage: true });
  159 | 
  160 |     await context.close();
  161 |   });
  162 | 
  163 | });
  164 | 
  165 | test.describe("API", () => {
  166 |   test("ROM API returns FBNeo kof97", async ({ request }) => {
  167 |     const res = await request.get(ROM_API);
  168 |     expect(res.status()).toBe(200);
  169 |     const roms = await res.json();
  170 |     const fbneo = roms.filter((r: any) => r.core === "fbneo");
  171 |     expect(fbneo.length).toBeGreaterThan(0);
  172 |     console.log("FBNeo ROMs:", fbneo.map((r: any) => r.filename).join(", "));
  173 |   });
  174 | 
  175 |   test("kof97.zip + neogeo.zip accessible", async ({ request }) => {
  176 |     for (const file of ["kof97.zip", "neogeo.zip"]) {
  177 |       const res = await request.get(`http://localhost:3001/roms/fbneo/${file}`);
  178 |       expect(res.status()).toBe(200);
  179 |       console.log(`${file}: ${(await res.body()).length} bytes`);
  180 |     }
  181 |   });
  182 | });
  183 | 
```