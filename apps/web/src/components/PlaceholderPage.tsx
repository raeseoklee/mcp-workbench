import styles from "./PlaceholderPage.module.css";

interface Props {
  title: string;
  description: string;
}

export default function PlaceholderPage({ title, description }: Props) {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.description}>{description}</p>
      <div className={styles.placeholder}>
        <span className={styles.placeholderIcon}>⬡</span>
        <span className={styles.placeholderText}>Coming soon</span>
      </div>
    </div>
  );
}
