import styles from './EmptyState.module.scss'

interface EmptyStateProps {
  message: string
}

export const EmptyState = ({ message }: EmptyStateProps) => <p className={styles.root}>{message}</p>
