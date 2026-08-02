import type { CSSProperties } from 'react'
import clsx from 'clsx'
import TypeInsulationIcon from '@/shared/assets/icons/type-insulation.svg?react'
import { formatArea } from '@/shared/lib/utils'
import type { InsulationPieceWithQuantity } from '../model/types'
import styles from './InsulationPieceCard.module.scss'

interface InsulationPieceCardProps {
  piece: InsulationPieceWithQuantity
}

// Пока не цвет ComponentCard-типов (docs/CLAUDE.md → cyan/янтарный/красный —
// зарезервированы под состояния) — кусок изоляции не относится к трём типам
// установка/узел/деталь, поэтому свой акцент.
const ACCENT = '#4a7a96'

const formatDimensions = (piece: InsulationPieceWithQuantity): string =>
  piece.geometry.kind === 'rect' ? `${piece.geometry.width} × ${piece.geometry.height} мм` : 'Многоугольник'

// Только отображение в фазе 1 — без отметки готовности (это фаза 2,
// docs/spec.md → "Список изоляции и отслеживание прогресса нарезания").
export const InsulationPieceCard = ({ piece }: InsulationPieceCardProps) => {
  const style = { '--accent': ACCENT } satisfies CSSProperties
  // Если чертёж не заполнен — показываем id (docs/spec.md → "Общие моменты").
  const subtitle = piece.drawingNumbers.length > 0 ? piece.drawingNumbers.join(', ') : piece.id
  const title = piece.quantity > 1 ? `${piece.name} × ${piece.quantity}` : piece.name

  return (
    <article className={clsx(styles.root, piece.isArchived && styles.archived)} style={style}>
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
    </article>
  )
}
