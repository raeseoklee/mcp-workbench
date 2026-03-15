import { useState } from "react";
import { useSession } from "../context/SessionContext.js";
import JsonView from "../components/JsonView.js";
import styles from "./InspectPage.module.css";
import type { SessionConfig, SimulatorConfig } from "../api/types.js";

type Transport = "stdio" | "streamable-http";
type ElicitAction = "none" | "accept" | "decline";

interface RootEntry { name: string; uri: string }

export default function InspectPage() {
  const { session, connecting, error, connect, disconnect } = useSession();

  const [transport, setTransport] = useState<Transport>("stdio");
  const [command, setCommand] = useState("node");
  const [args, setArgs] = useState("");
  const [url, setUrl] = useState("http://localhost:3000");

  // simulator state
  const [simOpen, setSimOpen] = useState(false);
  const [roots, setRoots] = useState<RootEntry[]>([]);
  const [samplingEnabled, setSamplingEnabled] = useState(false);
  const [samplingText, setSamplingText] = useState("");
  const [samplingModel, setSamplingModel] = useState("");
  const [elicitAction, setElicitAction] = useState<ElicitAction>("none");

  function buildSimulator(): SimulatorConfig | undefined {
    const hasRoots = roots.length > 0;
    const hasSampling = samplingEnabled;
    const hasElicit = elicitAction !== "none";
    if (!hasRoots && !hasSampling && !hasElicit) return undefined;
    return {
      roots: hasRoots ? roots : undefined,
      sampling: hasSampling
        ? samplingText
          ? { preset: { text: samplingText, model: samplingModel || undefined } }
          : {}
        : undefined,
      elicitation: hasElicit ? { action: elicitAction as "accept" | "decline" } : undefined,
    };
  }

  function addRoot() {
    setRoots((prev) => [...prev, { name: "", uri: "" }]);
  }

  function removeRoot(i: number) {
    setRoots((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateRoot(i: number, field: "name" | "uri", value: string) {
    setRoots((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    const simulator = buildSimulator();
    const config: SessionConfig =
      transport === "stdio"
        ? { transport: "stdio", command, args: args.split(/\s+/).filter(Boolean), simulator }
        : { transport: "streamable-http", url, simulator };
    void connect(config);
  }

  if (session) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>{session.serverInfo?.name ?? "MCP Server"}</h1>
            <p className={styles.sub}>v{session.serverInfo?.version} &middot; {session.config.transport}</p>
          </div>
          <button className={styles.disconnectBtn} onClick={() => void disconnect()}>
            Disconnect
          </button>
        </div>

        {session.serverInstructions && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Server Instructions</h2>
            <p className={styles.instructions}>{session.serverInstructions}</p>
          </section>
        )}

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Capabilities</h2>
          <div className={styles.capsGrid}>
            {Object.entries(session.serverCapabilities ?? {}).map(([cap, val]) => (
              <div key={cap} className={styles.capCard}>
                <span className={styles.capName}>{cap}</span>
                <span className={styles.capDetail}>{JSON.stringify(val)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Raw negotiate result</h2>
          <JsonView value={session} maxHeight={300} />
        </section>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Inspect</h1>
      <p className={styles.sub}>Connect to an MCP server to inspect its capabilities.</p>

      <form className={styles.form} onSubmit={handleConnect}>
        <div className={styles.field}>
          <label className={styles.label}>Transport</label>
          <div className={styles.tabs}>
            {(["stdio", "streamable-http"] as Transport[]).map((t) => (
              <button
                key={t}
                type="button"
                className={[styles.tab, transport === t ? styles.tabActive : ""].join(" ").trim()}
                onClick={() => setTransport(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {transport === "stdio" ? (
          <>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="command">Command</label>
              <input
                id="command"
                className={styles.input}
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="node"
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="args">Args (space separated)</label>
              <input
                id="args"
                className={styles.input}
                value={args}
                onChange={(e) => setArgs(e.target.value)}
                placeholder="path/to/server.js --flag"
              />
            </div>
          </>
        ) : (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="url">URL</label>
            <input
              id="url"
              className={styles.input}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:3000/mcp"
              required
            />
          </div>
        )}

        {/* ── Client Simulator ─────────────────────────────────────────── */}
        <div className={styles.simSection}>
          <button
            type="button"
            className={styles.simToggle}
            onClick={() => setSimOpen((v) => !v)}
          >
            <span className={simOpen ? styles.chevronOpen : styles.chevron}>›</span>
            Client Simulator
            <span className={styles.simOptional}>(optional)</span>
          </button>

          {simOpen && (
            <div className={styles.simBody}>
              {/* Roots */}
              <div className={styles.simGroup}>
                <div className={styles.simGroupHeader}>
                  <span className={styles.simGroupLabel}>Roots</span>
                  <button type="button" className={styles.addBtn} onClick={addRoot}>+ Add Root</button>
                </div>
                {roots.length === 0 && (
                  <p className={styles.simEmpty}>No roots configured.</p>
                )}
                {roots.map((root, i) => (
                  <div key={i} className={styles.rootRow}>
                    <input
                      className={styles.inputSm}
                      placeholder="name"
                      value={root.name}
                      onChange={(e) => updateRoot(i, "name", e.target.value)}
                    />
                    <input
                      className={[styles.inputSm, styles.inputFlex].join(" ")}
                      placeholder="file:///path/to/workspace"
                      value={root.uri}
                      onChange={(e) => updateRoot(i, "uri", e.target.value)}
                    />
                    <button type="button" className={styles.removeBtn} onClick={() => removeRoot(i)}>×</button>
                  </div>
                ))}
              </div>

              {/* Sampling */}
              <div className={styles.simGroup}>
                <div className={styles.simGroupHeader}>
                  <label className={styles.checkLabel}>
                    <input
                      type="checkbox"
                      checked={samplingEnabled}
                      onChange={(e) => setSamplingEnabled(e.target.checked)}
                    />
                    <span className={styles.simGroupLabel}>Sampling</span>
                  </label>
                </div>
                {samplingEnabled && (
                  <>
                    <div className={styles.field}>
                      <label className={styles.label}>Preset response text</label>
                      <textarea
                        className={styles.textarea}
                        rows={3}
                        placeholder="Leave blank to decline all sampling requests"
                        value={samplingText}
                        onChange={(e) => setSamplingText(e.target.value)}
                      />
                    </div>
                    {samplingText && (
                      <div className={styles.field}>
                        <label className={styles.label}>Model name (optional)</label>
                        <input
                          className={styles.input}
                          placeholder="e.g. claude-sonnet-4-6"
                          value={samplingModel}
                          onChange={(e) => setSamplingModel(e.target.value)}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Elicitation */}
              <div className={styles.simGroup}>
                <div className={styles.simGroupHeader}>
                  <span className={styles.simGroupLabel}>Elicitation</span>
                </div>
                <div className={styles.radioRow}>
                  {(["none", "accept", "decline"] as ElicitAction[]).map((a) => (
                    <label key={a} className={styles.radioLabel}>
                      <input
                        type="radio"
                        name="elicitation"
                        value={a}
                        checked={elicitAction === a}
                        onChange={() => setElicitAction(a)}
                      />
                      {a === "none" ? "disabled" : a}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.connectBtn} type="submit" disabled={connecting}>
          {connecting ? "Connecting…" : "Connect"}
        </button>
      </form>
    </div>
  );
}
