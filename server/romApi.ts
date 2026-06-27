import express, { type Express } from "express";
import fs from "fs";
import path from "path";

const BIOS_FILES = new Set(["neogeo.zip", "pgm.zip", "skns.zip", "decocass.zip", "neocdz.zip", "stvbios.zip"]);
const CORE_CATALOG_FILE_NAME = ".rtcade-roms.json";

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

interface RomCatalogEntry {
  bios?: string | null;
}

interface CoreCatalog {
  defaults?: RomCatalogEntry;
  roms?: Record<string, RomCatalogEntry>;
}

function normalizeCatalogKey(value: string) {
  return value.trim().toLowerCase();
}

function parseCatalogEntry(value: unknown): RomCatalogEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const bios = (value as { bios?: unknown }).bios;

  if (bios === null) {
    return { bios: null };
  }

  if (typeof bios === "string" && bios.trim()) {
    return { bios: bios.trim() };
  }

  return {};
}

function readCoreCatalog(coreDir: string): CoreCatalog | null {
  const catalogPath = path.join(coreDir, CORE_CATALOG_FILE_NAME);

  if (!fs.existsSync(catalogPath)) {
    return null;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(catalogPath, "utf8")) as {
      defaults?: unknown;
      roms?: Record<string, unknown>;
    };
    const defaults = parseCatalogEntry(raw.defaults) ?? undefined;
    const roms = Object.fromEntries(
      Object.entries(raw.roms ?? {}).flatMap(([key, entry]) => {
        const parsedEntry = parseCatalogEntry(entry);
        return parsedEntry ? [[normalizeCatalogKey(key), parsedEntry]] : [];
      }),
    );

    return {
      defaults,
      roms,
    };
  } catch (error) {
    console.warn(`[ROM API] Failed to parse ${catalogPath}:`, error);
    return null;
  }
}

function resolveCatalogBios(catalog: CoreCatalog | null, filename: string) {
  if (!catalog) {
    return { hasCatalog: false, bios: undefined as string | undefined };
  }

  const normalizedFilename = normalizeCatalogKey(filename);
  const entry = catalog.roms?.[normalizedFilename];

  if (entry && entry.bios !== undefined) {
    return { hasCatalog: true, bios: entry.bios ?? undefined };
  }

  if (catalog.defaults && catalog.defaults.bios !== undefined) {
    return { hasCatalog: true, bios: catalog.defaults.bios ?? undefined };
  }

  return { hasCatalog: true, bios: undefined as string | undefined };
}

function toRomAssetPath(core: string, assetPath: string) {
  return assetPath.includes("/") ? assetPath : `${core}/${assetPath}`;
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

    const coreDir = path.join(romsDir, core);
    const files = fs.readdirSync(coreDir);
    const biosFile = files.find((fileName) => BIOS_FILES.has(fileName.toLowerCase()));
    const catalog = readCoreCatalog(coreDir);

    for (const fileName of files) {
      if (fileName.startsWith(".") || BIOS_FILES.has(fileName.toLowerCase())) {
        continue;
      }

      const rom: RomInfo = {
        filename: fileName,
        core,
        path: `${core}/${fileName}`,
      };

      const catalogBios = resolveCatalogBios(catalog, fileName);

      if (catalogBios.hasCatalog) {
        if (catalogBios.bios) {
          rom.bios = toRomAssetPath(core, catalogBios.bios);
        }
      } else if (biosFile) {
        rom.bios = `${core}/${biosFile}`;
      }

      roms.push(rom);
    }
  }

  return roms;
}

/**
 * ROM 서빙 및 카탈로그 API 라우트를 등록한다.
 * - `GET /roms/*` — ROM 정적 파일 서빙
 * - `GET /api/roms` — 코어별 ROM 목록 (bios 정보 포함)
 * @param app - Express 앱 인스턴스
 * @param romsDir - ROM 디렉토리 경로
 */
export function registerRomRoutes(app: Express, romsDir: string) {
  app.use("/roms", express.static(romsDir));

  app.get("/api/roms", (_req, res) => {
    res.json(listRoms(romsDir));
  });
}
