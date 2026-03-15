import { useState } from "react";
import { useSession } from "../context/SessionContext.js";
import JsonView from "../components/JsonView.js";
import styles from "./InspectPage.module.css";
import type { SessionConfig } from "../api/types.js";

type Transport = "stdio" | "streamable-http";

export default function InspectPage() {
  const { session, connecting, error, connect, disconnect } = useSession();

  const [transport, setTransport] = useState<Transport>("stdio");
  const [command, setCommand] = useState("node");
  const [args, setArgs] = useState("");
  const [url, setUrl] = useState("http://localhost:3000");

  function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    const config: SessionConfig =
      transport === "stdio"
        ? { transport: "stdio", command, args: args.split(/\s+/).filter(Boolean) }
        : { transport: "streamable-http", url };
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

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.connectBtn} type="submit" disabled={connecting}>
          {connecting ? "Connecting…" : "Connect"}
        </button>
      </form>
    </div>
  );
}
