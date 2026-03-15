import { useState, useEffect } from "react";
import { useSession } from "../context/SessionContext.js";
import NoSession from "../components/NoSession.js";
import { api } from "../api/client.js";
import styles from "./ResourcesPage.module.css";
import type { ResourceInfo, ResourceContent } from "../api/types.js";

export default function ResourcesPage() {
  const { session } = useSession();
  const [resources, setResources] = useState<ResourceInfo[]>([]);
  const [selected, setSelected] = useState<ResourceInfo | null>(null);
  const [content, setContent] = useState<ResourceContent | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session) return;
    api.resources.list(session.id).then((r) => setResources(r.resources)).catch(() => {});
  }, [session]);

  async function loadContent(r: ResourceInfo) {
    if (!session) return;
    setSelected(r);
    setContent(null);
    setLoading(true);
    try {
      const result = await api.resources.read(session.id, r.uri);
      setContent(result.contents[0] ?? null);
    } catch {
      setContent(null);
    } finally {
      setLoading(false);
    }
  }

  if (!session) return <NoSession />;

  return (
    <div className={styles.layout}>
      <aside className={styles.list}>
        <h2 className={styles.listTitle}>Resources <span className={styles.count}>{resources.length}</span></h2>
        {resources.map((r) => (
          <button
            key={r.uri}
            className={[styles.item, selected?.uri === r.uri ? styles.itemActive : ""].join(" ").trim()}
            onClick={() => void loadContent(r)}
          >
            <span className={styles.itemName}>{r.name}</span>
            <span className={styles.itemUri}>{r.uri}</span>
          </button>
        ))}
      </aside>

      <div className={styles.detail}>
        {!selected ? (
          <p className={styles.hint}>Select a resource to read its content.</p>
        ) : (
          <>
            <h1 className={styles.resName}>{selected.name}</h1>
            <p className={styles.resUri}>{selected.uri}</p>
            {selected.mimeType && <p className={styles.resMime}>{selected.mimeType}</p>}

            <div className={styles.content}>
              {loading ? (
                <p className={styles.hint}>Loading…</p>
              ) : content ? (
                <pre className={styles.text}>{content.text ?? content.blob}</pre>
              ) : (
                <p className={styles.hint}>No content.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
