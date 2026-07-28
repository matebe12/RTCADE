import { useEffect } from "react";

import NetplayLobby from "@/components/NetplayLobby";
import { usePageSeo } from "@/lib/seo";
import { useNetplayLobbyStore } from "@/stores/useNetplayLobbyStore";

export default function NetplayPage({ hasProfile }: { hasProfile: boolean }) {
  usePageSeo({
    title: "플레이",
    description:
      "같이하기와 혼자하기를 한곳에서 선택하고 서버 ROM으로 바로 레트로 게임을 시작하세요.",
  });

  const resetLobby = useNetplayLobbyStore((store) => store.resetLobby);

  useEffect(() => {
    return () => {
      resetLobby();
    };
  }, [resetLobby]);

  return (
    <div className="flex w-full flex-1 flex-col min-h-0">
      <NetplayLobby hasProfile={hasProfile} />
    </div>
  );
}
