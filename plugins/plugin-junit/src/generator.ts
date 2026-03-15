import type { RunReport, TestResultSummary } from "@mcp-workbench/plugin-sdk";

/**
 * Generates JUnit XML compatible with GitHub Actions, Jenkins, GitLab CI, etc.
 *
 * Schema: https://www.ibm.com/docs/en/developer-for-zos/16.0?topic=formats-junit-xml-format
 */
export function generateJUnit(report: RunReport, specFile?: string): string {
  const suiteName = specFile ?? "mcp-workbench";
  const totalTime = (report.durationMs / 1000).toFixed(3);
  const testcases = report.tests.map((t) => renderTestcase(t, suiteName)).join("\n    ");

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<testsuites name="MCP Workbench" time="${totalTime}" tests="${report.total}" failures="${report.failed}" errors="${report.errors}" skipped="${report.skipped}">`,
    `  <testsuite name="${esc(suiteName)}" tests="${report.total}" failures="${report.failed}" errors="${report.errors}" skipped="${report.skipped}" time="${totalTime}">`,
    `    ${testcases}`,
    `  </testsuite>`,
    `</testsuites>`,
  ].join("\n");
}

function renderTestcase(t: TestResultSummary, suiteName: string): string {
  const time = (t.durationMs / 1000).toFixed(3);
  const classname = esc(suiteName);
  const name = esc(t.description ? `${t.testId}: ${t.description}` : t.testId);
  const open = `<testcase name="${name}" classname="${classname}" time="${time}">`;

  if (t.status === "skipped") {
    return `${open}\n      <skipped/>\n    </testcase>`;
  }

  if (t.status === "error") {
    const msg = esc(t.error ?? "Unknown error");
    return `${open}\n      <error message="${msg}"/>\n    </testcase>`;
  }

  if (t.status === "failed") {
    const failures = t.assertionResults
      .filter((a) => !a.passed)
      .map((a) => {
        const label = esc(a.assertion.label ?? a.assertion.kind);
        const msg = esc(a.message ?? `Assertion "${a.assertion.kind}" failed`);
        const body = a.diff ? `\n${esc(a.diff)}` : "";
        return `<failure message="${msg}" type="${label}">${body}</failure>`;
      })
      .join("\n      ");
    return `${open}\n      ${failures}\n    </testcase>`;
  }

  // passed
  return `${open}</testcase>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
