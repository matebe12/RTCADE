# RTCADE 웹 전용 EmulatorJS 넷플레이 재설계 초안

## 1. 문서 목적

이 문서는 RTCADE 넷플레이를 **웹만으로**, 그리고 **EmulatorJS를 유지한 채** 재설계하기 위한 초안이다.

기존 초안은 FightCade급 롤백 넷코드를 기준으로 런타임 교체와 데스크톱 셸까지 포함한 큰 재설계를 전제로 했다. 하지만 이번 방향은 다음 제약을 고정한다.

- 웹만 사용
- EmulatorJS 유지
- React/Vite + Express 구조 유지
- 서버는 계속 시그널링만 담당

즉, 목표는 “FightCade와 완전히 같은 구조”가 아니라 **EmulatorJS가 허용하는 범위 안에서 웹 넷플레이 품질을 최대한 끌어올리는 것**이다.

---

## 2. EmulatorJS 문서/소스 조사 요약

이번 재설계 초안은 EmulatorJS 공식 문서와 소스 공개 내용을 기준으로 정리했다.

### 2.1 공식 문서에서 확인된 점

1. EmulatorJS의 목표는 기본적으로 **웹사이트에 에뮬레이터를 embed**하는 것이다.
2. React / SPA에서는 공식 문서상 **iframe 사용이 사실상 필수**다.
3. FAQ 기준으로 **공식 netplay는 아직 지원되지 않는다**.
4. 문서에서 공개된 설정값/콜백/UI 표면은 생각보다 넓다.
5. `EJS_threads = true`는 성능 향상 가능성이 있지만, `SharedArrayBuffer`와 COOP/COEP 헤더가 필요하다.
6. `EJS_startOnLoaded = true`는 가능하지만, 사용자 상호작용이 없으면 멈춘 것처럼 보일 수 있다고 문서에 명시되어 있다.

공식 문서 기준으로 확인된 public surface 예시는 다음과 같다.

- lifecycle: `EJS_ready`, `EJS_onGameStart`
- save/load hooks: `EJS_onSaveState`, `EJS_onLoadState`, `EJS_onSaveUpdate`
- UI/toolbar: `EJS_Buttons`, `EJS_startButtonName`
- 입력/설정: `EJS_defaultControls`, `EJS_defaultOptions`
- 언어/로컬라이징: `EJS_language`, `EJS_disableAutoLang`
- 런타임/경로: `EJS_paths`, `EJS_threads`, `EJS_cacheConfig`, `EJS_externalFiles`, `EJS_fixedSaveInterval`, `EJS_loadStateURL`

즉, **공개 API가 거의 없다**기보다, **넷플레이에 필요한 정밀 runtime control public API가 부족하다**고 보는 편이 정확하다.

### 2.2 `translate` 페이지 해석

`https://emulatorjs.org/translate`는 API 문서라기보다 EmulatorJS UI 문자열과 기능 표면을 보여주는 자료에 가깝다.

여기서 확인 가능한 것은 다음이다.

- `Restart`, `Pause`, `Play`, `Save State`, `Load State`, `Quick Save`, `Quick Load`, `Cache Manager`, `Cheats` 같은 toolbar 기능 문자열
- `Start Game`, `Click to resume Emulator`, `Drop save state here` 같은 lifecycle/UI 문자열
- `Netplay`, `Create a Room`, `Rooms` 같은 문자열 존재

다만 이 페이지는 **공식 netplay integration API의 근거가 아니다**. 특히 `Netplay` 관련 문자열은 UI 문자열 존재만 확인할 수 있을 뿐이고, FAQ의 “공식 netplay 미지원” 결론을 뒤집는 자료로 쓰면 안 된다.

### 2.3 현재 RTCADE 구현과 public surface의 차이

현재 RTCADE는 EmulatorJS public surface를 일부만 활용하고 있다.

- 현재 주로 사용하는 documented 옵션: `EJS_startOnLoaded`, `EJS_onGameStart`, `EJS_language`, `EJS_Buttons`
- 현재 구현은 iframe + `postMessage` + 내부 `gameManager` API 중심이다.
- CDN stable 경로를 직접 사용하고 있어, pinned/self-hosted 전략은 아직 문서 목표 단계다.

즉, RTCADE는 **공개 API를 충분히 다 쓰고도 모자라서 internal API로 넘어간 상태**라기보다, **현재는 공개 API 일부와 internal API를 혼합 사용 중이며, 이 경계를 더 정리해야 하는 상태**에 가깝다.

### 2.4 소스에서 확인된 점

EmulatorJS 소스에는 현재 RTCADE가 사실상 기대고 있는 내부 API가 존재한다.

- `gameManager.getState()`
- `gameManager.loadState()`
- `gameManager.simulateInput()`
- `gameManager.getFrameNum()`
- `gameManager.toggleMainLoop()`
- `gameManager.setVSync()`
- `gameManager.setKeyboardEnabled()`

또한 소스상 다음도 확인됐다.

- `getState()`는 `Uint8Array`를 반환한다.
- `loadState()`는 상태 파일을 내부 FS에 쓴 뒤 로드한다.
- `simulateInput()`는 플레이어/버튼/값 단위 입력 주입 API를 가진다.
- `getFrameNum()` 바인딩이 존재한다.
- `toggleMainLoop()` 바인딩이 존재한다.

### 2.5 가장 중요한 문서상 경고

공식 옵션 문서에는 문서화되지 않은 internal API는 버전 간 동작이 보장되지 않으므로 의존하지 말 것을 권장하는 경고가 있다.

즉, RTCADE가 EmulatorJS 위에서 고품질 넷플레이를 만들려면, **문서화되지 않은 내부 API를 완전히 피할 수는 없지만**, 그 사용을 직접 전역에 퍼뜨리면 안 된다. 반드시 **버전 고정 + 얇은 어댑터 계층**으로 감싸야 한다.

---

## 3. 현실적인 목표 재정의

웹 + EmulatorJS 제약 아래에서 목표는 다음처럼 다시 정의한다.

### 목표

1. 격투게임에서 보이는 **눈에 띄는 순간이동 빈도**를 크게 줄인다.
2. GUEST가 HOST에 끌려가는 구조를 완전히 없애지는 못하더라도, correction이 **희귀하고 작게** 보이도록 만든다.
3. 브라우저/포커스/백그라운드 영향에 대해 사용자 체감과 장애 범위를 줄인다.
4. EmulatorJS 버전 업데이트 시 RTCADE가 통제 가능한 구조로 바꾼다.

### 비목표

1. FightCade/GGPO와 동일한 프레임 롤백 품질 보장
2. 브라우저 백그라운드에서도 네이티브 앱처럼 동일 품질 보장
3. EmulatorJS 내부 undocumented API를 무한정 신뢰하는 구조

---

## 4. 현재 구조의 핵심 한계

현재 구조는 다음과 같다.

- React SPA 안에서 EmulatorJS를 iframe으로 실행
- React ↔ iframe은 `postMessage`
- P2P로 입력 교환
- 어긋나면 세이브스테이트 기반 correction

이 구조의 근본 한계:

1. **iframe + postMessage 추가 계층**
   - 입력/포커스/레이아웃/브라우저 life-cycle 영향이 커진다.
2. **EmulatorJS 공식 netplay 미지원**
   - RTCADE가 직접 transport와 sync를 모두 책임져야 한다.
3. **public API와 netplay 핵심 제어 API 사이 간극**
   - lifecycle/UI/설정은 public surface로 다룰 수 있지만, 상태 추출/로드와 입력 주입 같은 핵심 제어는 여전히 내부 API에 기대야 한다.
4. **브라우저 백그라운드 스로틀링**
   - 탭 비활성화 시 타이머와 렌더링, 경우에 따라 오디오/네트워크 타이밍이 흔들린다.
5. **상태 보정이 `loadState()` 기반**
   - correction 자체가 시각적으로 티가 난다.

---

## 5. 새 설계의 기본 방향

### 5.1 핵심 결론

웹만 유지한다면, 가장 먼저 바꿔야 하는 것은 “롤백 엔진”이 아니라 **EmulatorJS를 감싸는 런타임 구조**다.

즉, 새 설계는 다음 순서로 간다.

1. EmulatorJS 실행 환경을 더 안정적으로 재구성
2. undocumented API 접근을 어댑터로 고정
3. 입력/상태 동기화 정책을 코어별로 재설계
4. correction을 상시 수행하지 않고, 더 안전한 시점과 더 작은 범위로 제한

### 5.2 새 설계 한 줄 요약

> `React iframe 래퍼 중심 구조`에서 `전용 웹 플레이 런타임 + EmulatorJS 어댑터 + 코어별 sync policy` 구조로 이동한다.

---

## 6. 목표 아키텍처

### 6.1 상위 구조

#### 기존

- SPA 화면 안에 Emulator iframe
- 로비/채팅/UI와 에뮬레이터가 한 화면에 함께 존재

#### 변경안

- 로비와 플레이 런타임을 분리
- 플레이 중에는 **SPA 바깥의 전용 플레이 문서** 또는 **iframe-hosted dedicated runtime 문서**가 EmulatorJS를 담당
- RTCADE UI는 overlay 또는 별도 패널로 최소화

권장안:

1. React SPA는 로비/매칭/설정 담당
2. 실제 플레이는 같은 오리진의 별도 문서가 담당
3. 이 플레이 문서는 plain HTML 기반으로 EmulatorJS를 직접 올린다
4. SPA ↔ 플레이 문서는 `BroadcastChannel` 또는 `postMessage`로 최소 통신만 수행

이렇게 하면 공식 문서의 “SPA는 iframe으로 embed해야 한다”는 제약을 지키면서도, 현재처럼 복잡한 React 컴포넌트 트리 한가운데 EmulatorJS를 넣지 않아도 된다. 여기서 핵심은 “React route에서 직접 실행”이 아니라 “별도 플레이 문서를 호스팅”하는 쪽이다.

### 6.2 왜 이 구조가 나은가

1. 플레이 중 DOM 간섭 감소
2. 레이아웃/스크롤/포커스 문제 감소
3. EmulatorJS 런타임과 게임 UI 생명주기 분리
4. 이후 버전 고정/교체/실험이 쉬움

---

## 7. Runtime Adapter 계층

### 7.1 목표

EmulatorJS public surface와 internal surface를 구분하고, 내부 API 접근을 앱 전역에 퍼뜨리지 않고 하나의 브리지로 격리한다.

예시 인터페이스:

```ts
interface EmulatorRuntimeBridge {
  ready(): Promise<void>;
  start(): void;
  pause(): void;
  resume(): void;
  getState(): Uint8Array;
  loadState(state: Uint8Array): void;
  simulateInput(player: number, button: number, value: 0 | 1): void;
  getFrameNum(): number | null;
  setKeyboardEnabled(enabled: boolean): void;
  setVSync(enabled: boolean): void;
}
```

### 7.2 public surface와 internal surface 분리

`RuntimeBridge`는 모든 기능을 internal API로 해결하는 계층이 아니다. 먼저 public API로 가능한 부분을 소화하고, 그 다음 부족한 부분만 internal bucket으로 내린다.

#### public API로 처리할 것

- lifecycle ready/start 신호: `EJS_ready`, `EJS_onGameStart`
- save/load UI hook: `EJS_onSaveState`, `EJS_onLoadState`, `EJS_onSaveUpdate`
- toolbar/host action 연결: `EJS_Buttons`, custom button callback
- 언어/기본 입력/기본 옵션: `EJS_language`, `EJS_defaultControls`, `EJS_defaultOptions`, `EJS_startButtonName`
- asset/cache/runtime 옵션: `EJS_paths`, `EJS_cacheConfig`, `EJS_threads`, `EJS_externalFiles`

#### internal API가 필요한 것

- mid-game state 추출: `gameManager.getState()`
- mid-game state 로드: `gameManager.loadState()`
- netplay용 원격 입력 주입: `gameManager.simulateInput()`
- 실험용 frame telemetry: `gameManager.getFrameNum()`
- 런타임 강제 정지/재개 및 세부 토글: `pause()`, `play()`, `toggleMainLoop()`, `setVSync()`, `setKeyboardEnabled()`

### 7.3 설계 원칙

1. RTCADE 코드는 EmulatorJS 내부 객체 구조를 직접 알지 않는다.
2. 내부 API 변경 시 `RuntimeBridge`만 수정한다.
3. 앱은 반드시 특정 EmulatorJS 버전을 pin 한다.
4. nightly CDN 의존을 피하고 stable/pinned asset만 사용한다.
5. public API로 처리 가능한 기능은 internal API로 우회하지 않는다.

### 7.4 버전 전략

- `EJS_paths` 또는 자체 호스팅으로 로더/런타임 파일 버전 고정
- EmulatorJS 업그레이드는 수동 검증 후에만 수행
- `getState`, `loadState`, `simulateInput`, `getFrameNum` smoke test 자동화
- `EJS_Buttons`, `EJS_defaultControls` 같은 public API shape 변화도 회귀 대상으로 포함

---

## 8. 웹 전용 성능 최적화 전제

### 8.1 Threads 활성화

문서상 `EJS_threads = true`는 성능 개선 여지가 있다.

RTCADE 권장:

- 가능 브라우저에서 기본 활성화 검토
- 서버가 다음 헤더 제공

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

주의:

- 모든 코어가 동일 이득을 보는 것은 아니다.
- 브라우저/호스팅/CORS 조건 검증이 필요하다.
- RTCADE는 프론트와 백엔드가 분리 배포되는 구조라서, COOP/COEP와 asset 제공 오리진을 함께 설계하지 않으면 실제 적용이 막힐 수 있다.

### 8.2 캐시와 로딩 경로

문서/소스상 EmulatorJS는 캐시와 외부 파일 경로 제어를 지원한다.

RTCADE 권장:

- `EJS_cacheConfig` 적극 사용
- 자체 오리진에서 코어/런타임 파일 제공
- 대용량 롬/바이너리의 first-load 부담 최소화

### 8.3 포커스/백그라운드 정책

웹만으로는 백그라운드 스로틀링을 제거할 수 없다. 따라서 정책적으로 다뤄야 한다.

권장 정책:

1. 플레이 시작 시 “활성 탭 유지 권장” 안내
2. `visibilitychange` 감지 시 UI 경고
3. 숨김 상태가 길어지면 세션 품질 저하 플래그 기록
4. 필요 시 백그라운드 장시간 감지 후 강한 correction 대신 재동기화 선택지 제공

즉, **기술로 완전히 제거**가 아니라 **정책 + UX + 계측**으로 관리한다.

---

## 9. 동기화 모델 재설계

### 9.1 공식 netplay 미지원 전제

EmulatorJS FAQ 기준 공식 netplay는 아직 지원되지 않는다.

따라서 RTCADE는 계속 자체 동기화를 가져가야 한다.

하지만 새 구조에서는 다음을 바꾼다.

- 입력 메시지
- correction 시점
- divergence 감지 방식
- 코어별 정책

### 9.2 입력 중심, 상태는 안전장치

기본 원칙은 유지한다.

- 입력은 즉시 적용
- 상태 sync는 마지막 수단

다만 correction 정책은 바꾼다.

#### 변경 방향

1. **중간 라운드 상시 correction 최소화**
2. **round start / KO / loading / menu 전환 / 명확한 idle window**에서만 우선 correction
3. mid-round correction은 hash divergence가 큰 경우에만 제한적으로 수행

이 방향은 “상태를 자주 덮어쓰면 더 좋아질 것”이라는 가정 대신, **보이는 순간이동을 줄이는 것**을 우선한다.

### 9.3 Divergence 감지

완전한 롤백이 어렵다면, 상태가 틀어졌는지 빨리 감지하는 쪽이 중요하다.

권장:

- 프레임 번호 샘플링 (`getFrameNum()` 기반, 단 lockstep 축이 아니라 telemetry 용도)
- 저비용 상태 해시 또는 세이브스테이트 샘플 해시
- 입력 시퀀스 갭 로그
- correction 후 수렴 여부 로그

주의:

- `getFrameNum()`은 관측용 후보일 뿐, 설계 핵심 축으로 삼지 않는다.
- RTCADE는 과거 frame-tick / frame-lockstep 계열 접근이 실패한 이력이 있으므로, 이 값은 “동기화 제어”보다 “이상 탐지”에 가깝게 써야 한다.

예시 메트릭:

- `frameDelta`
- `stateHashMismatch`
- `resyncLoadMs`
- `seqGapCount`
- `hiddenTabDurationMs`

### 9.4 코어별 정책 분리

격투게임용 코어와 일반 코어를 같은 정책으로 다루면 안 된다.

예시:

- `mame2003_plus`, `fbneo` 계열: correction 보수적
- 콘솔 RPG/턴제: correction 허용도 높음

정책 예시:

```ts
interface SyncProfile {
  allowMidGameCorrection: boolean;
  minCorrectionIntervalMs: number;
  safeWindowPriority: "high" | "medium" | "low";
  hashSampleIntervalMs: number;
}
```

---

## 10. 플레이 런타임 구성안

### 10.1 구성 요소

- `PlayHostPage`
- `EmulatorRuntimeBridge`
- `InputTransport`
- `SyncPolicyEngine`
- `DivergenceMonitor`
- `CorrectionCoordinator`
- `SessionTelemetry`

### 10.2 책임 분리

#### `PlayHostPage`

- EmulatorJS 로드
- overlay UI 최소 제공
- visibility/focus/lifecycle 관리

#### `EmulatorRuntimeBridge`

- EmulatorJS 내부 API 안전 래핑
- 버전별 호환 계층

#### `InputTransport`

- 입력 / control / repair 채널 관리
- seq / held mask / repair sync 처리

#### `SyncPolicyEngine`

- 코어별 correction 정책 선택
- safe window 판정

#### `DivergenceMonitor`

- 프레임/해시/지연/백그라운드 상태 측정

#### `CorrectionCoordinator`

- correction 실행 여부 판단
- correction 요청/승인/적용 절차 통합

---

## 11. 반드시 지킬 원칙

### 11.1 undocumented API 최소화

문서화되지 않은 API는 다음 원칙으로 사용한다.

1. 직접 앱 전역 호출 금지
2. Bridge 내부로 제한
3. 버전 pin 필수
4. 검증 테스트 없이는 업그레이드 금지

### 11.2 공식 문서 옵션 우선 사용

다음은 가능한 한 공식 옵션으로 처리한다.

- `EJS_ready`
- `EJS_onGameStart`
- `EJS_onSaveState`
- `EJS_onLoadState`
- `EJS_onSaveUpdate`
- `EJS_startOnLoaded`
- `EJS_threads`
- `EJS_paths`
- `EJS_Buttons`
- `EJS_defaultControls`
- `EJS_defaultOptions`
- `EJS_startButtonName`
- `EJS_language`
- `EJS_disableAutoLang`
- `EJS_cacheConfig`
- `EJS_externalFiles`
- `EJS_loadStateURL`

### 11.3 correction은 “기술적으로 가능”보다 “보여도 괜찮은가”가 우선

mid-round 순간이동이 크면, 더 자주 correction 하지 않고 오히려 미루는 편이 낫다.

---

## 12. 단계별 실행 계획

### Phase 0 — Public API 정리

목표:

- 이미 공개된 EmulatorJS surface를 먼저 체계화하고, internal API 사용 범위를 줄일 수 있는지 확인

작업:

1. `EJS_ready`, `EJS_onGameStart` 기준 lifecycle 재정의
2. `EJS_Buttons`와 custom button callback으로 호스트 액션 재분류
3. `EJS_defaultControls`, `EJS_defaultOptions` 활용 가능성 검토
4. `translate` 페이지에 보이는 UI surface를 문서화하되 netplay API로 오해되지 않게 분리

산출물:

- public API inventory
- public/internal 경계 표

### Phase 1 — EmulatorJS 안정화 레이어

목표:

- 현재 netplay 로직보다 먼저 EmulatorJS 의존 구조를 정리

작업:

1. 버전 pin
2. `RuntimeBridge` 도입
3. `getState/loadState/simulateInput/getFrameNum` smoke test 작성
4. `EJS_threads` + COOP/COEP 적용 실험

산출물:

- 버전 고정된 EmulatorJS 런타임
- 호환성 체크 테스트

### Phase 2 — 전용 플레이 문서 분리

목표:

- SPA 내부 iframe 얽힘을 줄이고 플레이 런타임 분리

작업:

1. 전용 플레이 문서 생성
2. SPA ↔ 플레이 문서 메시지 프로토콜 설계
3. 채팅/상태 UI 최소 overlay 재배치

성공 기준:

- 로비와 플레이 런타임이 독립 생명주기를 가짐

### Phase 3 — 계측 중심 sync 재설계

목표:

- correction을 줄이기 위한 판단 근거 확보

작업:

1. frame/hash telemetry 추가
2. hidden tab / focus loss / jitter 측정
3. 코어별 divergence profile 수집

성공 기준:

- KOF류에서 어떤 조건에 순간이동이 커지는지 수치 확인 가능

### Phase 4 — safe-window correction 정책

목표:

- 상시 correction 대신 보이는 순간이동이 덜한 시점 중심으로 재구성

작업:

1. safe window 정의
2. mid-round correction 축소
3. 큰 divergence는 안전 구간까지 지연 적용
4. correction 강도 profile 분리

성공 기준:

- 격투게임에서 visible teleport 빈도 감소

### Phase 5 — 입력 경로 고도화

목표:

- 웹 한계 안에서 입력 안정성 최대화

작업:

1. repair channel 지속 개선
2. input/control separation 정교화
3. held-mask / watermark / stale-drop 정책 보완

성공 기준:

- 입력 유실/지연으로 인한 correction 빈도 감소

---

## 13. 데이터 모델 초안

```ts
interface FrameSample {
  localFrame: number | null;
  remoteFrame: number | null;
  sampledAt: number;
}

interface DivergenceSample {
  frameDelta: number | null;
  stateHash?: string;
  hidden: boolean;
  rttMs?: number;
}

interface SyncProfile {
  core: string;
  allowMidGameCorrection: boolean;
  minCorrectionIntervalMs: number;
  safeWindowPriority: "high" | "medium" | "low";
  hashSampleIntervalMs: number;
}
```

---

## 14. 성공 지표

1. KOF류에서 GUEST visible teleport 빈도 감소
2. correction 발생 횟수 감소
3. correction당 이동 폭 감소
4. 백그라운드/포커스 상실 시 세션 파손률 감소
5. EmulatorJS 버전 업데이트 시 회귀 검출 가능

---

## 15. 리스크

1. **공식 netplay 미지원**
   - RTCADE가 동기화 레이어를 계속 직접 유지해야 한다.
2. **undocumented API 의존**
   - 버전 업 시 깨질 수 있다.
3. **웹 백그라운드 한계**
   - 기술로 완전 제거 불가하다.
4. **FightCade급 절대 품질 한계**
   - 웹 + EmulatorJS 조합만으로 동일 체감 보장은 어렵다.

---

## 16. 현재 구현과 목표 구조 비교

현재 구현은 다음 성격을 가진다.

- iframe 내부에서 EmulatorJS 실행
- `postMessage`로 React와 통신
- `EJS_startOnLoaded`, `EJS_onGameStart`, `EJS_language`, `EJS_Buttons` 정도의 documented 옵션 사용
- 실제 넷플레이 핵심은 `pause()`, `play()`, `gameManager.getState()`, `gameManager.loadState()`, `gameManager.simulateInput()`에 의존
- EmulatorJS asset은 stable CDN 직접 사용

목표 구조는 다음 차이를 가진다.

- public API 사용 범위를 먼저 넓힘
- internal API는 `RuntimeBridge` 뒤로 격리
- dedicated play document에서 lifecycle을 분리 관리
- asset/version/origin 정책을 명시적으로 통제

즉, 새 설계는 “EmulatorJS를 버리는 것”이 아니라 **EmulatorJS public surface를 더 잘 쓰고, internal surface는 더 엄격하게 가두는 것**에 가깝다.

---

## 17. 결론

웹만 유지하고 EmulatorJS도 유지해야 한다면, 정답은 “롤백 엔진 새로 만들기”보다 먼저 다음이다.

1. EmulatorJS public surface를 먼저 정리해 활용 범위를 넓히기
2. undocumented API 접근을 Bridge로 고정하기
3. 전용 플레이 문서에서 lifecycle을 분리 관리하기
4. 코어별 sync policy를 도입하기
5. correction을 덜 보이는 시점으로 이동하기
6. browser throttling을 설계 차원에서 관리하기

즉, 새 방향은 다음 전환이다.

- `React 안의 iframe 기반 임시 런타임`
- 에서
- `웹 전용 플레이 런타임 + EmulatorJS 안정화 어댑터 + 계측 기반 동기화 정책`

이 구조가 웹만으로 가능한 가장 현실적인 재설계 방향이다.

---

## 18. 바로 다음 액션

1. `RuntimeBridge` 명세 문서 분리
2. 전용 플레이 문서 구조 초안 작성
3. public/internal API 경계 표 별도 문서화
4. EmulatorJS pinned asset 전략 정리
5. KOF 기준 `SyncProfile` 초안 작성
