/**
 * VirtualGamepad — 모바일 터치용 가상 게임패드
 *
 * nipplejs v1.0의 static D-Pad + 커스텀 React 액션 버튼으로 구성된다.
 * 데스크톱에서는 `visible=false`로 렌더링되지 않으며, 모바일에서만 표시된다.
 *
 * 모든 입력은 `onLocalInput(buttonIndex: 0-11, down: boolean)` 콜백으로 전달된다.
 * 이는 기존 키보드 입력 시스템과 동일한 인터페이스다.
 */
import { useEffect, useRef, useState } from "react";
import nipplejs from "nipplejs";

/* ------------------------------------------------------------------ */
/*  Button definitions                                                  */
/* ------------------------------------------------------------------ */

/** nipplejs plain 방향 → 버튼 인덱스 */
const DIR_TO_BUTTON: Record<string, number> = {
  up: 4,
  down: 5,
  left: 6,
  right: 7,
};

/** 액션 버튼 정의 */
interface ActionButtonDef {
  label: string;
  btn: number;
  /** 'top' | 'action' */
  group: "top" | "action";
  /** action 그룹 내 위치 (0-based), top 그룹은 순서대로 */
  col?: number;
  row?: number;
}

/** 상단 보조 버튼 (왼→오 순서) */
const TOP_BUTTONS: ActionButtonDef[] = [
  { label: "COIN", btn: 2, group: "top" },    // Select
  { label: "START", btn: 3, group: "top" },   // Start
  { label: "L", btn: 10, group: "top" },      // B5
  { label: "R", btn: 11, group: "top" },      // B6
];

/** 액션 버튼 2×2 그리드 */
const ACTION_GRID: ActionButtonDef[] = [
  { label: "A", btn: 0, group: "action", col: 0, row: 0 },  // B1
  { label: "S", btn: 8, group: "action", col: 1, row: 0 },  // B2
  { label: "D", btn: 1, group: "action", col: 0, row: 1 },  // B3
  { label: "F", btn: 9, group: "action", col: 1, row: 1 },  // B4
];

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface VirtualGamepadProps {
  /** 버튼 입력 콜백 (기존 키보드 시스템과 동일 인터페이스) */
  onLocalInput: (button: number, down: boolean) => void;
  /** false면 터치 영역이 렌더링되지만 입력은 무시됨 (게임 시작 전) */
  active?: boolean;
  /** 가로모드 최대화: 좌우 fixed 패널로 D-Pad와 버튼을 분산 배치 */
  landscape?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function VirtualGamepad({
  onLocalInput,
  active = true,
  landscape = false,
}: VirtualGamepadProps) {
  /* ---- refs ---- */
  const dpadZoneRef = useRef<HTMLDivElement>(null);
  const nippleRef = useRef<ReturnType<typeof nipplejs.create> | null>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);
  const heldDirectionsRef = useRef<Set<number>>(new Set());
  const buttonTouchIdsRef = useRef<Map<number, number>>(new Map());
  const onLocalInputRef = useRef(onLocalInput);
  const activeRef = useRef(active);
  onLocalInputRef.current = onLocalInput;
  activeRef.current = active;

  /* ---- Theme tracking for D-Pad colors ---- */
  const [isDark, setIsDark] = useState(() =>
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : false,
  );

  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(el.classList.contains("dark"));
    });
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  /* ---- D-Pad: nipplejs static mode ---- */
  useEffect(() => {
    const zone = dpadZoneRef.current;
    if (!zone) return undefined;

    // 테마 감지: 라이트 모드에서는 어두운 색, 다크 모드에서는 밝은 색
    const dpadColor = isDark
      ? { back: "rgba(255,255,255,0.1)", front: "rgba(255,255,255,0.3)" }
      : { back: "rgba(0,0,0,0.08)", front: "rgba(0,0,0,0.2)" };

    const collection = nipplejs.create({
      zone,
      mode: "static",
      position: { top: "50%", left: "50%" },
      size: 100,
      threshold: 0.35,
      color: dpadColor,
      restJoystick: true,
      restOpacity: 0.5,
      fadeTime: 100,
      shape: "circle",
      dynamicPage: true,
    });

    nippleRef.current = collection;

    // D-Pad 영역 위치 변경 시 재계산 (전체화면 전환 등으로 부모 크기 변화)
    const resizeObserver = new ResizeObserver(() => {
      collection.reposition();
    });
    // zone 자체와 부모 양쪽 관찰
    resizeObserver.observe(zone);
    if (zone.parentElement) resizeObserver.observe(zone.parentElement);

    // 축 우선(axis locking): Metal Slug 같은 게임에서 실수로 상하 입력 방지
    // abs(dominant) > abs(weak) * 1.8 이면 dominant 축만 트리거
    const AXIS_LOCK_RATIO = 1.8;

    const computeDirs = (vx: number, vy: number): Set<number> => {
      const dirs = new Set<number>();
      const absX = Math.abs(vx);
      const absY = Math.abs(vy);

      const onlyX = absX > absY * AXIS_LOCK_RATIO;
      const onlyY = absY > absX * AXIS_LOCK_RATIO;

      if ((onlyX || !onlyY) && vx < 0) dirs.add(DIR_TO_BUTTON.left);
      if ((onlyX || !onlyY) && vx > 0) dirs.add(DIR_TO_BUTTON.right);
      // nipplejs vector.y: 양수=위, 음수=아래 (게임 좌표계)
      if ((onlyY || !onlyX) && vy > 0) dirs.add(DIR_TO_BUTTON.up);
      if ((onlyY || !onlyX) && vy < 0) dirs.add(DIR_TO_BUTTON.down);

      return dirs;
    };

    const handleMove = (evt: { data: { vector?: { x: number; y: number }; force?: number } }) => {
      if (!activeRef.current) return;
      const v = evt.data?.vector;
      const force = evt.data?.force ?? 0;
      if (!v || force < 0.15) return;

      const newDirs = computeDirs(v.x, v.y);
      const held = heldDirectionsRef.current;

      for (const btn of held) {
        if (!newDirs.has(btn)) onLocalInputRef.current(btn, false);
      }
      for (const btn of newDirs) {
        if (!held.has(btn)) onLocalInputRef.current(btn, true);
      }

      heldDirectionsRef.current = newDirs;
    };

    const handleEnd = () => {
      const held = heldDirectionsRef.current;
      for (const btn of held) {
        onLocalInputRef.current(btn, false);
      }
      held.clear();
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (collection as any).on("move", handleMove);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (collection as any).on("end", handleEnd);

    return () => {
      resizeObserver.disconnect();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (collection as any).off("move", handleMove);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (collection as any).off("end", handleEnd);
      collection.destroy();
      nippleRef.current = null;
    };
  }, [isDark, landscape]); // recreate D-Pad on theme change or landscape mode switch

  /* ---- Action buttons: native event binding (passive:false 필요) ---- */
  useEffect(() => {
    const el = buttonsRef.current;
    if (!el) return undefined;

    const getBtnEl = (target: EventTarget | null): HTMLElement | null => {
      if (!(target instanceof HTMLElement)) return null;
      return target.closest<HTMLElement>("[data-btn]");
    };

    const shouldIgnore = (): boolean => {
      if (!activeRef.current) return true;
      const ae = document.activeElement;
      if (
        ae &&
        (ae.tagName === "INPUT" ||
          ae.tagName === "TEXTAREA" ||
          (ae as HTMLElement).isContentEditable)
      ) {
        return true;
      }
      return false;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (shouldIgnore()) return;
      e.preventDefault();

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const btnEl = getBtnEl(touch.target);
        if (!btnEl) continue;
        const raw = btnEl.dataset.btn;
        const btn = raw != null ? Number(raw) : null;
        if (btn === null) continue;
        buttonTouchIdsRef.current.set(touch.identifier, btn);
        btnEl.classList.add("action-btn--pressed");
        onLocalInputRef.current(btn, true);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const btn = buttonTouchIdsRef.current.get(touch.identifier);
        if (btn !== undefined) {
          buttonTouchIdsRef.current.delete(touch.identifier);
          // find button element and remove pressed class
          const btnEl = el.querySelector<HTMLElement>(`[data-btn="${btn}"]`);
          btnEl?.classList.remove("action-btn--pressed");
          onLocalInputRef.current(btn, false);
        }
      }
    };

    el.addEventListener("touchstart", handleTouchStart, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: false });
    el.addEventListener("touchcancel", handleTouchEnd, { passive: false });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchend", handleTouchEnd);
      el.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [landscape]); // re-attach listeners when landscape mode switches DOM element

  /* ---- Global blur/visibility release ---- */
  useEffect(() => {
    const releaseAll = () => {
      // release D-Pad directions
      const held = heldDirectionsRef.current;
      for (const btn of held) {
        onLocalInputRef.current(btn, false);
      }
      held.clear();

      // release action buttons
      const btnMap = buttonTouchIdsRef.current;
      const btnsEl = buttonsRef.current;
      for (const [, btn] of btnMap) {
        onLocalInputRef.current(btn, false);
        btnsEl?.querySelector<HTMLElement>(`[data-btn="${btn}"]`)?.classList.remove("action-btn--pressed");
      }
      btnMap.clear();
    };

    window.addEventListener("blur", releaseAll);
    const handleVisibility = () => {
      if (document.hidden) releaseAll();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("blur", releaseAll);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  /* ---- Landscape render: 좌우 fixed 패널 ---- */
  if (landscape) {
    return (
      <>
        {/* Left panel: L button + D-Pad */}
        <div
          className="fixed left-0 top-0 bottom-0 z-40 flex flex-col items-center justify-center gap-4 bg-black pointer-events-auto"
          style={{ width: "var(--gamepad-panel-width, 160px)", touchAction: "manipulation" }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* L button (above D-Pad) */}
          <button
            type="button"
            data-btn={11}
            style={{ touchAction: "none" }}
            className="action-btn action-btn--lr"
            onTouchStart={(e) => {
              e.preventDefault();
              if (!activeRef.current) return;
              (e.currentTarget as HTMLElement).classList.add("action-btn--pressed");
              onLocalInputRef.current(11, true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              (e.currentTarget as HTMLElement).classList.remove("action-btn--pressed");
              onLocalInputRef.current(11, false);
            }}
            onTouchCancel={(e) => {
              (e.currentTarget as HTMLElement).classList.remove("action-btn--pressed");
              onLocalInputRef.current(11, false);
            }}
          >
            L
          </button>
          <div
            ref={dpadZoneRef}
            className="relative shrink-0"
            style={{ width: 100, height: 100 }}
          />
        </div>

        {/* Right panel: R button + COIN/START + Action buttons */}
        <div
          ref={buttonsRef}
          className="fixed right-0 top-0 bottom-0 z-40 flex flex-col items-center justify-center gap-4 bg-black pointer-events-auto"
          style={{ width: "var(--gamepad-panel-width, 160px)", touchAction: "manipulation" }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* R button (above everything) */}
          <button
            type="button"
            data-btn={10}
            style={{ touchAction: "none" }}
            className="action-btn action-btn--lr"
          >
            R
          </button>

          {/* COIN, START (small) */}
          <div className="flex gap-2">
            <button
              type="button"
              data-btn={2}
              style={{ touchAction: "none" }}
              className="action-btn action-btn--small"
            >
              COIN
            </button>
            <button
              type="button"
              data-btn={3}
              style={{ touchAction: "none" }}
              className="action-btn action-btn--small"
            >
              START
            </button>
          </div>

          {/* Action buttons: A S / D F 2×2 grid */}
          <div
            className="grid shrink-0 gap-2"
            style={{
              gridTemplateColumns: "repeat(2, 52px)",
              gridTemplateRows: "repeat(2, 52px)",
            }}
          >
            {ACTION_GRID.map((def) => (
              <button
                key={def.btn}
                type="button"
                data-btn={def.btn}
                style={{
                  gridRow: (def.row ?? 0) + 1,
                  gridColumn: (def.col ?? 0) + 1,
                  touchAction: "none",
                }}
                className="action-btn"
              >
                {def.label}
              </button>
            ))}
          </div>
        </div>
      </>
    );
  }

  /* ---- Default render (세로모드) ---- */
  return (
    <div
      className="virtual-gamepad flex w-full select-none items-center justify-between px-3"
      onContextMenu={(e) => e.preventDefault()}
      style={{ touchAction: "manipulation" }}
    >
      {/* ── D-Pad zone (left) ── */}
      <div
        ref={dpadZoneRef}
        className="relative shrink-0"
        style={{ width: 100, height: 100 }}
      />

      {/* ── Button area (right) — native touch events via ref ── */}
      <div ref={buttonsRef} className="flex shrink-0 flex-col items-end gap-4 mr-2">
        {/* Top row: COIN, START, L, R */}
        <div className="flex gap-2.5">
          {TOP_BUTTONS.map((def) => (
            <button
              key={def.btn}
              type="button"
              data-btn={def.btn}
              style={{ touchAction: "none" }}
              className="action-btn action-btn--small"
            >
              {def.label}
            </button>
          ))}
        </div>

        {/* Action buttons: A S / D F 2×2 grid */}
        <div
          className="grid shrink-0 gap-2.5"
          style={{
            gridTemplateColumns: "repeat(2, 56px)",
            gridTemplateRows: "repeat(2, 56px)",
          }}
        >
          {ACTION_GRID.map((def) => (
            <button
              key={def.btn}
              type="button"
              data-btn={def.btn}
              style={{
                gridRow: (def.row ?? 0) + 1,
                gridColumn: (def.col ?? 0) + 1,
                touchAction: "none",
              }}
              className="action-btn"
            >
              {def.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
