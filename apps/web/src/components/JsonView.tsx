import styles from "./JsonView.module.css";

interface Props {
  value: unknown;
  maxHeight?: number;
}

export default function JsonView({ value, maxHeight }: Props) {
  return (
    <pre className={styles.pre} style={maxHeight ? { maxHeight } : undefined}>
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
