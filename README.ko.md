# MCP Workbench

[English](README.md) | **한국어**

**MCP 서버 개발자를 위한 품질 플랫폼.**

커맨드라인 또는 CI 환경에서 [Model Context Protocol](https://modelcontextprotocol.io) 서버를 테스트·검사·검증합니다.

[![CI](https://github.com/raeseoklee/mcp-workbench/actions/workflows/ci.yml/badge.svg)](https://github.com/raeseoklee/mcp-workbench/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

```
MCP Workbench = Inspector + Contract Test + Regression Diff + CI Runner
```

![MCP Workbench demo](docs/assets/demo.gif)

---

## 왜 MCP Workbench인가?

MCP 생태계에는 디버깅 도구(Inspector)와 SDK는 있지만, 전용 품질 검증 플랫폼은 없습니다.
MCP Workbench가 그 공백을 채웁니다: **저장된 테스트, 회귀 diff, CI에 바로 쓸 수 있는 어서션 실행**.

| 도구 | 인터랙티브 디버그 | 저장된 테스트 | 회귀 Diff | CI 러너 |
|------|:-----------------:|:-------------:|:---------:|:-------:|
| MCP Inspector | ✓ | — | — | — |
| **MCP Workbench** | ✓ | **✓** | **✓** | **✓** |

---

## 기능

- **`mcp-workbench inspect`** — 모든 MCP 서버에 연결해 기능, 도구, 리소스, 프롬프트 탐색
- **`mcp-workbench run`** — YAML로 정의된 테스트 스위트를 풍부한 어서션과 함께 실행
- **`mcp-workbench generate`** — 라이브 서버에서 도구/리소스/프롬프트를 탐색해 YAML 테스트 스펙 자동 생성
- **어서션 엔진** — `status`, `jsonpath`, `executionError`, `protocolError`, `contentType`, `count`, `notEmpty`, `equals`, `schema` 등
- **트랜스포트 지원** — `stdio`(로컬 서버), `streamable-http`(원격 서버), 레거시 SSE
- **클라이언트 시뮬레이터** — roots, sampling 프리셋, elicitation 핸들러를 주입해 서버→클라이언트 기능 흐름 테스트
- **CI 친화적** — `--json` 출력, 실패 시 non-zero 종료, `--bail` 플래그
- **프로토콜 정확성** — capability 협상, 세션 라이프사이클, 알림 처리를 포함한 MCP 스펙 `2025-11-25` 완전 구현
- **브라우저 UI** — Protocol 탭(DevTools 스타일 요청/응답 로그), 다크/라이트 모드, 라이브 테스트 러너를 갖춘 풀 기능 웹 인스펙터
- **플러그인 시스템** — `--plugin` 또는 `workbench.config.yaml`로 reporter(`html`, `junit`)와 커스텀 커맨드 확장

---

## 설치

```bash
# 기본 — 스코프 패키지
npm install -g @mcp-workbench/cli

# 대안 — 편의 래퍼
npm install -g mcp-workbench-cli
```

두 패키지 모두 동일한 `mcp-workbench` 커맨드를 제공합니다.

> **왜 `npm install -g mcp-workbench`가 아닌가요?**
> npm의 unscoped 패키지명 `mcp-workbench`는 관련 없는 다른 프로젝트(MCP 서버 애그리게이터)가 사용 중입니다.
> 이 프로젝트는 테스트·검증 플랫폼으로, 완전히 다른 도구입니다.
> 자세한 내용은 [docs/npm-distribution.md](docs/npm-distribution.md)를 참고하세요.

---

## 빠른 시작

### 지금 바로 시작하기 (설정 불필요)

CLI와 번들된 데모 서버를 설치한 뒤 검사해보세요:

```bash
npm install -g @mcp-workbench/cli @mcp-workbench/demo-mcp

mcp-workbench inspect --command mcp-workbench-demo
```

데모 서버는 날씨 도구, 노트 리소스, 인사 프롬프트를 제공합니다. 서버 코드 한 줄 작성 없이 MCP Workbench의 모든 기능을 탐색할 수 있습니다.

### 서버 검사하기

```bash
# stdio (로컬 서버)
mcp-workbench inspect --command node --args "path/to/server.js"

# HTTP (원격 서버)
mcp-workbench inspect --transport streamable-http --url https://your-server.com/mcp
```

출력 예시:

```
  Server Info

  Name:     my-mcp-server
  Version:  1.0.0
  Protocol: 2025-11-25

  Capabilities

  ✓ tools (listChanged)
  ✓ resources (subscribe)
  ✓ prompts
  ○ completions
  ○ logging

  Tools (3)

  get_weather [read-only]
    Get current weather for a city
  create_file [destructive]
    Create or overwrite a file
```

### 테스트 스위트 실행하기

```bash
mcp-workbench run tests.yaml
mcp-workbench run tests.yaml --verbose
mcp-workbench run tests.yaml --json > results.json
mcp-workbench run tests.yaml --bail --timeout 5000
```

데모 서버에 대해 포함된 픽스처를 실행해보세요:

```bash
mcp-workbench run examples/fixtures/demo-mcp.yaml --verbose
```

### Web UI 시작하기

MCP Workbench는 CLI와 함께 브라우저 기반 인스펙터를 제공합니다. 두 개의 터미널에서 서버를 시작하세요:

```bash
# 터미널 1 — API 서버
node apps/api/dist/index.js

# 터미널 2 — Web UI (http://localhost:5173 에서 열림)
pnpm --filter @mcp-workbench/web dev
```

브라우저에서 [http://localhost:5173](http://localhost:5173)을 엽니다. Inspect 페이지에서 서버 정보를 입력해 연결하고 도구, 리소스, 프롬프트, 라이브 Protocol 로그를 탐색하세요.

---

## 테스트 스펙 포맷

테스트 스위트는 `mcp-workbench.dev/v0alpha1` 스키마를 사용하는 YAML 파일입니다.

```yaml
apiVersion: mcp-workbench.dev/v0alpha1

server:
  transport: stdio
  command: node
  args:
    - dist/server.js

# 또는 원격 서버의 경우:
# server:
#   transport: streamable-http
#   url: https://your-server.com/mcp
#   headersFromEnv:
#     Authorization: MCP_API_TOKEN

client:
  protocolVersion: "2025-11-25"

tests:
  - id: tools-list
    description: Server exposes at least one tool
    act:
      method: tools/list
    assert:
      - kind: status
        equals: success
      - kind: notEmpty
        path: $.tools

  - id: get-weather
    description: Weather tool returns text for a valid city
    act:
      method: tools/call
      tool: get_weather
      args:
        city: Seoul
    assert:
      - kind: executionError
        equals: false
      - kind: contentType
        contains: text
      - kind: jsonpath
        path: $.content[0].text
        matches: "Seoul"

  - id: invalid-input
    description: Tool returns execution error (not protocol error) for bad input
    act:
      method: tools/call
      tool: get_weather
      args:
        city: 12345
    assert:
      - kind: executionError
        equals: true
      - kind: protocolError
        equals: false
```

### 어서션 레퍼런스

| Kind | 설명 |
|------|------|
| `status` | `equals: success \| error` — 전체 호출 상태 |
| `executionError` | `equals: true \| false` — 도구의 `isError` 플래그 |
| `protocolError` | `equals: true \| false` — JSON-RPC 에러 응답 여부 |
| `jsonpath` | JSONPath 쿼리와 `equals`, `contains`, `matches`, `notEmpty` 조합 |
| `notEmpty` | 대상이 비어 있지 않은 문자열 / 배열 / 객체인지 확인 |
| `contentType` | `content[*].type` 확인 — `equals` 또는 `contains` |
| `count` | 배열 길이 — `equals`, `min`, `max` |
| `equals` | 선택적 `path`에서의 깊은 동등성 비교 |
| `schema` | 선택적 `path`에서의 JSON Schema 검증 |
| `outputSchemaValid` | 도구의 `structuredContent`를 `outputSchema`에 대해 검증 |

---

## CLI 레퍼런스

### `mcp-workbench inspect`

```
mcp-workbench inspect [options]

Options:
  --transport <kind>   stdio | streamable-http | sse  (기본값: stdio)
  --command <cmd>      실행할 커맨드 (stdio)
  --args <args>        공백으로 구분된 인자 (stdio)
  --url <url>          서버 URL (HTTP)
  --timeout <ms>       요청 타임아웃
  --json               JSON 출력
  --lang <locale>      출력 언어: en | ko  (환경변수: MCP_WORKBENCH_LANG)
```

### `mcp-workbench run`

```
mcp-workbench run <spec-file> [options]

Options:
  --tags <tags>        쉼표로 구분된 태그와 일치하는 테스트만 실행
  --ids <ids>          쉼표로 구분된 ID를 가진 테스트만 실행
  --bail               첫 번째 실패 후 중지
  --timeout <ms>       요청별 타임아웃
  --json               JSON 출력 (CI 친화적)
  -v, --verbose        모든 어서션 상세 정보 표시
  --lang <locale>      출력 언어: en | ko  (환경변수: MCP_WORKBENCH_LANG)
```

### `mcp-workbench generate`

```
mcp-workbench generate [options]

Options:
  --transport <kind>   stdio | streamable-http  (기본값: stdio)
  --command <cmd>      실행할 명령 (stdio)
  --args <args>        공백으로 구분된 인수 (stdio)
  --url <url>          서버 URL (HTTP)
  --header <h>         HTTP 헤더 "Key: Value" (반복 가능)
  --timeout <ms>       연결 타임아웃
  --include <list>     쉼표 구분: tools,resources,prompts
  --exclude <list>     제외할 기능 (쉼표 구분)
  -o, --output <file>  스펙을 파일에 저장
  --stdout             스펙을 stdout으로 출력
  --overwrite          기존 출력 파일 덮어쓰기
```

자세한 내용은 [docs/generate.md](docs/generate.md)를 참조하세요.

---

## 다국어 지원

CLI 출력은 여러 언어를 지원합니다.

```bash
# 플래그로 한국어 출력
mcp-workbench run tests.yaml --lang ko

# 환경변수로 한국어 출력
MCP_WORKBENCH_LANG=ko mcp-workbench inspect --command mcp-workbench-demo
```

| 로케일 | 언어 |
|--------|------|
| `en`   | 영어 (기본값) |
| `ko`   | 한국어 |

사용자에게 표시되는 CLI 메시지만 번역됩니다. JSON 출력(`--json`), 프로토콜 페이로드, 어서션 키는 항상 영어입니다.

새 로케일을 추가하려면 [docs/i18n.md](docs/i18n.md)를 참고하세요.

---

## 아키텍처

MCP Workbench는 pnpm 모노레포입니다.

| 이름 | npm 패키지 | 설명 |
|------|-----------|------|
| **MCP Workbench** | 제품명 | 프로젝트 전체 브랜드 |
| `@mcp-workbench/cli` | 기본 npm 패키지 | 전체 CLI 구현 |
| `mcp-workbench-cli` | 편의 래퍼 | 스코프 패키지로 전달하는 얇은 포워더 |
| `mcp-workbench` | CLI 커맨드 | 두 패키지 모두가 설치하는 바이너리 이름 |
| `mcp-workbench` / `mcp-workbench-vscode` / `mcp-workbench-mcp-server` | GitHub 저장소 | 소스 코드 저장소 |

내부 라이브러리는 `@mcp-workbench/*` 아래에 배포됩니다.

```
apps/
  cli                  — CLI 진입점 (mcp-workbench 커맨드)
  web                  — 브라우저 UI (Vite + React)
  api                  — UI와 MCP 패키지를 연결하는 API 서버

packages/
  protocol-kernel      — JSON-RPC 2.0 + MCP 타입, ProtocolKernel 클래스
  session-engine       — 세션 라이프사이클, Timeline 기록
  transport-stdio      — stdio 자식 프로세스 트랜스포트
  transport-http       — Streamable HTTP + SSE 트랜스포트
  assertions           — 어서션 엔진
  test-spec            — YAML 스펙 타입과 파서
  client-simulator     — Roots / sampling / elicitation 기능 시뮬레이터

examples/
  demo-mcp          — 데모 MCP 서버 (도구, 리소스, 프롬프트)
  fixtures/            — 예제 테스트 스펙
```

---

## Web UI

MCP Workbench는 브라우저 기반 인스펙터를 포함합니다. API 서버와 Vite 개발 서버를 시작하세요:

```bash
# 터미널 1 — API 서버
node apps/api/dist/index.js

# 터미널 2 — Web UI (http://localhost:5173)
pnpm --filter @mcp-workbench/web dev
```

Inspect 페이지에서 원하는 MCP 서버에 연결한 뒤 도구, 리소스, 프롬프트를 탐색하고 라이브 Protocol 로그를 확인하세요.

데모 서버로 시험해보려면 Inspect 페이지에 다음 값을 입력하세요:

| 필드 | 값 |
|------|----|
| Transport | stdio |
| Command | `mcp-workbench-demo` |
| Args | *(비워 두기)* |

**Protocol Inspector** — Protocol 탭은 모든 MCP 메시지(initialize, tools/call, resources/read 등)를 DevTools 스타일의 요청/응답 로그로 표시합니다. 구문 강조된 JSON 페이로드, 상태 표시기, 소요 시간이 함께 제공됩니다.

UI는 다크 모드와 라이트 모드를 지원합니다. 사이드바의 `☀`/`☾` 버튼으로 전환할 수 있습니다.

![Tool execution — Web UI](docs/assets/tool-execution.gif)

외부 도구(편집기 확장, CI 스크립트)는 [CLI JSON 계약](docs/integration-contract.md)을 기반으로 해야 합니다.

---

## 플러그인

MCP Workbench는 reporter와 커스텀 커맨드를 위한 확장 가능한 플러그인 시스템을 갖추고 있습니다.

```bash
# 테스트 실행 후 HTML 리포트 생성
mcp-workbench run tests.yaml \
  --plugin @mcp-workbench/plugin-html-report \
  --reporter html

# CI용 JUnit XML 생성 (GitHub Actions, Jenkins 등)
mcp-workbench run tests.yaml \
  --plugin @mcp-workbench/plugin-junit \
  --reporter junit \
  --reporter-output test-results.xml
```

또는 `workbench.config.yaml`에서 플러그인을 영구적으로 설정하세요:

```yaml
plugins:
  - "@mcp-workbench/plugin-html-report"
  - "@mcp-workbench/plugin-junit"
```

직접 플러그인을 만드는 방법을 포함한 전체 플러그인 가이드는 [docs/plugins.md](docs/plugins.md)를 참고하세요.

---

## VS Code 확장

공식 VS Code 확장은 별도 저장소에 있습니다: **[mcp-workbench-vscode](https://github.com/raeseoklee/mcp-workbench-vscode)**

- 편집기 타이틀 바 또는 Command Palette에서 스펙 실행
- 테스트 결과 트리 뷰 (스위트 → 테스트 → 어서션)
- 실패한 어서션은 Problems 패널에 표시
- CLI 경로와 타임아웃 설정 가능

자세한 내용은 [docs/vscode-extension.md](docs/vscode-extension.md)를 참고하세요.

---

## MCP 서버 (에이전트 연동)

Claude Desktop, Cursor 등 MCP 호스트에서 MCP Workbench를 직접 사용하려면 별도 프로젝트인 **[mcp-workbench-mcp-server](https://github.com/raeseoklee/mcp-workbench-mcp-server)**를 이용하세요.

inspect / generate / run 기능을 MCP tool로 노출해 AI 에이전트가 전체 워크플로를 직접 구동할 수 있습니다:

| 도구 | 설명 |
|------|------|
| `inspect_server` | 서버 capability 요약 |
| `generate_spec` | YAML 테스트 스펙 생성 후 텍스트로 반환 |
| `run_spec` | 스펙(인라인 텍스트 또는 파일 경로)을 실행하고 구조화된 결과 반환 |
| `explain_failure` | 실패 원인 분류 (인증, placeholder, 프로토콜 등) |

```json
// claude_desktop_config.json
{
  "mcpServers": {
    "mcp-workbench": {
      "command": "node",
      "args": ["/path/to/mcp-workbench-mcp-server/dist/index.js"]
    }
  }
}
```

> **진입점 구분:**
> `@mcp-workbench/cli`는 사람용 실행기.
> `mcp-workbench-mcp-server`는 에이전트용 MCP 어댑터.
> 둘 다 동일한 core 엔진을 사용합니다.

---

## 기여하기

[CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요.

---

## 라이선스

[Apache-2.0](LICENSE)
