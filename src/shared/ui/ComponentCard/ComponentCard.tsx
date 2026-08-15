import type { ComponentType, CSSProperties, ReactNode, SVGProps } from 'react'
import clsx from 'clsx'
import EditIcon from '@/shared/assets/icons/edit.svg?react'
import ChevronIcon from '@/shared/assets/icons/chevron.svg?react'
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
  // Клик по карточке "проваливается" на уровень ниже (docs/superpowers/specs/
  // 2026-08-14-units-card-navigation-design.md) — только для unit/assembly
  // карточек-детей вне поиска, задаётся вызывающей стороной.
  onOpen?: () => void
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
  onOpen,
}: ComponentCardProps) => {
  const style: CSSProperties & { '--accent': string } = { '--accent': accentColor }

  const card = (
    <article
      className={clsx(
        styles.root,
        isArchived && styles.archived,
        selected && styles.selected,
        compact && styles.compactCard,
        onOpen && styles.clickable,
      )}
      style={style}
      onClick={onOpen}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={
        onOpen
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onOpen()
              }
            }
          : undefined
      }
    >
      {onSelectedChange || onEdit ? (
        <div
          className={styles.cornerActions}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
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
      {onOpen ? <ChevronIcon className={styles.openChevron} aria-hidden="true" /> : null}
    </article>
  )

  // От планшета и выше слот держит фиксированную высоту в сетке, а сама
  // карточка внутри абсолютно спозиционирована — разворот по ховеру не
  // двигает соседние ряды сетки, а рисуется поверх них (см. .module.scss).
  return compact ? <div className={styles.compactSlot}>{card}</div> : card
}
