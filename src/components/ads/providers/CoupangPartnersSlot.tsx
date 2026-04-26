import { useEffect, useRef, useState } from "react";

import { AdFallbackCard } from "@/components/ads/AdFallbackCard";

declare global {
  interface Window {
    PartnersCoupang?: {
      G: new (options: {
        height: string;
        id: number;
        subId: string | null;
        template: string;
        trackingCode: string;
        width: string;
      }) => unknown;
    };
  }
}

let coupangLoaderPromise: Promise<void> | null = null;

function loadCoupangScript() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (coupangLoaderPromise) {
    return coupangLoaderPromise;
  }

  const existingScript = document.querySelector<HTMLScriptElement>(
    'script[data-rtcade-coupang="true"]',
  );

  if (existingScript) {
    coupangLoaderPromise = Promise.resolve();
    return coupangLoaderPromise;
  }

  coupangLoaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.dataset.rtcadeCoupang = "true";
    script.src = "https://ads-partners.coupang.com/g.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("coupang-load-failed"));
    document.head.appendChild(script);
  });

  return coupangLoaderPromise;
}

interface CoupangPartnersSlotProps {
  height: number;
  placement: "left" | "right";
  slotId: string;
  subId?: string;
  template: string;
  trackingCode?: string;
  width: number;
}

export function CoupangPartnersSlot({
  height,
  placement,
  slotId,
  subId,
  template,
  trackingCode,
  width,
}: CoupangPartnersSlotProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const initializedRef = useRef(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const numericSlotId = Number.parseInt(slotId, 10);
  const hasConfig = Number.isFinite(numericSlotId) && !!trackingCode;

  useEffect(() => {
    if (!hasConfig || !containerRef.current || initializedRef.current) {
      return;
    }

    let cancelled = false;

    void loadCoupangScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.PartnersCoupang?.G) {
          return;
        }

        containerRef.current.replaceChildren();

        const inlineScript = document.createElement("script");
        inlineScript.text = `new PartnersCoupang.G(${JSON.stringify({
          id: numericSlotId,
          trackingCode,
          subId: subId ?? null,
          template,
          width: String(width),
          height: String(height),
        })});`;

        containerRef.current.appendChild(inlineScript);
        initializedRef.current = true;
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hasConfig, height, numericSlotId, subId, template, trackingCode, width]);

  if (!hasConfig || loadFailed) {
    return (
      <AdFallbackCard
        title={placement === "left" ? "쿠팡 광고 레일" : "쿠팡 추천 레일"}
        description={`쿠팡 파트너스 슬롯(${slotId}) 연결 전입니다. tracking code와 숫자 슬롯 id를 환경변수로 채우면 이 영역에서 실제 광고 렌더링을 시도합니다.`}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-[22px] border border-border/70 bg-card/90 p-3 shadow-sm shadow-primary/5">
      <div
        ref={containerRef}
        className="min-h-[600px] w-full overflow-hidden rounded-[18px] bg-background/60"
      />
    </div>
  );
}