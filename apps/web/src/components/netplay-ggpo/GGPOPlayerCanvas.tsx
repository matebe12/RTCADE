/**
 * GGPOPlayerCanvas — FBNeo 렌더링용 Canvas 컴포넌트
 *
 * ArcadeWrapper의 프레임 버퍼를 Canvas에 렌더링한다.
 * requestAnimationFrame 루프와 연동하여 매 프레임마다 갱신.
 */

import { useEffect, useRef } from "react";
import type { IArcade } from "@rtcade/emulator";
import { renderFrameToCanvas, fitCanvasToContainer } from "@rtcade/emulator";

interface GGPOPlayerCanvasProps {
  arcade: IArcade | null;
  className?: string;
}

export function GGPOPlayerCanvas({ arcade, className }: GGPOPlayerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!arcade) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const gameInfo = arcade.gameInfo;
    if (!gameInfo) return;

    // 캔버스 크기 조정
    fitCanvasToContainer(canvas, gameInfo.width, gameInfo.height);

    // 렌더링 루프
    const render = () => {
      const frameBuffer = arcade.getFrameBuffer();
      if (frameBuffer.length > 0) {
        renderFrameToCanvas(canvas, frameBuffer, arcade.width, arcade.height, {
          smooth: false,
          autoResize: false,
        });
      }
      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [arcade]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        display: "block",
        imageRendering: "pixelated",
        backgroundColor: "#000",
      }}
    />
  );
}