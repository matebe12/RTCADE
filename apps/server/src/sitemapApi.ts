import { type Express } from "express";
import fs from "fs";
import path from "path";

const VALID_CORES = new Set([
  "nes", "snes", "n64", "gb", "gba", "nds", "psx", "psp",
  "segaMD", "segaMS", "segaGG", "segaSaturn", "segaCD", "sega32x",
  "mame2003", "mame2003_plus", "arcade", "fbneo",
  "atari2600", "atari7800", "lynx", "jaguar", "3do", "coleco", "vb", "dosbox",
]);

const BIOS_FILES = new Set(["neogeo.zip", "pgm.zip", "skns.zip", "decocass.zip", "neocdz.zip", "stvbios.zip"]);

const BASE_URL = process.env.SITE_URL || "https://rtcade.vercel.app";

function listAllRoms(romsDir: string): { filename: string; core: string; romPath: string }[] {
  if (!fs.existsSync(romsDir)) return [];

  const roms: { filename: string; core: string; romPath: string }[] = [];

  for (const dir of fs.readdirSync(romsDir, { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name.startsWith(".")) continue;
    const core = dir.name;
    if (!VALID_CORES.has(core)) continue;

    const coreDir = path.join(romsDir, core);
    for (const fileName of fs.readdirSync(coreDir)) {
      if (fileName.startsWith(".") || BIOS_FILES.has(fileName.toLowerCase())) continue;
      roms.push({ filename: fileName, core, romPath: `${core}/${fileName}` });
    }
  }

  return roms;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function registerSitemapRoutes(app: Express, romsDir: string) {
  app.get("/api/sitemap", (_req, res) => {
    const roms = listAllRoms(romsDir);

    const urls: string[] = [];

    // Home page
    urls.push(`  <url>
    <loc>${escapeXml(BASE_URL)}/</loc>
    <changefreq>always</changefreq>
    <priority>1.0</priority>
  </url>`);

    // Play lobby
    urls.push(`  <url>
    <loc>${escapeXml(BASE_URL)}/netplay</loc>
    <changefreq>always</changefreq>
    <priority>0.9</priority>
  </url>`);

    // Notices
    urls.push(`  <url>
    <loc>${escapeXml(BASE_URL)}/notices</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`);

    // Game detail pages
    for (const rom of roms) {
      const url = `${BASE_URL}/game?rom=${encodeURIComponent(rom.romPath)}&core=${encodeURIComponent(rom.core)}`;
      urls.push(`  <url>
    <loc>${escapeXml(url)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(xml);
  });

  // robots.txt
  app.get("/robots.txt", (_req, res) => {
    const robots = `User-agent: *
Allow: /

Sitemap: ${BASE_URL}/api/sitemap
`;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(robots);
  });
}
