import type { CSSProperties, KeyboardEvent } from 'react'
import clsx from 'clsx'
import TypeInsulationIcon from '@/shared/assets/icons/type-insulation.svg?react'
import CheckIcon from '@/shared/assets/icons/check.svg?react'
import MinusIcon from '@/shared/assets/icons/minus.svg?react'
import { IconButton } from '@/shared/ui'
import { formatArea } from '@/shared/lib/utils'
import type { InsulationPieceWithQuantity } from '../model/types'
import styles from './InsulationPieceCard.module.scss'

interface InsulationPieceCardProps {
  piece: InsulationPieceWithQuantity
  // Сколько единиц куска уже отрезано. Для piece.quantity === 1 принимает
  // только 0 или 1 (карточка ведёт себя как раньше — простой тоггл).
  doneCount: number
  onChangeCount: (nextCount: number) => void
  detailed?: boolean
  groupLabel?: string
}

const ACCENT = '#4a7a96'

const formatDimensions = (piece: InsulationPieceWithQuantity): string =>
  piece.geometry.kind === 'rect' ? `${piece.geometry.width} × ${piece.geometry.height} мм` : 'Многоугольник'

export const InsulationPieceCard = ({
  piece,
  doneCount,
  onChangeCount,
  detailed = true,
  groupLabel,
}: InsulationPieceCardProps) => {
  const style: CSSProperties & { '--accent': string } = { '--accent': ACCENT }
  const subtitle = piece.drawingNumbers.length > 0 ? piece.drawingNumbers.join(', ') : piece.id
  const hasStepper = piece.quantity > 1
  const isFull = doneCount >= piece.quantity
  const isPartial = doneCount > 0 && !isFull

  const body = (
    <div className={styles.body}>
      {groupLabel ? <span className={styles.groupLabel}>{groupLabel}</span> : null}
      <h4 className={styles.title}>{piece.name}</h4>
      {detailed ? <p className={styles.subtitle}>{subtitle}</p> : null}
      <dl className={styles.stats}>
        <div className={styles.stat}>
          <dt>Размер</dt>
          <dd>{formatDimensions(piece)}</dd>
        </div>
        <div className={styles.stat}>
          <dt>Толщина</dt>
          <dd>{piece.thicknessMm} мм</dd>
        </div>
        {detailed ? (
          <div className={styles.stat}>
            <dt>Площадь</dt>
            <dd>{formatArea(piece.areaMm2)}</dd>
          </div>
        ) : null}
      </dl>
      {detailed && piece.hasAdhesive ? <span className={styles.adhesive}>Клеевой слой</span> : null}
    </div>
  )

  // quantity === 1 — подавляющее большинство карточек: разметка и поведение
  // не меняются относительно того, что было до частичного прогресса
  // (docs/superpowers/specs/2026-08-11-...) — вся карточка кликабельна,
  // один тап переключает 0 ↔ 1.
  if (!hasStepper) {
    const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onChangeCount(isFull ? 0 : 1)
      }
    }

    return (
      <article
        className={clsx(styles.root, piece.isArchived && styles.archived, isFull && styles.done)}
        style={style}
        role="button"
        tabIndex={0}
        aria-pressed={isFull}
        aria-label={`${piece.name}${isFull ? ', готово' : ', отметить готовым'}`}
        onClick={() => onChangeCount(isFull ? 0 : 1)}
        onKeyDown={handleKeyDown}
      >
        <TypeInsulationIcon className={styles.icon} aria-hidden="true" />
        {body}
        {isFull ? <CheckIcon className={styles.doneIcon} aria-hidden="true" /> : null}
      </article>
    )
  }

  // quantity > 1 — степпер. <article> больше не role="button" (нельзя
  // вкладывать <button> в элемент с role="button"): основная область — свой
  // <button> ("increment"), кнопка "−" — соседний элемент, не вложенный.
  return (
    <article
      className={clsx(
        styles.root,
        styles.withStepper,
        piece.isArchived && styles.archived,
        isFull && styles.done,
        isPartial && styles.partial,
      )}
      style={style}
    >
      <button
        type="button"
        className={styles.increment}
        aria-label={`${piece.name}: ${doneCount} из ${piece.quantity}${isFull ? ', готово' : ''}`}
        onClick={() => onChangeCount(isFull ? 0 : doneCount + 1)}
      >
        <TypeInsulationIcon className={styles.icon} aria-hidden="true" />
        {body}
      </button>
      <div className={styles.stepperControls}>
        <span className={styles.progress}>
          {doneCount} / {piece.quantity}
        </span>
        <IconButton
          icon={MinusIcon}
          label="Убрать одну штуку"
          aria-disabled={doneCount === 0}
          onClick={() => onChangeCount(Math.max(0, doneCount - 1))}
        />
      </div>
      {isFull ? <CheckIcon className={styles.doneIcon} aria-hidden="true" /> : null}
    </article>
  )
}
