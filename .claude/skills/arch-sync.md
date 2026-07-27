---
description: "아키텍처 변경 시 ARCHITECTURE.md, CLAUDE.md, .github/instructions/ 동기화 가이드"
---

# 아키텍처 문서 동기화

코드 변경 후 문서화가 따라가지 못하는 것을 방지한다.
새 서브시스템 추가, 프로토콜 변경, 실패한 접근법 발견 시 실행한다.

## 변경 감지

현재 git diff를 스캔하여 다음 신호를 찾는다:

- **새 디렉토리**: `src/`, `server/` 아래 새 폴더 → `ARCHITECTURE.md` 섹션 업데이트 필요
- **프로토콜 변경**: `shared/emulator-protocol.ts` 수정 → `CLAUDE.md` DataChannel 분리 + `ARCHITECTURE.md` 섹션 7 업데이트 필요
- **새로운 hook**: `src/netplay/use*.ts` 신규 파일 → `CLAUDE.md` 세션 훅 체인 + `ARCHITECTURE.md` 섹션 7.3 업데이트 필요
- **서버 라우트**: `server/*Api.ts` 신규 또는 변경 → `ARCHITECTURE.md` 섹션 6.4 라우트 테이블 업데이트 필요

## 교차 참조 대상

### CLAUDE.md 섹션
- Build & Development Commands
- Architecture Overview (EmulatorJS / FBNeo / DataChannel Split / Backend)
- Key Conventions
- Known Failed Approaches
- Vite Configuration Notes

### ARCHITECTURE.md 섹션 (11개)
1. 프로젝트 개요
2. 기술 스택
3. 디렉토리 구조
4. 시스템 아키텍처
5. 프론트엔드 상세
6. 백엔드 서버 상세
7. 넷플레이 시스템
8. 에뮬레이터 통합
9. SEO / PWA / 브랜딩
10. 빌드 및 실행
11. 트러블슈팅 & 설계 결정 히스토리

## 특별 처리

### Known Failed Approaches 업데이트

새로운 접근법이 시도되었으나 실패한 경우:
1. `CLAUDE.md`의 "Known Failed Approaches (DO NOT RETRY)" 목록에 추가
2. `ARCHITECTURE.md` 섹션 11의 "채택하지 않은 접근"에 추가
3. 관련 Copilot instruction 파일에서도 경고 추가

### GGPO 잔여물 주의

`src/netplay-ggpo/ggpo/` 디렉토리의 파일들은 GGPO 롤백 실패 후 남은 코드다.
이 디렉토리를 수정하는 변경은 반드시 "왜 지금 GGPO를 다시 시도하는가?"를 확인해야 한다.

## 결과

변경 감지 → 업데이트 필요 문서 목록 → 각 문서에 제안할 업데이트 내용을 출력한다.
