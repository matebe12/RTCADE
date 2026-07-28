import { useState, useEffect } from "react";

/**
 * 모바일 터치 기기 + 좁은 뷰포트 여부를 감지하는 hook.
 *
 * NetplayPage.tsx의 기존 `detectMobileAccess()` 로직을 재사용 가능한
 * hook으로 추출한 것이다. matchMedia 리스너를 통해 반응형으로 업데이트된다.
 */
export function useMobileDetect(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return detectMobileAccess();
  });

  useEffect(() => {
    const update = () => setIsMobile(detectMobileAccess());

    const pointerQuery = window.matchMedia("(pointer: coarse)");
    const widthQuery = window.matchMedia("(max-width: 1023px)");

    // 초기값 재확인 (hydration safety)
    update();

    pointerQuery.addEventListener("change", update);
    widthQuery.addEventListener("change", update);

    return () => {
      pointerQuery.removeEventListener("change", update);
      widthQuery.removeEventListener("change", update);
    };
  }, []);

  return isMobile;
}

function detectMobileAccess(): boolean {
  if (typeof window === "undefined") return false;

  const touchDevice = window.matchMedia("(pointer: coarse)").matches;
  const narrowViewport = window.matchMedia("(max-width: 1023px)").matches;
  const mobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );

  return narrowViewport && (touchDevice || mobileUserAgent);
}
