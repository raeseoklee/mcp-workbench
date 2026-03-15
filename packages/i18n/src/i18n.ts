/**
 * Lightweight i18n for MCP Workbench.
 *
 * Design goals:
 *  - Zero runtime dependencies
 *  - Works in Node.js and browser environments
 *  - Simple flat key → string dictionary
 *  - Param interpolation with {param} placeholders
 *  - Fallback to English, then to the key itself
 *
 * Language resolution order (highest → lowest priority):
 *  1. setLang() call (e.g. from --lang CLI flag)
 *  2. MCP_WORKBENCH_LANG environment variable
 *  3. Default: "en"
 *
 * Locale data is inlined at build time for browser compatibility.
 * The canonical JSON sources live in packages/i18n/locales/*.json —
 * update both the JSON file and the corresponding object below when
 * adding or changing translations.
 */

export type LocaleDict = Record<string, string>;

// ─── Locale data ──────────────────────────────────────────────────────────────
// Keep in sync with locales/en.json

const en: LocaleDict = {
  "cli.run.error.loadSpec": "Failed to load spec: {file}",
  "cli.run.error.runner": "Runner error: {error}",
  "cli.run.header": "MCP Workbench",
  "cli.run.label.spec": "Spec:      {file}",
  "cli.run.label.transport": "Transport: {transport}",
  "cli.run.label.tests": "Tests:     {count}",
  "cli.run.label.mode.updateSnapshots": "Mode:      update snapshots",
  "cli.run.label.duration": "Duration:  {ms}ms",
  "cli.run.label.snapshots": "Snapshots: {n} written",
  "cli.run.summary.tests": "Tests:",
  "cli.run.summary.passed": "passed",
  "cli.run.summary.failed": "failed",
  "cli.run.summary.errors": "errors",
  "cli.run.summary.skipped": "skipped",
  "cli.run.summary.total": "total",
  "cli.run.assertion.defaultFail": "assertion \"{kind}\" failed",
  "cli.run.assertion.actual": "actual: {value}",
  "cli.inspect.error.noCommand": "--command is required for stdio transport",
  "cli.inspect.error.noUrl": "--url is required for HTTP transport",
  "cli.inspect.header.serverInfo": "Server Info",
  "cli.inspect.header.capabilities": "Capabilities",
  "cli.inspect.header.tools": "Tools ({count})",
  "cli.inspect.header.resources": "Resources ({count})",
  "cli.inspect.header.prompts": "Prompts ({count})",
  "cli.inspect.label.name": "Name:    ",
  "cli.inspect.label.version": "Version: ",
  "cli.inspect.label.protocol": "Protocol:",
  "cli.inspect.label.instructions": "Instructions:",
  "cli.inspect.annotation.destructive": "[destructive]",
  "cli.inspect.annotation.readonly": "[read-only]",
};

// Keep in sync with locales/ko.json

const ko: LocaleDict = {
  "cli.run.error.loadSpec": "스펙 파일 로드 실패: {file}",
  "cli.run.error.runner": "런너 오류: {error}",
  "cli.run.header": "MCP Workbench",
  "cli.run.label.spec": "스펙:      {file}",
  "cli.run.label.transport": "전송:      {transport}",
  "cli.run.label.tests": "테스트:    {count}",
  "cli.run.label.mode.updateSnapshots": "모드:      스냅샷 업데이트",
  "cli.run.label.duration": "소요 시간: {ms}ms",
  "cli.run.label.snapshots": "스냅샷:    {n}개 저장됨",
  "cli.run.summary.tests": "테스트:",
  "cli.run.summary.passed": "통과",
  "cli.run.summary.failed": "실패",
  "cli.run.summary.errors": "오류",
  "cli.run.summary.skipped": "건너뜀",
  "cli.run.summary.total": "전체",
  "cli.run.assertion.defaultFail": "어서션 \"{kind}\" 실패",
  "cli.run.assertion.actual": "실제값: {value}",
  "cli.inspect.error.noCommand": "--command 옵션은 stdio 전송에 필수입니다",
  "cli.inspect.error.noUrl": "--url 옵션은 HTTP 전송에 필수입니다",
  "cli.inspect.header.serverInfo": "서버 정보",
  "cli.inspect.header.capabilities": "기능",
  "cli.inspect.header.tools": "도구 ({count})",
  "cli.inspect.header.resources": "리소스 ({count})",
  "cli.inspect.header.prompts": "프롬프트 ({count})",
  "cli.inspect.label.name": "이름:    ",
  "cli.inspect.label.version": "버전:    ",
  "cli.inspect.label.protocol": "프로토콜:",
  "cli.inspect.label.instructions": "지침:",
  "cli.inspect.annotation.destructive": "[파괴적]",
  "cli.inspect.annotation.readonly": "[읽기 전용]",
};

// ─── Registry ─────────────────────────────────────────────────────────────────

const LOCALES: Record<string, LocaleDict> = { en, ko };
const SUPPORTED = new Set(Object.keys(LOCALES));
const FALLBACK = "en";

let _lang = FALLBACK;

// Initialize from environment variable (browser-safe guard)
if (typeof process !== "undefined" && process.env) {
  const envLang = process.env["MCP_WORKBENCH_LANG"];
  if (envLang) _lang = SUPPORTED.has(envLang) ? envLang : FALLBACK;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Set the active locale. Falls back to "en" for unsupported locales. */
export function setLang(lang: string): void {
  _lang = SUPPORTED.has(lang) ? lang : FALLBACK;
}

/** Return the currently active locale code. */
export function getLang(): string {
  return _lang;
}

/** Return all registered locale codes. */
export function getSupportedLocales(): readonly string[] {
  return [...SUPPORTED];
}

/**
 * Translate a key into the current locale.
 *
 * @param key    Dot-separated translation key, e.g. "cli.run.header"
 * @param params Optional interpolation values, e.g. { file: "test.yaml" }
 * @returns      Translated string, English fallback, or the key itself
 *
 * @example
 * t("cli.run.error.loadSpec", { file: "tests.yaml" })
 * // → "Failed to load spec: tests.yaml"
 */
export function t(key: string, params?: Record<string, unknown>): string {
  const dict = LOCALES[_lang];
  const fallbackDict = LOCALES[FALLBACK];

  let str = dict?.[key] ?? fallbackDict?.[key] ?? key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replaceAll(`{${k}}`, String(v));
    }
  }

  return str;
}
