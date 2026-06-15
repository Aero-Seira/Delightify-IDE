import type { ReactElement, ReactNode } from 'react';
import styles from './style.module.css';

export function LoadingState({ label }: { label?: string }): ReactElement {
  return (
    <div className={styles.loading}>
      <div className={styles.spinner} />
      {label && <p>{label}</p>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  children,
}: {
  icon?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}): ReactElement {
  return (
    <div className={styles.empty}>
      {icon && <div className={styles.icon}>{icon}</div>}
      {title && <h3>{title}</h3>}
      {description && <div className={styles.description}>{description}</div>}
      {children && <div className={styles.actions}>{children}</div>}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  retryLabel = '重试',
}: {
  message: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
}): ReactElement {
  return (
    <div className={styles.error}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div className={styles.message}>{message}</div>
      {onRetry && <button onClick={onRetry}>{retryLabel}</button>}
    </div>
  );
}
