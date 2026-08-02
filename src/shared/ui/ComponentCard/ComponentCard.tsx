import type { ComponentType, CSSProperties, ReactNode, SVGProps } from 'react'
import clsx from 'clsx'
import { Checkbox } from '../Checkbox'
import styles from './ComponentCard.module.scss'

interface ComponentCardProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  accentColor: string
  title: string
  subtitle?: string
  isArchived?: boolean
  children?: ReactNode
  // Выделение карточки (docs/spec.md → "Список карточек"): чекбокс по
  // ховеру/фокусу, сама карточка подсвечивается. Опционально — карточка
  // используется и вне списков с выделением (см. split-раскладку).
  selected?: boolean
  onSelectedChange?: (selected: boolean) => void
  selectLabel?: string
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
  selected,
  onSelectedChange,
  selectLabel,
}: ComponentCardProps) => {
  const style = { '--accent': accentColor } satisfies CSSProperties

  return (
    <article
      className={clsx(styles.root, isArchived && styles.archived, selected && styles.selected)}
      style={style}
    >
      {onSelectedChange ? (
        <span className={styles.selectToggle}>
          <Checkbox
            checked={selected ?? false}
            onCheckedChange={onSelectedChange}
            label={selectLabel ?? title}
            hideLabel
          />
        </span>
      ) : null}
      <Icon className={styles.icon} aria-hidden="true" />
      <div className={styles.body}>
        <h3 className={styles.title}>{title}</h3>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        {children}
      </div>
    </article>
  )
}
