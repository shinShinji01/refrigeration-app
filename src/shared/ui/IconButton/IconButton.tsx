import type { ButtonHTMLAttributes, ComponentType, SVGProps } from 'react'
import clsx from 'clsx'
import styles from './IconButton.module.scss'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  label: string
  loading?: boolean
}

export const IconButton = ({ icon: Icon, label, loading = false, className, ...rest }: IconButtonProps) => {
  return (
    <button
      type="button"
      aria-label={label}
      aria-busy={loading || undefined}
      className={clsx(styles.root, className)}
      {...rest}
    >
      {loading ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : (
        <Icon className={styles.icon} aria-hidden="true" />
      )}
    </button>
  )
}
