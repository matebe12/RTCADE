import { useEffect, useState, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";

import { Badge } from "@rtcade/ui";
import { Button } from "@rtcade/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@rtcade/ui";
import { Loader2, Play, Gamepad2, ChevronRight } from "lucide-react";
import { usePageSeo } from "@/lib/seo";
import { parseRomName, getRomCategory, CATEGORY_INFO } from "@/lib/game-names";
import { getGameThumbnailUrl, getFallbackGameThumbnailUrl } from "@/lib/game-thumbnails";
import { buildBackendUrl } from "@/lib/backend-url";
import type { RomInfo } from "@/stores/useNetplayLobbyStore";

function GameDetailSkeleton() {
  return (
    <div className="flex w-full justify-center">
      <Card className="w-full max-w-2xl border-border/70 bg-card/95">
        <CardContent className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function GameDetailPage() {
  const [searchParams] = useSearchParams();
  const romPath = searchParams.get("rom");
  const core = searchParams.get("core");

  const [game, setGame] = useState<RomInfo | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  // 동기적 유효성 검사 — 렌더 단계에서 처리 (effect 내 setState 회피)
  const missingParams = !romPath || !core;
  const [loading, setLoading] = useState(!missingParams);

  useEffect(() => {
    if (missingParams) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(buildBackendUrl("/api/roms"));
        if (!response.ok) throw new Error("Failed to fetch ROMs");
        const roms: RomInfo[] = await response.json();
        if (cancelled) return;
        const matched = roms.find((r) => r.path === romPath && r.core === core);
        if (matched) {
          setGame(matched);
        } else {
          setFetchError("해당 게임을 찾을 수 없습니다.");
        }
      } catch {
        if (!cancelled) setFetchError("게임 정보를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [romPath, core, missingParams]);

  const error = missingParams ? "게임 정보가 없습니다." : fetchError;

  const displayName = game ? parseRomName(game.filename, game.core) : "";
  const category = game ? getRomCategory(game.filename, game.core) : "etc";
  const catInfo = CATEGORY_INFO[category];
  const thumbnailUrl = game ? getGameThumbnailUrl(game.filename, game.core) : null;
  const fallbackUrl = game ? getFallbackGameThumbnailUrl(game.filename, game.core) : "";
  const currentUrl = useMemo(() => typeof window !== "undefined" ? window.location.href : "", []);

  // SEO: 게임별 메타 태그
  usePageSeo({
    title: game ? displayName : "게임 찾기",
    description: game
      ? `${displayName} - ${catInfo.label} 장르의 레트로 아케이드 게임을 RTCADE에서 브라우저로 바로 플레이하세요.`
      : "RTCADE에서 레트로 게임을 찾아보세요.",
    noIndex: !game,
    ogImage: !imgError && thumbnailUrl ? thumbnailUrl : undefined,
  });

  if (loading) return <GameDetailSkeleton />;

  if (error || !game) {
    return (
      <div className="flex w-full justify-center">
        <Card className="w-full max-w-2xl border-border/70 bg-card/95">
          <CardHeader className="space-y-4">
            <Badge variant="secondary" className="w-fit text-[10px]">404</Badge>
            <div className="space-y-2">
              <CardTitle className="text-2xl">게임을 찾을 수 없습니다</CardTitle>
              <CardDescription className="text-sm leading-6">
                {error ?? "선택한 게임이 서버 ROM 목록에 존재하지 않습니다."}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Link to="/netplay">
              <Button variant="outline" className="gap-2">
                <ChevronRight className="size-4" />
                게임 목록으로 돌아가기
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const detailUrl = `/netplay?entry=create-room&romPath=${encodeURIComponent(game.path)}&core=${encodeURIComponent(game.core)}&visibility=public`;

  return (
    <div className="flex w-full justify-center">
      <Card className="w-full max-w-2xl border-border/70 bg-card/95">
        <CardHeader className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="w-fit text-[10px]">
              {catInfo.icon} {catInfo.label}
            </Badge>
            <Badge variant="outline" className="w-fit text-[10px]">
              {game.core.toUpperCase()}
            </Badge>
          </div>

          <div className="flex gap-4">
            {/* Thumbnail */}
            <div className="h-32 w-44 shrink-0 overflow-hidden rounded-lg bg-neutral-900">
              <img
                src={imgError || !thumbnailUrl ? fallbackUrl : thumbnailUrl}
                alt={displayName}
                className="h-full w-full object-cover"
                loading="eager"
                onError={() => setImgError(true)}
              />
            </div>

            <div className="flex flex-col justify-between">
              <div className="space-y-1">
                <CardTitle className="text-2xl">{displayName}</CardTitle>
                <CardDescription className="text-sm">
                  {game.filename.replace(/\.\w+$/, "")}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* SEO meta hidden (for crawlers) */}
          <div className="rounded-lg border border-border/70 bg-background/40 p-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 mb-2">
              <Gamepad2 className="size-4" />
              <span className="font-medium text-foreground">게임 정보</span>
            </div>
            <ul className="space-y-1 text-xs">
              <li>• 장르: {catInfo.label}</li>
              <li>• 코어: {game.core}</li>
              <li>• 파일: {game.filename}</li>
              {game.bios && <li>• BIOS: {game.bios}</li>}
            </ul>
          </div>

          {/* Structured data for SEO */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "VideoGame",
                name: displayName,
                applicationCategory: "GameApplication",
                operatingSystem: "Web Browser",
                genre: catInfo.label,
                gamePlatform: game.core.toUpperCase(),
                url: currentUrl,
                image: !imgError && thumbnailUrl ? thumbnailUrl : fallbackUrl,
                description: `${displayName} - ${catInfo.label} 장르의 레트로 아케이드 게임`,
              }),
            }}
          />

          {/* Play button */}
          <div className="flex gap-3">
            <Link to={detailUrl} className="flex-1">
              <Button className="w-full gap-2" size="lg">
                <Play className="size-5" />
                같이하기
              </Button>
            </Link>
            <Link to={`/netplay`} className="flex-1">
              <Button variant="outline" className="w-full gap-2" size="lg">
                <Gamepad2 className="size-5" />
                게임 목록
              </Button>
            </Link>
          </div>

          {/* Breadcrumb for SEO */}
          <nav aria-label="breadcrumb" className="text-xs text-muted-foreground">
            <ol className="flex items-center gap-1">
              <li><Link to="/" className="hover:text-foreground">RTCADE</Link></li>
              <li><ChevronRight className="size-3" /></li>
              <li><Link to="/netplay" className="hover:text-foreground">플레이</Link></li>
              <li><ChevronRight className="size-3" /></li>
              <li className="text-foreground">{displayName}</li>
            </ol>
          </nav>
        </CardContent>
      </Card>
    </div>
  );
}
