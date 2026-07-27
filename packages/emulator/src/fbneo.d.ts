/**
 * @mantou/fbneo 모듈 타입 선언
 *
 * .wasm?url import는 Vite에서 처리되므로 문자열 타입으로 선언한다.
 * init() 함수는 Emscripten 모듈을 반환한다.
 */

declare module "@mantou/fbneo/fbneo-arcade" {
  import type { FBNeoInitFn } from "./types";
  const init: FBNeoInitFn;
  export default init;
}

declare module "@mantou/fbneo/fbneo-neogeo" {
  import type { FBNeoInitFn } from "./types";
  const init: FBNeoInitFn;
  export default init;
}

declare module "@mantou/fbneo/fbneo-konami" {
  import type { FBNeoInitFn } from "./types";
  const init: FBNeoInitFn;
  export default init;
}

declare module "*.wasm?url" {
  const url: string;
  export default url;
}