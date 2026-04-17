import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import NetplayLobby from "@/components/NetplayLobby";
import { NETPLAY_HERO_COPY } from "@/netplay/netplayCopy";
import { useNetplayLobbyStore } from "@/stores/useNetplayLobbyStore";

export default function NetplayPage() {
  const currentStep = useNetplayLobbyStore((store) => store.state.step);
  const showHeroCard = currentStep === "menu";

  return (
    <div className="flex w-full flex-col gap-6">
      <div
        className={
          showHeroCard
            ? "grid w-full gap-4 lg:grid-cols-[0.8fr_1.2fr] lg:items-start"
            : "flex justify-center"
        }
      >
        {showHeroCard && (
          <Card className="w-full border-border/70 bg-card/95 lg:sticky lg:top-6">
            <CardHeader className="space-y-4">
              <Badge variant="secondary" className="w-fit text-[10px]">
                {NETPLAY_HERO_COPY.badge}
              </Badge>
              <div className="space-y-2">
                <CardTitle className="text-2xl">{NETPLAY_HERO_COPY.title}</CardTitle>
                <CardDescription className="text-sm leading-6">
                  {NETPLAY_HERO_COPY.description}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {NETPLAY_HERO_COPY.highlights.map((highlight) => (
                <div
                  key={highlight}
                  className="rounded-lg border border-border/70 bg-background/40 p-4"
                >
                  {highlight}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="min-w-0">
          <NetplayLobby />
        </div>
      </div>
    </div>
  );
}
