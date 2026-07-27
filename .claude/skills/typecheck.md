---
description: "npx tsc --noEmit 실행, 타입 에러를 파일별로 정리해서 요약"
---

# TypeScript 타입 체크

프로젝트의 가장 기본적인 품질 게이트. 커밋 전, 배포 전, 변경 후 항상 실행한다.

## 실행

```bash
npx tsc --noEmit
```

## 에러 분류

출력을 파싱하여 다음 기준으로 정리한다:

1. **타입 불일치** — 잘못된 타입 할당, 호출 시그니처 불일치
2. **미사용 변수/파라미터** — `noUnusedLocals`, `noUnusedParameters` 위반
3. **erasableSyntaxOnly 위반** — `enum`, `namespace`, `constructor parameter properties` 등 런타임 문법 사용
4. **verbatimModuleSyntax 위반** — `import type` 누락
5. **noImplicitReturns 위반** — 반환 타입이 명시된 함수에서 일부 경로에 return 없음

## 결과 요약

- 총 에러 개수
- 파일별 에러 개수 (내림차순)
- 민감한 서브시스템 (`src/netplay/`, `src/netplay-ggpo/`) 파일이 포함되었는지 하이라이트

## 성공 시

```
✅ TypeScript: 오류 없음
```

## 참고

- `tsconfig.app.json`과 `tsconfig.node.json`의 strict 설정이 적용된다
- `--pretty false` 옵션으로 기계 판독 가능한 출력을 얻을 수 있다
- tsbuildinfo가 캐시되어 있어 증분 체크는 빠르게 동작한다
