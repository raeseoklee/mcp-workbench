import { useState } from "react";
import { api } from "../api/client.js";
import styles from "./TestResultsPage.module.css";
import type { RunReport, TestResult, AssertionResult } from "../api/types.js";

type InputTab = "file" | "yaml";

const DEMO_YAML = `apiVersion: mcp-lab.dev/v0alpha1

server:
  transport: stdio
  command: node
  args:
    - examples/demo-server/dist/index.js

tests:
  - id: tools-list
    description: Server exposes tools
    act:
      method: tools/list
    assert:
      - kind: status
        equals: success
      - kind: notEmpty
        path: $.tools

  - id: get-weather
    description: Weather tool returns text for Seoul
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
`;

function statusIcon(s: TestResult["status"]) {
  if (s === "passed")  return <span className={styles.iconPass}>✓</span>;
  if (s === "failed")  return <span className={styles.iconFail}>✗</span>;
  if (s === "error")   return <span className={styles.iconError}>!</span>;
  return <span className={styles.iconSkip}>—</span>;
}

function AssertionRow({ ar }: { ar: AssertionResult }) {
  const label = ar.assertion.label ?? ar.assertion.kind as string;
  return (
    <div className={[styles.assertRow, ar.passed ? styles.assertPass : styles.assertFail].join(" ")}>
      <span className={styles.assertIcon}>{ar.passed ? "✓" : "✗"}</span>
      <span className={styles.assertLabel}>{label}</span>
      {!ar.passed && ar.message && <span className={styles.assertMsg}>{ar.message}</span>}
    </div>
  );
}

function TestRow({ t }: { t: TestResult }) {
  const [open, setOpen] = useState(false);
  const hasDetail = t.assertionResults.length > 0 || t.error;

  return (
    <div className={[styles.testRow, styles[`test_${t.status}`]].join(" ")}>
      <button
        className={styles.testHeader}
        onClick={() => hasDetail && setOpen((v) => !v)}
        disabled={!hasDetail}
      >
        <span className={styles.testStatus}>{statusIcon(t.status)}</span>
        <span className={styles.testId}>{t.testId}</span>
        {t.description && <span className={styles.testDesc}>{t.description}</span>}
        <span className={styles.testDuration}>{t.durationMs}ms</span>
        {hasDetail && <span className={styles.testChevron}>{open ? "▲" : "▼"}</span>}
      </button>

      {open && (
        <div className={styles.testDetail}>
          {t.error && <div className={styles.testError}>{t.error}</div>}
          {t.assertionResults.map((ar, i) => (
            <AssertionRow key={i} ar={ar} />
          ))}
        </div>
      )}
    </div>
  );
}

function Summary({ report }: { report: RunReport }) {
  const allPassed = report.failed === 0 && report.errors === 0;
  return (
    <div className={[styles.summary, allPassed ? styles.summaryPass : styles.summaryFail].join(" ")}>
      <span className={styles.summaryBadge}>{allPassed ? "PASS" : "FAIL"}</span>
      <span className={styles.summaryItem}><span className={styles.passNum}>{report.passed}</span> passed</span>
      {report.failed > 0   && <span className={styles.summaryItem}><span className={styles.failNum}>{report.failed}</span> failed</span>}
      {report.skipped > 0  && <span className={styles.summaryItem}><span className={styles.skipNum}>{report.skipped}</span> skipped</span>}
      {report.errors > 0   && <span className={styles.summaryItem}><span className={styles.errNum}>{report.errors}</span> errors</span>}
      <span className={styles.summaryDivider} />
      <span className={styles.summaryTime}>{report.durationMs}ms</span>
    </div>
  );
}

export default function TestResultsPage() {
  const [tab, setTab] = useState<InputTab>("yaml");
  const [specFile, setSpecFile] = useState("examples/fixtures/demo-server.yaml");
  const [specContent, setSpecContent] = useState(DEMO_YAML);
  const [tags, setTags] = useState("");
  const [ids, setIds] = useState("");
  const [bail, setBail] = useState(false);
  const [timeout, setTimeout_] = useState("");

  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<RunReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runTests() {
    setRunning(true);
    setReport(null);
    setError(null);
    try {
      const options = {
        tags: tags.trim() ? tags.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        ids: ids.trim() ? ids.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        bail: bail || undefined,
        timeoutMs: timeout.trim() ? Number(timeout) : undefined,
      };
      const r = await api.runs.submit(
        tab === "file"
          ? { specFile, options }
          : { specContent, options }
      );
      setReport(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Test Runner</h1>
      </div>

      {/* ── Input ── */}
      <section className={styles.inputSection}>
        <div className={styles.tabs}>
          <button
            className={[styles.tab, tab === "yaml" ? styles.tabActive : ""].join(" ")}
            onClick={() => setTab("yaml")}
          >YAML</button>
          <button
            className={[styles.tab, tab === "file" ? styles.tabActive : ""].join(" ")}
            onClick={() => setTab("file")}
          >File Path</button>
        </div>

        {tab === "file" ? (
          <input
            className={styles.input}
            placeholder="examples/fixtures/demo-server.yaml"
            value={specFile}
            onChange={(e) => setSpecFile(e.target.value)}
          />
        ) : (
          <textarea
            className={styles.editor}
            value={specContent}
            onChange={(e) => setSpecContent(e.target.value)}
            spellCheck={false}
          />
        )}

        <div className={styles.options}>
          <input
            className={styles.optInput}
            placeholder="tags (comma-separated)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
          <input
            className={styles.optInput}
            placeholder="ids (comma-separated)"
            value={ids}
            onChange={(e) => setIds(e.target.value)}
          />
          <input
            className={styles.optInput}
            placeholder="timeout (ms)"
            value={timeout}
            onChange={(e) => setTimeout_(e.target.value)}
            style={{ width: 110 }}
          />
          <label className={styles.bailLabel}>
            <input type="checkbox" checked={bail} onChange={(e) => setBail(e.target.checked)} />
            bail
          </label>
          <button className={styles.runBtn} onClick={runTests} disabled={running}>
            {running ? "Running…" : "▶ Run Tests"}
          </button>
        </div>
      </section>

      {/* ── Results ── */}
      {error && <div className={styles.error}>{error}</div>}

      {report && (
        <section className={styles.results}>
          <Summary report={report} />
          <div className={styles.testList}>
            {report.tests.map((t) => <TestRow key={t.testId} t={t} />)}
          </div>
        </section>
      )}

      {!report && !error && !running && (
        <div className={styles.empty}>
          Fill in a spec above and click <strong>Run Tests</strong> to see results.
        </div>
      )}
    </div>
  );
}
