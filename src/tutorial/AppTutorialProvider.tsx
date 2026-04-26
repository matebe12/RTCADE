import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { driver, type DriveStep, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { toast } from "sonner";

import { useNetplayLobbyStore } from "@/stores/useNetplayLobbyStore";
import { AppTutorialContext, type AppTutorialContextValue } from "@/tutorial/app-tutorial-context";

const APP_TUTORIAL_STORAGE_KEY = "rtcade_app_tutorial_v1";
const APP_TUTORIAL_VERSION = 4;
const AUTO_START_DELAY_MS = 700;

type TutorialStage =
  | "home-cta"
  | "netplay-modes"
  | "netplay-menu"
  | "netplay-create-room"
  | "waiting-room-solo"
  | "public-rooms"
  | "join-input"
  | "watch-rooms"
  | "spectate-code"
  | "solo-tab"
  | "solo-browse"
  | "solo-start-game"
  | "solo-controls"
  | "solo-emulator";

type TutorialProgress = {
  version: number;
  completedAt?: number;
  dismissedAt?: number;
};

interface AppTutorialProviderProps {
  blocked?: boolean;
  children: ReactNode;
}

function readTutorialProgress(): TutorialProgress | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(APP_TUTORIAL_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as TutorialProgress;
    if (parsed.version !== APP_TUTORIAL_VERSION) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeTutorialProgress(progress: TutorialProgress) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(APP_TUTORIAL_STORAGE_KEY, JSON.stringify(progress));
}

export function AppTutorialProvider({ blocked = false, children }: AppTutorialProviderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const mode = useNetplayLobbyStore((store) => store.mode);
  const lobbyStep = useNetplayLobbyStore((store) => store.state.step);
  const waitingRoomRole = useNetplayLobbyStore((store) =>
    store.state.step === "waiting" ? store.state.role : null,
  );
  const soloBrowseRomCount = useNetplayLobbyStore((store) =>
    store.state.step === "solo-browse" ? store.state.roms.length : 0,
  );
  const resetLobby = useNetplayLobbyStore((store) => store.resetLobby);

  const [progress, setProgress] = useState<TutorialProgress | null>(readTutorialProgress);
  const [activeStage, setActiveStage] = useState<TutorialStage | null>(null);
  const driverRef = useRef<Driver | null>(null);
  const shownStageRef = useRef<TutorialStage | null>(null);
  const autoStartedRef = useRef(false);

  const destroyDriver = useCallback(() => {
    driverRef.current?.destroy();
    driverRef.current = null;
    shownStageRef.current = null;
  }, []);

  const finishTutorial = useCallback(
    (reason: "completed" | "dismissed") => {
      destroyDriver();
      setActiveStage(null);

      const nextProgress: TutorialProgress = {
        version: APP_TUTORIAL_VERSION,
        ...(reason === "completed" ? { completedAt: Date.now() } : { dismissedAt: Date.now() }),
      };

      writeTutorialProgress(nextProgress);
      setProgress(nextProgress);

      if (reason === "completed") {
        toast.success("튜토리얼을 마쳤습니다. 설정에서 다시 볼 수 있습니다.");
        return;
      }

      toast("튜토리얼을 닫았습니다. 홈이나 설정에서 다시 시작할 수 있습니다.");
    },
    [destroyDriver],
  );

  const advanceTo = useCallback(
    (nextStage: TutorialStage, action?: () => void) => {
      destroyDriver();
      action?.();
      setActiveStage(nextStage);
    },
    [destroyDriver],
  );

  const startTutorial = useCallback(() => {
    destroyDriver();
    resetLobby();
    setActiveStage("home-cta");
    navigate("/");
  }, [destroyDriver, navigate, resetLobby]);

  const clickTutorialTarget = useCallback((selector: string) => {
    const element = document.querySelector(selector);

    if (!(element instanceof HTMLElement) || element.hasAttribute("disabled")) {
      return false;
    }

    element.click();
    return true;
  }, []);

  const navigateBackToNetplayMenu = useCallback(() => {
    switch (lobbyStep) {
      case "public-rooms":
        return clickTutorialTarget('[data-tutorial="public-rooms-back"]');
      case "join-input":
        return clickTutorialTarget('[data-tutorial="join-input-back"]');
      case "watch-rooms":
        return clickTutorialTarget('[data-tutorial="watch-rooms-back"]');
      case "spectate-input":
        return clickTutorialTarget('[data-tutorial="spectate-code-back"]');
      default:
        return false;
    }
  }, [clickTutorialTarget, lobbyStep]);

  const highlightStage = useCallback(
    (stage: TutorialStage, step: DriveStep) => {
      if (shownStageRef.current === stage && driverRef.current?.isActive()) {
        return true;
      }

      const element =
        typeof step.element === "string" ? document.querySelector(step.element) : null;
      if (typeof step.element === "string" && !element) {
        return false;
      }

      destroyDriver();

      const instance = driver({
        animate: true,
        allowClose: true,
        overlayOpacity: 0.72,
        smoothScroll: true,
        showButtons: ["next", "close"],
        nextBtnText: "다음",
        prevBtnText: "이전",
        doneBtnText: "완료",
        onCloseClick: () => finishTutorial("dismissed"),
      });

      driverRef.current = instance;
      shownStageRef.current = stage;
      instance.highlight(step);

      return true;
    },
    [destroyDriver, finishTutorial],
  );

  useEffect(() => {
    return () => {
      destroyDriver();
    };
  }, [destroyDriver]);

  useEffect(() => {
    if (blocked) {
      destroyDriver();
    }
  }, [blocked, destroyDriver]);

  useEffect(() => {
    if (blocked || activeStage !== "home-cta") {
      return;
    }

    if (location.pathname !== "/") {
      return;
    }

    highlightStage("home-cta", {
      element: '[data-tutorial="home-play-start"]',
      disableActiveInteraction: true,
      popover: {
        title: "플레이 시작",
        description:
          "여기서 전체 여정이 시작됩니다. 플레이 시작으로 전체 로비에 들어갈 수 있고, 홈의 인기 게임 스포트라이트에서는 공개방을 바로 만들 수도 있습니다.",
        nextBtnText: "로비 보기",
        showButtons: ["next", "close"],
        onNextClick: () => {
          advanceTo("netplay-menu", () => navigate("/netplay"));
        },
      },
    });
  }, [activeStage, advanceTo, blocked, highlightStage, location.pathname, navigate]);

  useEffect(() => {
    if (blocked || activeStage !== "netplay-modes") {
      return;
    }

    if (location.pathname !== "/netplay" || lobbyStep !== "menu") {
      return;
    }

    highlightStage("netplay-modes", {
      element: '[data-tutorial="netplay-mode-tabs"]',
      disableActiveInteraction: true,
      popover: {
        title: "로비 모드 선택",
        description:
          "같이하기는 방을 만들거나 참가하는 흐름이고, 혼자하기는 서버 ROM을 바로 실행하는 흐름입니다.",
        nextBtnText: "같이하기 보기",
        showButtons: ["next", "close"],
        onNextClick: () => advanceTo("netplay-menu"),
      },
    });
  }, [activeStage, advanceTo, blocked, highlightStage, lobbyStep, location.pathname]);

  useEffect(() => {
    if (blocked || activeStage !== "netplay-menu") {
      return;
    }

    if (location.pathname !== "/netplay" || lobbyStep !== "menu") {
      return;
    }

    highlightStage("netplay-menu", {
      element: '[data-tutorial="netplay-menu-actions"]',
      disableActiveInteraction: true,
      popover: {
        title: "로비 시작 동선",
        description:
          "직접 게임을 고를 때는 방 만들기로 들어가고, 이미 열린 방은 공개 방 둘러보기나 코드 참가로 들어갑니다. 관전하기는 이미 플레이 중인 방을 보는 흐름입니다.",
        nextBtnText: "방 만들기 보기",
        showButtons: ["next", "close"],
        onNextClick: () => advanceTo("netplay-create-room"),
      },
    });
  }, [activeStage, advanceTo, blocked, highlightStage, lobbyStep, location.pathname]);

  useEffect(() => {
    if (blocked || activeStage !== "netplay-create-room") {
      return;
    }

    if (location.pathname !== "/netplay") {
      return;
    }

    if (lobbyStep === "menu") {
      clickTutorialTarget('[data-tutorial="netplay-open-browse"]');
      return;
    }

    if (lobbyStep === "waiting" && waitingRoomRole === "host") {
      advanceTo("waiting-room-solo");
      return;
    }

    if (lobbyStep !== "browse") {
      return;
    }

    const highlightedPrimaryGame = highlightStage("netplay-create-room", {
      element: '[data-tutorial="netplay-primary-game"]',
      popover: {
        title: "게임 선택과 즉시 방 생성",
        description:
          "이 버튼을 누르면 확인 단계 없이 바로 새 방이 만들어지고 대기실로 이동합니다. 다음을 누르면 첫 게임으로 실제 방을 만들어 봅니다.",
        nextBtnText: "방 만들기",
        showButtons: ["next", "close"],
        onNextClick: () =>
          advanceTo("waiting-room-solo", () =>
            clickTutorialTarget('[data-tutorial="netplay-primary-game"]'),
          ),
      },
    });

    if (highlightedPrimaryGame) {
      return;
    }

    highlightStage("netplay-create-room", {
      element: '[data-tutorial="netplay-browse-panel"]',
      popover: {
        title: "게임 선택과 즉시 방 생성",
        description:
          "여기서는 게임 카드를 누르거나 썸네일 미리보기의 방 만들기를 눌러 바로 새 방을 만듭니다. 목록이 준비되면 첫 게임 카드에 바로 튜토리얼이 이어집니다.",
        showButtons: ["close"],
      },
    });
  }, [
    activeStage,
    advanceTo,
    blocked,
    clickTutorialTarget,
    highlightStage,
    lobbyStep,
    location.pathname,
    waitingRoomRole,
  ]);

  useEffect(() => {
    if (blocked || activeStage !== "waiting-room-solo") {
      return;
    }

    if (location.pathname !== "/netplay" || lobbyStep !== "waiting" || waitingRoomRole !== "host") {
      return;
    }

    highlightStage("waiting-room-solo", {
      element: '[data-tutorial="waiting-room-start"]',
      disableActiveInteraction: true,
      popover: {
        title: "대기실에서 바로 혼자 시작",
        description:
          "방장이 혼자 들어와 있으면 여기서 바로 혼자 시작을 눌러 solo 플레이로 전환할 수 있습니다. 다음을 누르면 실제로 혼자하기를 시작합니다.",
        nextBtnText: "혼자 시작",
        showButtons: ["next", "close"],
        onNextClick: () =>
          advanceTo("solo-controls", () => clickTutorialTarget('[data-tutorial="waiting-room-start"]')),
      },
    });
  }, [
    activeStage,
    advanceTo,
    blocked,
    clickTutorialTarget,
    highlightStage,
    lobbyStep,
    location.pathname,
    waitingRoomRole,
  ]);

  useEffect(() => {
    if (blocked || activeStage !== "public-rooms") {
      return;
    }

    if (location.pathname !== "/netplay") {
      return;
    }

    if (lobbyStep === "browse") {
      clickTutorialTarget('[data-tutorial="netplay-browse-back"]');
      return;
    }

    if (lobbyStep === "menu") {
      clickTutorialTarget('[data-tutorial="netplay-open-public-rooms"]');
      return;
    }

    if (lobbyStep !== "public-rooms") {
      return;
    }

    highlightStage("public-rooms", {
      element: '[data-tutorial="netplay-public-rooms-panel"]',
      disableActiveInteraction: true,
      popover: {
        title: "공개 방 둘러보기",
        description:
          "대기 중인 공개 방을 여기서 바로 확인합니다. 방이 없어도 빈 상태 메시지와 새로고침 흐름을 바로 볼 수 있습니다.",
        nextBtnText: "코드 참가 보기",
        showButtons: ["next", "close"],
        onNextClick: () => advanceTo("join-input"),
      },
    });
  }, [
    activeStage,
    advanceTo,
    blocked,
    clickTutorialTarget,
    highlightStage,
    lobbyStep,
    location.pathname,
  ]);

  useEffect(() => {
    if (blocked || activeStage !== "join-input") {
      return;
    }

    if (location.pathname !== "/netplay") {
      return;
    }

    if (lobbyStep === "public-rooms") {
      clickTutorialTarget('[data-tutorial="public-rooms-back"]');
      return;
    }

    if (lobbyStep === "menu") {
      clickTutorialTarget('[data-tutorial="netplay-open-join"]');
      return;
    }

    if (lobbyStep !== "join-input") {
      return;
    }

    highlightStage("join-input", {
      element: '[data-tutorial="netplay-join-input-panel"]',
      disableActiveInteraction: true,
      popover: {
        title: "코드로 방 참가",
        description:
          "공개 방이 아니어도 6자리 코드만 있으면 바로 참가할 수 있습니다. 초대형 플레이는 이 입력 화면을 통해 시작됩니다.",
        nextBtnText: "관전 목록 보기",
        showButtons: ["next", "close"],
        onNextClick: () => advanceTo("watch-rooms"),
      },
    });
  }, [
    activeStage,
    advanceTo,
    blocked,
    clickTutorialTarget,
    highlightStage,
    lobbyStep,
    location.pathname,
  ]);

  useEffect(() => {
    if (blocked || activeStage !== "watch-rooms") {
      return;
    }

    if (location.pathname !== "/netplay") {
      return;
    }

    if (lobbyStep === "join-input") {
      clickTutorialTarget('[data-tutorial="join-input-back"]');
      return;
    }

    if (lobbyStep === "menu") {
      clickTutorialTarget('[data-tutorial="netplay-open-watch-rooms"]');
      return;
    }

    if (lobbyStep !== "watch-rooms") {
      return;
    }

    highlightStage("watch-rooms", {
      element: '[data-tutorial="netplay-watch-rooms-panel"]',
      disableActiveInteraction: true,
      popover: {
        title: "플레이 중인 방 관전",
        description:
          "관전하기는 이미 게임이 시작된 방을 보는 흐름입니다. 공개 방이면 목록에서 바로 들어가고, 비공개 방이면 코드 관전을 씁니다.",
        nextBtnText: "코드 관전 보기",
        showButtons: ["next", "close"],
        onNextClick: () => advanceTo("spectate-code"),
      },
    });
  }, [
    activeStage,
    advanceTo,
    blocked,
    clickTutorialTarget,
    highlightStage,
    lobbyStep,
    location.pathname,
  ]);

  useEffect(() => {
    if (blocked || activeStage !== "spectate-code") {
      return;
    }

    if (location.pathname !== "/netplay") {
      return;
    }

    if (lobbyStep === "watch-rooms") {
      clickTutorialTarget('[data-tutorial="watch-rooms-open-code"]');
      return;
    }

    if (lobbyStep !== "spectate-input") {
      return;
    }

    highlightStage("spectate-code", {
      element: '[data-tutorial="netplay-spectate-code-panel"]',
      disableActiveInteraction: true,
      popover: {
        title: "코드로 관전",
        description:
          "비공개 방이나 목록에 아직 안 뜬 방은 코드로 바로 관전할 수 있습니다. 이렇게 같이하기와 관전하기의 핵심 진입점이 모두 연결됩니다.",
        nextBtnText: "튜토리얼 완료",
        showButtons: ["next", "close"],
        onNextClick: () => finishTutorial("completed"),
      },
    });
  }, [
    activeStage,
    blocked,
    clickTutorialTarget,
    finishTutorial,
    highlightStage,
    lobbyStep,
    location.pathname,
  ]);

  useEffect(() => {
    if (blocked || activeStage !== "solo-tab") {
      return;
    }

    if (location.pathname !== "/netplay") {
      return;
    }

    if (lobbyStep !== "menu") {
      navigateBackToNetplayMenu();
      return;
    }

    highlightStage("solo-tab", {
      element: '[data-tutorial="netplay-mode-solo"]',
      disableActiveInteraction: true,
      popover: {
        title: "실제로 혼자하기를 시작합니다",
        description:
          "다음 단계에서 혼자하기 탭으로 전환하고, 이어서 실제 게임을 한 번 실행해 보겠습니다.",
        nextBtnText: "혼자하기 열기",
        showButtons: ["next", "close"],
        onNextClick: () => {
          advanceTo("solo-browse", () => {
            const soloModeButton = document.querySelector('[data-tutorial="netplay-mode-solo"]');

            if (soloModeButton instanceof HTMLElement) {
              soloModeButton.click();
            }
          });
        },
      },
    });
  }, [
    activeStage,
    advanceTo,
    blocked,
    highlightStage,
    lobbyStep,
    location.pathname,
    navigateBackToNetplayMenu,
  ]);

  useEffect(() => {
    if (blocked || activeStage !== "solo-browse") {
      return;
    }

    if (location.pathname !== "/netplay" || lobbyStep !== "solo-browse" || mode !== "solo") {
      return;
    }

    highlightStage("solo-browse", {
      element: '[data-tutorial="solo-browse-panel"]',
      disableActiveInteraction: true,
      popover: {
        title: "혼자할 게임 선택",
        description:
          "최근 플레이, 즐겨찾기, 카테고리 필터를 보면서 원하는 게임을 고를 수 있습니다. 다음 단계에서 실제로 한 게임을 바로 실행합니다.",
        nextBtnText: "게임 고르기",
        showButtons: ["next", "close"],
        onNextClick: () => advanceTo("solo-start-game"),
      },
    });
  }, [activeStage, advanceTo, blocked, highlightStage, lobbyStep, location.pathname, mode]);

  useEffect(() => {
    if (blocked || activeStage !== "solo-start-game" || lobbyStep !== "solo-playing") {
      return;
    }

    const timerId = window.setTimeout(() => {
      advanceTo("solo-controls");
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [activeStage, advanceTo, blocked, lobbyStep]);

  useEffect(() => {
    if (blocked || activeStage !== "solo-start-game") {
      return;
    }

    if (lobbyStep === "solo-playing") {
      return;
    }

    if (
      location.pathname !== "/netplay" ||
      lobbyStep !== "solo-browse" ||
      mode !== "solo" ||
      soloBrowseRomCount === 0
    ) {
      return;
    }

    highlightStage("solo-start-game", {
      element: '[data-tutorial="solo-primary-game"]',
      popover: {
        title: "실제 게임 시작",
        description:
          "이 카드 중 하나를 누르면 실제 혼자하기 세션이 시작됩니다. 눌러서 에뮬레이터를 직접 띄워 보세요.",
        showButtons: ["close"],
      },
    });
  }, [
    activeStage,
    advanceTo,
    blocked,
    highlightStage,
    lobbyStep,
    location.pathname,
    mode,
    soloBrowseRomCount,
  ]);

  useEffect(() => {
    if (blocked || activeStage !== "solo-controls") {
      return;
    }

    if (location.pathname !== "/netplay" || lobbyStep !== "solo-playing") {
      return;
    }

    highlightStage("solo-controls", {
      element: '[data-tutorial="play-controls-guide"]',
      disableActiveInteraction: true,
      popover: {
        title: "조작법 먼저 확인",
        description:
          "혼자하기도 넷플레이와 같은 키 배치를 씁니다. 방향키와 기본 버튼 위치를 먼저 보고 게임 화면을 클릭하세요.",
        nextBtnText: "게임 화면 보기",
        showButtons: ["next", "close"],
        onNextClick: () => advanceTo("solo-emulator"),
      },
    });
  }, [activeStage, advanceTo, blocked, highlightStage, lobbyStep, location.pathname]);

  useEffect(() => {
    if (blocked || activeStage !== "solo-emulator") {
      return;
    }

    if (location.pathname !== "/netplay" || lobbyStep !== "solo-playing") {
      return;
    }

    highlightStage("solo-emulator", {
      element: '[data-tutorial="solo-emulator-stage"]',
      disableActiveInteraction: true,
      popover: {
        title: "실제 플레이 화면",
        description:
          "이제 실제 에뮬레이터가 실행 중입니다. 화면을 클릭한 뒤 바로 조작해 보세요. 튜토리얼은 여기서 끝납니다.",
        nextBtnText: "튜토리얼 완료",
        showButtons: ["next", "close"],
        onNextClick: () => finishTutorial("completed"),
      },
    });
  }, [activeStage, blocked, finishTutorial, highlightStage, lobbyStep, location.pathname]);

  useEffect(() => {
    if (
      blocked ||
      activeStage !== null ||
      progress ||
      autoStartedRef.current ||
      location.pathname !== "/"
    ) {
      return;
    }

    autoStartedRef.current = true;

    const timerId = window.setTimeout(() => {
      setActiveStage("home-cta");
    }, AUTO_START_DELAY_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [activeStage, blocked, location.pathname, progress]);

  const value = useMemo<AppTutorialContextValue>(
    () => ({
      isActive: activeStage !== null,
      startTutorial,
    }),
    [activeStage, startTutorial],
  );

  return <AppTutorialContext.Provider value={value}>{children}</AppTutorialContext.Provider>;
}
