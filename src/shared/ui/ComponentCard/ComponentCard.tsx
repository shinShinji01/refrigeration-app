import type { ComponentType, CSSProperties, ReactNode, SVGProps } from 'react'
import clsx from 'clsx'
import EditIcon from '@/shared/assets/icons/edit.svg?react'
import { Checkbox } from '../Checkbox'
import { IconButton } from '../IconButton'
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
  // Кнопка редактирования по ховеру/фокусу (docs/spec.md → "Список карточек").
  onEdit?: () => void
  // Фиксированная высота с обрезкой лишнего контента, разворачивается по
  // ховеру/фокусу — для карточек-детей в сетке (не для выбранной слева).
  compact?: boolean
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
  onEdit,
  compact,
}: ComponentCardProps) => {
  const style = { '--accent': accentColor } satisfies CSSProperties

  return (
    <article
      className={clsx(
        styles.root,
        isArchived && styles.archived,
        selected && styles.selected,
        compact && styles.compact,
      )}
      style={style}
    >
      {onSelectedChange || onEdit ? (
        <div className={styles.cornerActions}>
          {onEdit ? <IconButton icon={EditIcon} label={`Редактировать: ${title}`} onClick={onEdit} /> : null}
          {onSelectedChange ? (
            <Checkbox
              checked={selected ?? false}
              onCheckedChange={onSelectedChange}
              label={selectLabel ?? title}
              hideLabel
            />
          ) : null}
        </div>
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
