/**
 * FBNeo E2E Test — Playwright (headed)
 * 실행: npx playwright test e2e/fbneo-test.spec.ts --headed
 */
import { test, expect } from "@playwright/test";

const BASE = "http://localhost:5173";
const ROM_API = "http://localhost:3001/api/roms";

// ── Helpers ────────────────────────────────────────────

function collectConsole(page: any, label: string) {
  page.on("console", (msg: any) => {
    if (msg.type() === "error") console.log(`[${label} ERR]`, msg.text());
  });
  page.on("pageerror", (err: Error) => console.log(`[${label} PAGE_ERR]`, err.message));
}

async function ensureNickname(page: any, name: string) {
  const dialog = page.locator("[role=dialog]");
  if (await dialog.isVisible({ timeout: 3000 }).catch(() => false)) {
    const input = dialog.locator("input").first();
    if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
      await input.fill(name);
      await input.press("Enter");
      await page.waitForTimeout(1500);
    }
  }
}

async function dismissTutorial(page: any) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const nextBtn = page.locator(".driver-popover-next-btn");
  if (await nextBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await nextBtn.click();
    await page.waitForTimeout(500);
  }
}

// ── Tests ──────────────────────────────────────────────

test.describe("FBNeo Solo Play", () => {

  test("Solo kof97 FBNeo 부팅 + Canvas 렌더링 + 키입력", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();
    collectConsole(page, "HOST");

    // 1. 접속
    await page.goto(BASE + "/netplay", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // 2. 닉네임 + 튜토리얼
    await ensureNickname(page, "QA-Tester");
    await dismissTutorial(page);

    // 3. "혼자하기" 탭 클릭
    const soloBtn = page.locator("button").filter({ hasText: "혼자하기" });
    if (await soloBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await soloBtn.click({ force: true });
      await page.waitForTimeout(500);
    }

    await dismissTutorial(page);

    // 4. "게임 선택" or "새로운 방 만들기" 버튼 → ROM 브라우저
    const browseBtn = page.locator("button").filter({ hasText: /게임 선택|방 만들기/ }).first();
    if (await browseBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await browseBtn.click({ force: true });
    }
    await page.waitForTimeout(1000);

    // 5. kof97 게임 카드 찾아서 "혼자하기" 버튼 클릭
    // GameCard는 카드 안에 여러 버튼이 있음. "혼자하기" 또는 "Start Solo" 찾기
    const soloStartBtns = page.locator("button").filter({ hasText: /혼자하기|Start Solo/i });
    const btnCount = await soloStartBtns.count();
    console.log(`Found ${btnCount} solo start buttons`);

    if (btnCount > 0) {
      // kof97과 가장 가까운 버튼 찾기 (kof97 텍스트 근처)
      await soloStartBtns.first().click({ force: true });
      console.log("Clicked solo start");
    }

    // 6. WASM + ROM 로딩 대기 (19MB neogeo WASM + 28MB ROM)
    console.log("⏳ Waiting for FBNeo load...");
    await page.waitForTimeout(5000);

    // "로딩 중" 텍스트가 사라질 때까지 대기
    try {
      await page.locator("text=/로딩|loading/i").first().waitFor({ state: "hidden", timeout: 30000 });
      console.log("Loading indicator gone");
    } catch {
      console.log("Loading indicator still present or not found");
    }

    await page.waitForTimeout(3000);
    await page.screenshot({ path: "test-results/after-load.png", fullPage: true });

    // 7. Canvas 찾기
    const canvas = page.locator("canvas").first();
    const hasCanvas = await canvas.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`Canvas found: ${hasCanvas}`);

    // Canvas가 없으면 body text 확인해서 에러 찾기
    if (!hasCanvas) {
      const bodyText = await page.locator("body").textContent();
      console.log("Body text sample:", bodyText?.slice(0, 500));
    }

    expect(hasCanvas).toBe(true);

    // 8. Canvas 크기 확인
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    console.log(`Canvas: ${box!.width}x${box!.height}`);

    // 9. 키보드 입력 테스트
    await canvas.focus();
    await page.waitForTimeout(500);

    const inputs = [
      "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
      "KeyA", "KeyS", "KeyD", "KeyF",
      "Digit1", "Digit5",
    ];

    // 단일 키
    for (const key of inputs) {
      await page.keyboard.down(key);
      await page.waitForTimeout(60);
      await page.keyboard.up(key);
      await page.waitForTimeout(20);
    }

    // 콤보 (대각선 + 펀치)
    await page.keyboard.down("ArrowDown");
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(30);
    await page.keyboard.down("KeyA");
    await page.waitForTimeout(150);
    await page.keyboard.up("KeyA");
    await page.keyboard.up("ArrowRight");
    await page.keyboard.up("ArrowDown");

    // 연속 펀치
    for (const k of ["KeyA", "KeyA", "KeyD"]) {
      await page.keyboard.down(k);
      await page.waitForTimeout(50);
      await page.keyboard.up(k);
      await page.waitForTimeout(30);
    }

    console.log("✅ All keyboard inputs sent:", inputs.join(", "));

    await page.waitForTimeout(1000);
    await page.screenshot({ path: "test-results/after-inputs.png", fullPage: true });

    await context.close();
  });

});

test.describe("API", () => {
  test("ROM API returns FBNeo kof97", async ({ request }) => {
    const res = await request.get(ROM_API);
    expect(res.status()).toBe(200);
    const roms = await res.json();
    const fbneo = roms.filter((r: any) => r.core === "fbneo");
    expect(fbneo.length).toBeGreaterThan(0);
    console.log("FBNeo ROMs:", fbneo.map((r: any) => r.filename).join(", "));
  });

  test("kof97.zip + neogeo.zip accessible", async ({ request }) => {
    for (const file of ["kof97.zip", "neogeo.zip"]) {
      const res = await request.get(`http://localhost:3001/roms/fbneo/${file}`);
      expect(res.status()).toBe(200);
      console.log(`${file}: ${(await res.body()).length} bytes`);
    }
  });
});
