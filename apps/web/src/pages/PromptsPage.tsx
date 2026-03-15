import { useState, useEffect } from "react";
import { useSession } from "../context/SessionContext.js";
import NoSession from "../components/NoSession.js";
import { api } from "../api/client.js";
import styles from "./PromptsPage.module.css";
import type { PromptInfo, PromptResult } from "../api/types.js";

export default function PromptsPage() {
  const { session } = useSession();
  const [prompts, setPrompts] = useState<PromptInfo[]>([]);
  const [selected, setSelected] = useState<PromptInfo | null>(null);
  const [argValues, setArgValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<PromptResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session) return;
    api.prompts.list(session.id).then((r) => setPrompts(r.prompts)).catch(() => {});
  }, [session]);

  useEffect(() => {
    if (!selected) return;
    const defaults: Record<string, string> = {};
    for (const arg of selected.arguments ?? []) defaults[arg.name] = "";
    setArgValues(defaults);
    setResult(null);
  }, [selected]);

  async function getPrompt() {
    if (!session || !selected) return;
    setLoading(true);
    try {
      const r = await api.prompts.get(session.id, selected.name, argValues);
      setResult(r);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  if (!session) return <NoSession />;

  return (
    <div className={styles.layout}>
      <aside className={styles.list}>
        <h2 className={styles.listTitle}>Prompts <span className={styles.count}>{prompts.length}</span></h2>
        {prompts.map((p) => (
          <button
            key={p.name}
            className={[styles.item, selected?.name === p.name ? styles.itemActive : ""].join(" ").trim()}
            onClick={() => setSelected(p)}
          >
            <span className={styles.itemName}>{p.name}</span>
          </button>
        ))}
      </aside>

      <div className={styles.detail}>
        {!selected ? (
          <p className={styles.hint}>Select a prompt to preview it.</p>
        ) : (
          <>
            <h1 className={styles.promptName}>{selected.name}</h1>
            {selected.description && <p className={styles.promptDesc}>{selected.description}</p>}

            {(selected.arguments?.length ?? 0) > 0 && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Arguments</h3>
                {selected.arguments!.map((arg) => (
                  <div key={arg.name} className={styles.argField}>
                    <label className={styles.argLabel}>
                      {arg.name}
                      {arg.required && <span className={styles.required}> *</span>}
                    </label>
                    {arg.description && <p className={styles.argDesc}>{arg.description}</p>}
                    <input
                      className={styles.argInput}
                      value={argValues[arg.name] ?? ""}
                      onChange={(e) => setArgValues((prev) => ({ ...prev, [arg.name]: e.target.value }))}
                      placeholder={arg.description}
                    />
                  </div>
                ))}
              </section>
            )}

            <button className={styles.runBtn} onClick={() => void getPrompt()} disabled={loading}>
              {loading ? "Loading…" : "Get Prompt"}
            </button>

            {result && (
              <section className={styles.section}>
                {result.description && <p className={styles.resultDesc}>{result.description}</p>}
                <div className={styles.messages}>
                  {result.messages.map((msg, i) => (
                    <div key={i} className={[styles.msg, msg.role === "assistant" ? styles.msgAssistant : ""].join(" ").trim()}>
                      <span className={styles.msgRole}>{msg.role}</span>
                      <p className={styles.msgText}>{msg.content.text}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
