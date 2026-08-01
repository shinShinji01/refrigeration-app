import type { ButtonHTMLAttributes, ComponentType, SVGProps } from 'react'
import clsx from 'clsx'
import styles from './IconButton.module.scss'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  label: string
}

export const IconButton = ({ icon: Icon, label, className, ...rest }: IconButtonProps) => {
  return (
    <button type="button" aria-label={label} className={clsx(styles.root, className)} {...rest}>
      <Icon className={styles.icon} aria-hidden="true" />
    </button>
  )
}
