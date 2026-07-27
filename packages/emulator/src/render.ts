/**
 * Canvas 렌더링 유틸리티
 *
 * FBNeo의 RGBA 프레임 버퍼(Uint8ClampedArray)를
 * HTML Canvas에 렌더링한다.
 */

/**
 * Canvas에 RGBA 프레임 버퍼를 렌더링한다.
 * ImageData를 사용해 한 번에 픽셀 데이터를 기록한다.
 *
 * @param canvas 대상 Canvas 요소
 * @param frameBuffer RGBA 픽셀 데이터 (Uint8ClampedArray, width*height*4)
 * @param width 프레임 너비
 * @param height 프레임 높이
 * @param options 렌더링 옵션
 */
export function renderFrameToCanvas(
  canvas: HTMLCanvasElement,
  frameBuffer: Uint8ClampedArray,
  width: number,
  height: number,
  options: {
    /** 부드러운 보간 사용 (기본: false, 픽셀 아트에 적합) */
    smooth?: boolean;
    /** 캔버스 크기 자동 조정 여부 */
    autoResize?: boolean;
  } = {},
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // 캔버스 크기 조정
  if (options.autoResize !== false) {
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  // 이미지 스무딩 설정
  ctx.imageSmoothingEnabled = options.smooth ?? false;

  // ImageData 생성 및 픽셀 데이터 복사
  const imageData = new ImageData(width, height);
  imageData.data.set(frameBuffer);
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Canvas 크기를 컨테이너에 맞게 조정한다.
 * 게임의 원본 비율을 유지하면서 가능한 최대 크기로 표시한다.
 *
 * @param canvas 대상 Canvas 요소
 * @param gameWidth 게임 원본 너비
 * @param gameHeight 게임 원본 높이
 * @param container 부모 컨테이너 (기본: canvas.parentElement)
 */
export function fitCanvasToContainer(
  canvas: HTMLCanvasElement,
  gameWidth: number,
  gameHeight: number,
  container?: HTMLElement | null,
): { scale: number; offsetX: number; offsetY: number } {
  const parent = container ?? canvas.parentElement;
  if (!parent) return { scale: 1, offsetX: 0, offsetY: 0 };

  const maxWidth = parent.clientWidth;
  const maxHeight = parent.clientHeight;

  const scaleX = maxWidth / gameWidth;
  const scaleY = maxHeight / gameHeight;
  const scale = Math.min(scaleX, scaleY, 4); // 최대 4배까지

  const displayWidth = Math.floor(gameWidth * scale);
  const displayHeight = Math.floor(gameHeight * scale);

  // 내부 해상도 (게임 원본) — 이것이 안 맞으면 화면이 짤린다
  canvas.width = gameWidth;
  canvas.height = gameHeight;

  // CSS 표시 크기
  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;
  canvas.style.position = "absolute";
  canvas.style.left = "50%";
  canvas.style.top = "50%";
  canvas.style.transform = "translate(-50%, -50%)";

  return { scale, offsetX: 0, offsetY: 0 };
}

/**
 * 소스 Canvas를 타겟(오프스크린) Canvas에 nearest-neighbor 정수 배율로 업스케일한다.
 * WebRTC 스트리밍용 — captureStream()이 더 높은 내부 해상도로 캡처할 수 있도록 한다.
 *
 * Neo Geo 304x224 → 3x = 912x672 (H264 매크로블록 57x42개 vs 네이티브 19x14개)
 *
 * @param target   업스케일된 결과를 그릴 타겟 Canvas (첫 호출 시 크기 설정)
 * @param source   네이티브 해상도로 렌더링된 소스 Canvas
 * @param srcWidth   소스 너비
 * @param srcHeight  소스 높이
 * @param scale      정수 배율 (예: 3 → 3배)
 */
export function renderUpscaledFrame(
  target: HTMLCanvasElement,
  source: HTMLCanvasElement,
  srcWidth: number,
  srcHeight: number,
  scale: number,
): void {
  const upWidth = srcWidth * scale;
  const upHeight = srcHeight * scale;
  if (target.width !== upWidth || target.height !== upHeight) {
    target.width = upWidth;
    target.height = upHeight;
  }
  const ctx = target.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0, upWidth, upHeight);
}

/**
 * 빈 Canvas 초기화 (검은색으로 채움)
 */
export function clearCanvas(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}