import express, { type Express } from "express";
import fs from "fs";
import path from "path";

const BIOS_FILES = new Set(["neogeo.zip", "pgm.zip", "skns.zip", "decocass.zip", "neocdz.zip"]);

const VALID_CORES = new Set([
  "nes",
  "snes",
  "n64",
  "gb",
  "gba",
  "nds",
  "psx",
  "psp",
  "segaMD",
  "segaMS",
  "segaGG",
  "segaSaturn",
  "segaCD",
  "sega32x",
  "mame2003",
  "mame2003_plus",
  "arcade",
  "fbneo",
  "atari2600",
  "atari7800",
  "lynx",
  "jaguar",
  "3do",
  "coleco",
  "vb",
  "dosbox",
]);

interface RomInfo {
  filename: string;
  core: string;
  path: string;
  bios?: string;
}

function listRoms(romsDir: string): RomInfo[] {
  if (!fs.existsSync(romsDir)) {
    return [];
  }

  const roms: RomInfo[] = [];
  const coreDirs = fs.readdirSync(romsDir, { withFileTypes: true });

  for (const dir of coreDirs) {
    if (!dir.isDirectory() || dir.name.startsWith(".")) {
      continue;
    }

    const core = dir.name;
    if (!VALID_CORES.has(core)) {
      continue;
    }

    const files = fs.readdirSync(path.join(romsDir, core));
    const biosFile = files.find((fileName) => BIOS_FILES.has(fileName.toLowerCase()));

    for (const fileName of files) {
      if (fileName.startsWith(".") || BIOS_FILES.has(fileName.toLowerCase())) {
        continue;
      }

      const rom: RomInfo = {
        filename: fileName,
        core,
        path: `${core}/${fileName}`,
      };

      if (biosFile) {
        rom.bios = `${core}/${biosFile}`;
      }

      roms.push(rom);
    }
  }

  return roms;
}

export function registerRomRoutes(app: Express, romsDir: string) {
  app.use("/roms", express.static(romsDir));

  app.get("/api/roms", (_req, res) => {
    res.json(listRoms(romsDir));
  });
}
