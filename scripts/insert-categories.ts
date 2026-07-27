import * as fs from "fs";

// Read the insert block
const block = fs.readFileSync("scripts/categories-insert-block.txt", "utf8").trim();

// Read game-names.ts preserving BOM
const rawBuf = fs.readFileSync("apps/web/src/lib/game-names.ts");
const hasBOM = rawBuf[0] === 0xEF && rawBuf[1] === 0xBB && rawBuf[2] === 0xBF;
const content = rawBuf.toString("utf8");

// Find the insertion point: after "tigerh" line, before "};" (handle CRLF)
const EOL = content.includes("\r\n") ? "\r\n" : "\n";
const marker = `  tigerh: "shooting",${EOL}};`;
const replacement = `  tigerh: "shooting",${EOL}  // ── FBNeo 전체 카테고리 일괄 추가 (자동 생성) ──${EOL}${block.replace(/\n/g, EOL)}${EOL}};`;

if (!content.includes(marker)) {
  console.error("ERROR: marker not found in game-names.ts");
  const idx = content.indexOf("tigerh:");
  if (idx >= 0) {
    console.error("Found 'tigerh:' at index", idx);
    console.error("Context:", JSON.stringify(content.slice(idx, idx + 50)));
  }
  process.exit(1);
}

const newContent = content.replace(marker, replacement);
const outBuf = Buffer.from(newContent, "utf8");
const finalBuf = hasBOM ? Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), outBuf]) : outBuf;
fs.writeFileSync("apps/web/src/lib/game-names.ts", finalBuf);
console.log(`Inserted ${block.split("\n").length} new categories (BOM preserved: ${hasBOM})`);
