import { useEffect, useRef, useState } from "react";

import { AdFallbackCard } from "@/components/ads/AdFallbackCard";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

let adsenseLoaderPromise: Promise<void> | null = null;

function loadAdsenseScript(clientId: string) {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (adsenseLoaderPromise) {
    return adsenseLoaderPromise;
  }

  const existingScript = document.querySelector<HTMLScriptElement>(
    'script[data-rtcade-adsense="true"]',
  );

  if (existingScript) {
    adsenseLoaderPromise = Promise.resolve();
    return adsenseLoaderPromise;
  }

  adsenseLoaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.rtcadeAdsense = "true";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("adsense-load-failed"));
    document.head.appendChild(script);
  });

  return adsenseLoaderPromise;
}

interface GoogleAdsenseSlotProps {
  clientId?: string;
  placement: "left" | "right";
  slotId: string;
  testMode: boolean;
}

export function GoogleAdsenseSlot({ clientId, placement, slotId, testMode }: GoogleAdsenseSlotProps) {
  const insRef = useRef<HTMLModElement | null>(null);
  const initializedRef = useRef(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!clientId || !insRef.current || initializedRef.current) {
      return;
    }

    let cancelled = false;

    void loadAdsenseScript(clientId)
      .then(() => {
        if (cancelled || !insRef.current) {
          return;
        }

        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
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
  }, [clientId]);

  if (!clientId || loadFailed) {
    return (
      <AdFallbackCard
        title={placement === "left" ? "AdSense 광고 레일" : "AdSense 광고 레일"}
        description="AdSense 클라이언트 또는 슬롯 설정 전입니다. 환경변수를 채우면 이 영역에서 실제 광고 초기화를 시도합니다."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-[22px] border border-border/70 bg-card/90 p-3 shadow-sm shadow-primary/5">
      <ins
        ref={insRef}
        className="adsbygoogle block min-h-[600px] w-full overflow-hidden rounded-[18px] bg-background/60"
        data-ad-client={clientId}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-adtest={testMode ? "on" : undefined}
        data-full-width-responsive="false"
      />
    </div>
  );
}