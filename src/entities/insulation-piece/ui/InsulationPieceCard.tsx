import type { CSSProperties, KeyboardEvent } from 'react'
import clsx from 'clsx'
import TypeInsulationIcon from '@/shared/assets/icons/type-insulation.svg?react'
import CheckIcon from '@/shared/assets/icons/check.svg?react'
import { formatArea } from '@/shared/lib/utils'
import type { InsulationPieceWithQuantity } from '../model/types'
import styles from './InsulationPieceCard.module.scss'

interface InsulationPieceCardProps {
  piece: InsulationPieceWithQuantity
  isDone: boolean
  onToggle: () => void
}

// Пока не цвет ComponentCard-типов (docs/CLAUDE.md → cyan/янтарный/красный —
// зарезервированы под состояния) — кусок изоляции не относится к трём типам
// установка/узел/деталь, поэтому свой акцент. Готовность (isDone) всё равно
// использует общий cyan-акцент состояния, перекрывая --accent.
const ACCENT = '#4a7a96'

const formatDimensions = (piece: InsulationPieceWithQuantity): string =>
  piece.geometry.kind === 'rect' ? `${piece.geometry.width} × ${piece.geometry.height} мм` : 'Многоугольник'

export const InsulationPieceCard = ({ piece, isDone, onToggle }: InsulationPieceCardProps) => {
  const style: CSSProperties & { '--accent': string } = { '--accent': ACCENT }
  const subtitle = piece.drawingNumbers.length > 0 ? piece.drawingNumbers.join(', ') : piece.id
  const title = piece.quantity > 1 ? `${piece.name} × ${piece.quantity}` : piece.name

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onToggle()
    }
  }

  return (
    <article
      className={clsx(styles.root, piece.isArchived && styles.archived, isDone && styles.done)}
      style={style}
      role="button"
      tabIndex={0}
      aria-pressed={isDone}
      aria-label={`${title}${isDone ? ', готово' : ', отметить готовым'}`}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
    >
      <TypeInsulationIcon className={styles.icon} aria-hidden="true" />
      <div className={styles.body}>
        <h4 className={styles.title}>{title}</h4>
        <p className={styles.subtitle}>{subtitle}</p>
        <dl className={styles.stats}>
          <div className={styles.stat}>
            <dt>Размер</dt>
            <dd>{formatDimensions(piece)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Толщина</dt>
            <dd>{piece.thicknessMm} мм</dd>
          </div>
          <div className={styles.stat}>
            <dt>Площадь</dt>
            <dd>{formatArea(piece.areaMm2)}</dd>
          </div>
        </dl>
        {piece.hasAdhesive ? <span className={styles.adhesive}>Клеевой слой</span> : null}
      </div>
      {isDone ? <CheckIcon className={styles.doneIcon} aria-hidden="true" /> : null}
    </article>
  )
}
