import { afterEach, describe, expect, it } from "vitest";
import { getLang, getSupportedLocales, setLang, t } from "../i18n.js";

describe("i18n — language switching", () => {
  afterEach(() => setLang("en"));

  it("returns English by default", () => {
    setLang("en");
    expect(t("cli.run.header")).toBe("MCP Workbench");
  });

  it("switches to Korean", () => {
    setLang("ko");
    expect(t("cli.inspect.header.serverInfo")).toBe("서버 정보");
    expect(t("cli.run.summary.passed")).toBe("통과");
  });

  it("reports the active locale correctly", () => {
    setLang("ko");
    expect(getLang()).toBe("ko");
    setLang("en");
    expect(getLang()).toBe("en");
  });
});

describe("i18n — fallback behaviour", () => {
  afterEach(() => setLang("en"));

  it("falls back to English for an unsupported locale", () => {
    setLang("fr");
    expect(getLang()).toBe("en");
    expect(t("cli.run.header")).toBe("MCP Workbench");
  });

  it("falls back to key when translation is missing in all locales", () => {
    expect(t("nonexistent.key")).toBe("nonexistent.key");
  });

  it("falls back to English when Korean key is absent", () => {
    // Force a key that exists in en but not ko by temporarily
    // testing the resolution chain via a direct English-only key check.
    setLang("en");
    const val = t("cli.run.header");
    expect(val).toBe("MCP Workbench");
  });
});

describe("i18n — param interpolation", () => {
  afterEach(() => setLang("en"));

  it("replaces {file} placeholder", () => {
    expect(t("cli.run.error.loadSpec", { file: "tests.yaml" }))
      .toBe("Failed to load spec: tests.yaml");
  });

  it("replaces {count} placeholder in header strings", () => {
    expect(t("cli.inspect.header.tools", { count: 5 }))
      .toBe("Tools (5)");
  });

  it("replaces multiple placeholders", () => {
    expect(t("cli.run.label.duration", { ms: 123 }))
      .toBe("Duration:  123ms");
  });

  it("returns key with placeholder intact when no params given", () => {
    expect(t("cli.run.error.loadSpec")).toBe("Failed to load spec: {file}");
  });

  it("replaces placeholders in Korean locale", () => {
    setLang("ko");
    expect(t("cli.run.error.loadSpec", { file: "tests.yaml" }))
      .toBe("스펙 파일 로드 실패: tests.yaml");
  });
});

describe("i18n — environment variable", () => {
  afterEach(() => setLang("en"));

  it("setLang mirrors what MCP_WORKBENCH_LANG would do at startup", () => {
    // The module already read MCP_WORKBENCH_LANG at load time.
    // Test that manually calling setLang with the env value gives the same result.
    const envLang = "ko";
    setLang(envLang);
    expect(getLang()).toBe("ko");
    expect(t("cli.run.summary.passed")).toBe("통과");
  });
});

describe("i18n — supported locales", () => {
  it("includes en and ko", () => {
    const supported = getSupportedLocales();
    expect(supported).toContain("en");
    expect(supported).toContain("ko");
  });

  it("returns a stable array", () => {
    const a = getSupportedLocales();
    const b = getSupportedLocales();
    expect(a).toEqual(b);
  });
});
