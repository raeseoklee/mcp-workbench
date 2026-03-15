import { NavLink, Outlet } from "react-router-dom";
import styles from "./Layout.module.css";

const NAV_ITEMS = [
  { to: "/overview",   label: "Overview" },
  { to: "/inspect",    label: "Inspect" },
  { to: "/tools",      label: "Tools" },
  { to: "/resources",  label: "Resources" },
  { to: "/prompts",    label: "Prompts" },
  { to: "/timeline",   label: "Timeline" },
  { to: "/tests",      label: "Test Results" },
];

export default function Layout() {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <header className={styles.logo}>
          <span className={styles.logoIcon}>⬡</span>
          <span className={styles.logoText}>MCP Lab</span>
        </header>
        <nav className={styles.nav}>
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                [styles.navLink, isActive ? styles.navLinkActive : ""].join(" ").trim()
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <footer className={styles.sidebarFooter}>
          <span className={styles.version}>v0.1.0</span>
        </footer>
      </aside>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
