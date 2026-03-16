# CLAUDE.md — MCP Workbench

이 파일은 Claude가 이 프로젝트에서 작업할 때 참조하는 컨텍스트입니다.

---

## 프로젝트 개요

**MCP Workbench** — Model Context Protocol 서버를 검사·테스트·검증하는 개발자 도구.

- CLI (`mcp-workbench run`, `mcp-workbench inspect`, `mcp-workbench plugins list`)로 MCP 서버에 연결해 YAML 스펙 기반 테스트 실행
- 스냅샷 diff, 어서션, 클라이언트 시뮬레이터(roots/sampling/elicitation) 지원
- 브라우저 UI(`apps/web`) — 실제 서버 연결, 도구 호출, Timeline, Test Results 등 전 기능 구현 완료
- 플러그인 시스템 — `--plugin` 플래그 또는 `workbench.config.yaml`로 reporter/command 확장

MCP 스펙 버전: **2025-11-25**

---

## 모노레포 구조

```
apps/
  cli/          # mcp-workbench CLI — commander 기반, dist/index.js가 bin
  web/          # Vite + React 18 UI 스캐폴드 (placeholder 페이지)
packages/
  protocol-kernel/   # JSON-RPC 2.0 엔진 + MCP 타입 + 서버→클라이언트 요청 처리
  session-engine/    # MCP 세션 라이프사이클, 타임라인, 이벤트 버스
  transport-stdio/   # stdio 트랜스포트
  transport-http/    # Streamable-HTTP / SSE 트랜스포트
  test-spec/         # YAML 테스트 스펙 파서 및 타입
  assertions/        # 어서션 러너 (snapshot diff 포함)
  client-simulator/  # roots / sampling / elicitation 클라이언트 시뮬레이터
examples/
  demo-server/       # @modelcontextprotocol/sdk 기반 데모 MCP 서버
  fixtures/          # 예제 테스트 스펙 YAML
```

패키지 이름 prefix: `@mcp-workbench/*`

---

## 기술 스택

| 영역 | 선택 |
|------|------|
| 언어 | TypeScript (strict, `noUncheckedIndexedAccess: true`) |
| 모듈 | ESM (`"type": "module"`, `"module": "Node16"`) |
| 패키지 매니저 | pnpm (workspace:\* 로 내부 참조) |
| 빌드 | `tsc` (각 패키지 독립 빌드) |
| 테스트 | vitest |
| CLI | commander + chalk + ora |
| UI | Vite + React 18 + React Router v6 + CSS Modules |
| 런타임 | Node.js ≥ 20 |

---

## 자주 쓰는 커맨드

```bash
# 전체 빌드
pnpm build

# 전체 테스트
pnpm test

# 특정 패키지만
pnpm --filter @mcp-workbench/assertions test
pnpm --filter @mcp-workbench/web dev

# 타입 체크
pnpm typecheck

# 전체 클린 빌드
pnpm clean && pnpm install && pnpm build
```

---

## 패키지 의존성 순서

빌드 의존 관계 (아래로 갈수록 상위):

```
protocol-kernel
  ↑
transport-stdio / transport-http / session-engine / client-simulator
  ↑
test-spec / assertions
  ↑
apps/cli / apps/web
```

- `session-engine`은 `client-simulator`에 **직접 의존하지 않음** — 순환 방지를 위해 `ClientSimulatorLike` 인터페이스를 `session-engine` 내부에 선언하고 외부에서 주입
- 새 패키지를 추가할 때 이 방향을 지키고 `pnpm-workspace.yaml`에 등록

---

## 핵심 설계 결정

### ProtocolKernel (`packages/protocol-kernel/src/kernel.ts`)
- `pending` Map으로 요청/응답을 id 기반 매칭
- `serverRequestHandlers` Map으로 서버→클라이언트 요청을 처리 (`setRequestHandler` / `removeRequestHandler`)
- `handleIncoming()` → `isResponse` → `handleResponse`, `isRequest` → `handleServerRequest`, `isNotification` → `handleNotification`
- `handleServerRequest()`는 핸들러 없으면 `METHOD_NOT_FOUND` JSON-RPC 에러 응답 반환

### Session (`packages/session-engine/src/session.ts`)
- `connect()` 시 simulator가 있으면 `simulator.buildCapabilities()`를 `clientCapabilities`에 merge한 뒤 `simulator.install(kernel)` 호출
- Timeline에 모든 JSON-RPC 이벤트 기록 (`record()` 메서드)
- 상태 머신: `idle → connecting → ready → closed/error`

### ClientSimulator (`packages/client-simulator/src/simulator.ts`)
- `install(kernel)` — 설정된 capability에 해당하는 핸들러만 등록, `InstalledCapabilities` 반환
- `uninstall(kernel)` — 등록한 핸들러 제거
- `buildCapabilities()` — initialize 시 광고할 `clientCapabilities` 객체 반환
- sampling: `handler` > `preset` > 에러(`"declined"`) 순으로 fallback
- elicitation: preset 없으면 기본 `{ action: "decline" }` 반환

### Assertions (`packages/assertions/src/runner.ts`)
- `kind` 필드로 분기: `equals`, `contains`, `jsonpath`, `schema`, `snapshot`, `protocolError` 등
- snapshot: `applyIgnorePaths` → baseline 로드 → 비교 → diff 출력
- `ignorePaths`는 baseline과 actual **양쪽**에 적용해야 함 (한쪽만 적용하면 오탐 발생)

### 테스트 스펙 YAML (`packages/test-spec/src/types.ts`)
- `apiVersion: mcp-workbench.dev/v0alpha1`
- `server.transport`: `stdio` | `streamable-http` | `sse`
- `fixtures.roots/sampling/elicitation` — 클라이언트 시뮬레이터에 주입되는 픽스처
- `act.method`: `tools/call`, `tools/list`, `resources/read`, `resources/list`, `prompts/get`, `prompts/list`, `completion/complete`, `ping`

---

## 주의사항 및 과거 트러블슈팅

- **ESM import**: 내부 import는 반드시 `.js` 확장자 사용 (`import { Foo } from "./foo.js"`)
- **`type: "module"`**: 모든 패키지 `package.json`에 필수
- **`noUncheckedIndexedAccess: true`**: 배열/맵 접근 시 `undefined` 체크 필요
- **`noImplicitOverride: true`**: 부모 메서드 재정의 시 `override` 키워드 필수
- **`exactOptionalPropertyTypes`**: 활성화하지 않음 — 과거 `message: string | undefined` vs `message?: string` 충돌로 제거
- **`pnpm test`**: 테스트 파일 없는 패키지는 `vitest run --passWithNoTests` 필수
- **StdioTransport**: `inheritEnv: true` 설정 필요 — false면 PATH가 막혀 `spawn ENOENT` 발생
- **snapshot ignorePaths**: baseline 로드 후 `applyIgnorePaths`를 baseline에도 적용해야 함

---

## 브랜치 전략

```
main        ← 안정 릴리스만. 직접 커밋 금지.
develop     ← 모든 신규 작업의 base. 여기서 feature 브랜치를 만들고 머지.
feature/*   ← 기능 단위 작업. develop에서 분기, develop으로 머지.
fix/*       ← 버그 픽스. develop에서 분기, develop으로 머지.
```

**워크플로:**
1. 신규 작업은 `develop` 기반으로 브랜치 생성
2. 작업 완료 후 `develop`에 머지
3. 릴리스 준비가 되면 `develop` → `main` 머지 (PR 필수)
4. `main` 직접 커밋 허용 범위: CI 설정, LICENSE, README 등 인프라/메타데이터 단순 수정

**Claude 작업 규칙:**
- 새 기능·페이지·패키지는 항상 `develop` 브랜치에 커밋
- 브랜치 생성: `git checkout -b feature/<name> develop`

---

## 커밋 규칙

- Co-author 표기 없이 커밋
- 커밋 메시지는 영어, 명령형 (`Add`, `Fix`, `Update`)
- 빌드/테스트 통과 후 커밋

---

## 향후 작업 (Phase 6+)

- `apps/web`: Inspect 페이지에 실제 서버 연결 + 도구 호출 UI 구현
- `apps/web`: Timeline 페이지에 세션 이벤트 실시간 렌더링
- `apps/web`: Test Results 페이지에 `RunReport` 표시
- CI: snapshot 테스트 안정화, matrix 빌드 (Node 20/22)
