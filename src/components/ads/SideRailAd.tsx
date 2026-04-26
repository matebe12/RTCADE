import { useEffect, useState } from "react";

import { AdDisclosure } from "@/components/ads/AdDisclosure";
import { AdSlot } from "@/components/ads/AdSlot";
import { appEnvironment } from "@/config/environment";
import { cn } from "@/lib/utils";

interface SideRailAdProps {
  placement: "left" | "right";
  visible: boolean;
}

export function SideRailAd({ placement, visible }: SideRailAdProps) {
  const [meetsBreakpoint, setMeetsBreakpoint] = useState(false);
  const minWidth =
    placement === "left"
      ? appEnvironment.sideAds.desktopMinWidth
      : appEnvironment.sideAds.rightRailMinWidth;

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia(`(min-width: ${minWidth}px)`);
    const updateVisibility = () => setMeetsBreakpoint(mediaQuery.matches);

    updateVisibility();
    mediaQuery.addEventListener("change", updateVisibility);

    return () => {
      mediaQuery.removeEventListener("change", updateVisibility);
    };
  }, [minWidth]);

  if (!visible || !meetsBreakpoint) {
    return null;
  }

  const slotId =
    placement === "left" ? appEnvironment.sideAds.leftSlotId : appEnvironment.sideAds.rightSlotId;

  return (
    <aside
      aria-label={placement === "left" ? "좌측 광고 레일" : "우측 광고 레일"}
      className={cn("hidden shrink-0 xl:block", placement === "left" ? "w-[180px] 2xl:w-[200px]" : "w-[180px]")}
    >
      <div className="sticky top-28 flex flex-col gap-3">
        <AdDisclosure text={appEnvironment.sideAds.disclosureText} />
        <AdSlot placement={placement} provider={appEnvironment.sideAds.provider} slotId={slotId} />
      </div>
    </aside>
  );
}