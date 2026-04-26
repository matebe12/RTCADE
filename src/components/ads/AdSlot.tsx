import { appEnvironment, type AdProvider } from "@/config/environment";
import { AdFallbackCard } from "@/components/ads/AdFallbackCard";
import { CoupangPartnersSlot } from "@/components/ads/providers/CoupangPartnersSlot";
import { GoogleAdsenseSlot } from "@/components/ads/providers/GoogleAdsenseSlot";

interface AdSlotProps {
  placement: "left" | "right";
  provider: AdProvider;
  slotId: string;
}

export function AdSlot({ placement, provider, slotId }: AdSlotProps) {
  switch (provider) {
    case "coupang":
      return (
        <CoupangPartnersSlot
          placement={placement}
          slotId={slotId}
          trackingCode={appEnvironment.sideAds.coupangTrackingCode}
          subId={appEnvironment.sideAds.coupangSubId}
          template={appEnvironment.sideAds.coupangTemplate}
          width={appEnvironment.sideAds.coupangRailWidth}
          height={appEnvironment.sideAds.coupangRailHeight}
        />
      );
    case "adsense":
      return (
        <GoogleAdsenseSlot
          placement={placement}
          slotId={slotId}
          clientId={appEnvironment.sideAds.adsenseClientId}
          testMode={appEnvironment.sideAds.adsenseTestMode}
        />
      );
    case "placeholder":
      return (
        <AdFallbackCard
          title={placement === "left" ? "사이드 광고 레일" : "스폰서 레일"}
          description="광고 레이아웃 검증용 placeholder 영역입니다. 운영 전에는 provider와 slot 설정으로 실제 광고 네트워크를 연결하세요."
        />
      );
    default:
      return null;
  }
}