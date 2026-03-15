import { Link } from "react-router-dom";
import styles from "./NoSession.module.css";

export default function NoSession() {
  return (
    <div className={styles.wrap}>
      <p className={styles.text}>No server connected.</p>
      <Link to="/inspect" className={styles.link}>Go to Inspect to connect →</Link>
    </div>
  );
}
