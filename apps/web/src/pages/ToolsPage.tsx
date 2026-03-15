import { useState, useEffect } from "react";
import { useSession } from "../context/SessionContext.js";
import NoSession from "../components/NoSession.js";
import JsonView from "../components/JsonView.js";
import { api } from "../api/client.js";
import styles from "./ToolsPage.module.css";
import type { ToolInfo, ToolCallResult } from "../api/types.js";

export default function ToolsPage() {
  const { session } = useSession();
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [selected, setSelected] = useState<ToolInfo | null>(null);
  const [argsText, setArgsText] = useState("{}");
  const [result, setResult] = useState<ToolCallResult | null>(null);
  const [calling, setCalling] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    api.tools.list(session.id).then((r) => setTools(r.tools)).catch(() => {});
  }, [session]);

  useEffect(() => {
    if (!selected) return;
    const schema = selected.inputSchema;
    if (schema?.properties) {
      const defaults: Record<string, string> = {};
      for (const k of Object.keys(schema.properties)) defaults[k] = "";
      setArgsText(JSON.stringify(defaults, null, 2));
    } else {
      setArgsText("{}");
    }
    setResult(null);
    setCallError(null);
  }, [selected]);

  async function callTool() {
    if (!session || !selected) return;
    setCalling(true);
    setCallError(null);
    try {
      const args = JSON.parse(argsText) as Record<string, unknown>;
      const r = await api.tools.call(session.id, selected.name, args);
      setResult(r);
    } catch (err) {
      setCallError(err instanceof Error ? err.message : String(err));
    } finally {
      setCalling(false);
    }
  }

  if (!session) return <NoSession />;

  return (
    <div className={styles.layout}>
      <aside className={styles.list}>
        <h2 className={styles.listTitle}>Tools <span className={styles.count}>{tools.length}</span></h2>
        {tools.map((t) => (
          <button
            key={t.name}
            className={[styles.item, selected?.name === t.name ? styles.itemActive : ""].join(" ").trim()}
            onClick={() => setSelected(t)}
          >
            <span className={styles.itemName}>{t.annotations?.title ?? t.name}</span>
            {t.annotations?.readOnlyHint && <span className={styles.badge}>read-only</span>}
            {t.annotations?.destructiveHint && <span className={[styles.badge, styles.badgeDanger].join(" ")}>destructive</span>}
          </button>
        ))}
      </aside>

      <div className={styles.detail}>
        {!selected ? (
          <p className={styles.hint}>Select a tool to inspect and run it.</p>
        ) : (
          <>
            <h1 className={styles.toolName}>{selected.annotations?.title ?? selected.name}</h1>
            {selected.name !== (selected.annotations?.title) && (
              <p className={styles.toolId}>{selected.name}</p>
            )}
            {selected.description && <p className={styles.toolDesc}>{selected.description}</p>}

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Input Schema</h3>
              <JsonView value={selected.inputSchema ?? {}} maxHeight={200} />
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Arguments (JSON)</h3>
              <textarea
                className={styles.argsInput}
                value={argsText}
                onChange={(e) => setArgsText(e.target.value)}
                rows={6}
                spellCheck={false}
              />
              {callError && <p className={styles.error}>{callError}</p>}
              <button className={styles.runBtn} onClick={() => void callTool()} disabled={calling}>
                {calling ? "Running…" : "Run Tool"}
              </button>
            </section>

            {result && (
              <section className={styles.section}>
                <h3 className={[styles.sectionTitle, result.isError ? styles.errorTitle : ""].join(" ").trim()}>
                  Result {result.isError ? "(error)" : ""}
                </h3>
                {result.content.map((block, i) => (
                  <div key={i} className={styles.contentBlock}>
                    {block.type === "text"
                      ? <pre className={styles.textResult}>{block.text}</pre>
                      : <JsonView value={block} />
                    }
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
