import styles from "./OverviewPage.module.css";

const FEATURE_CARDS = [
  {
    icon: "⬡",
    title: "Inspect",
    description: "Browse and call tools, resources, and prompts exposed by your MCP server.",
  },
  {
    icon: "⏱",
    title: "Timeline",
    description: "Replay every JSON-RPC message exchanged in a session — request, response, and notifications.",
  },
  {
    icon: "✓",
    title: "Test",
    description: "Run declarative YAML test specs with assertions, snapshots, and CI-ready exit codes.",
  },
  {
    icon: "⚡",
    title: "Simulate",
    description: "Respond to server→client requests (roots/list, sampling, elicitation) with fixture data.",
  },
];

export default function OverviewPage() {
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <h1 className={styles.heroTitle}>MCP Workbench</h1>
        <p className={styles.heroSub}>
          Inspect, test, and validate Model Context Protocol servers.
        </p>
        <div className={styles.heroBadge}>v0.1.0 &middot; MCP spec 2025-11-25</div>
      </header>

      <section className={styles.cards}>
        {FEATURE_CARDS.map((card) => (
          <div key={card.title} className={styles.card}>
            <span className={styles.cardIcon}>{card.icon}</span>
            <h2 className={styles.cardTitle}>{card.title}</h2>
            <p className={styles.cardDesc}>{card.description}</p>
          </div>
        ))}
      </section>

      <section className={styles.quickstart}>
        <h2 className={styles.sectionTitle}>Quick start</h2>
        <pre className={styles.codeBlock}>{`# Install
npm install -g mcp-workbench

# Run a test spec
mcp-workbench run examples/fixtures/demo-server.yaml

# Update snapshots
mcp-workbench run examples/fixtures/snapshot-example.yaml --update-snapshots`}</pre>
      </section>
    </div>
  );
}
