import type { ComponentType, CSSProperties, ReactNode, SVGProps } from 'react'
import clsx from 'clsx'
import styles from './ComponentCard.module.scss'

interface ComponentCardProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  accentColor: string
  title: string
  subtitle?: string
  isArchived?: boolean
  children?: ReactNode
}

// Общая карточка для всех трёх типов (установка/узел/деталь). Конкретика —
// в entities/*/ui/*Card.tsx, которые её оборачивают (docs/structure.md).
export const ComponentCard = ({
  icon: Icon,
  accentColor,
  title,
  subtitle,
  isArchived,
  children,
}: ComponentCardProps) => {
  const style = { '--accent': accentColor } satisfies CSSProperties

  return (
    <article className={clsx(styles.root, isArchived && styles.archived)} style={style}>
      <Icon className={styles.icon} aria-hidden="true" />
      <div className={styles.body}>
        <h3 className={styles.title}>{title}</h3>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        {children}
      </div>
    </article>
  )
}
