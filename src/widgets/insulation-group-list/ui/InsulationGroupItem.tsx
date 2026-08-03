import * as Accordion from '@radix-ui/react-accordion'
import ChevronIcon from '@/shared/assets/icons/chevron.svg?react'
import CheckIcon from '@/shared/assets/icons/check.svg?react'
import { useGetPiecesForGroupQuery } from '@/entities/insulation-piece'
import { InsulationPieceCard, summarizeByThickness } from '@/entities/insulation-piece'
import type { InsulationGroupWithQuantity } from '@/entities/insulation-group'
import { isGroupDone } from '@/features/insulation-progress'
import styles from './InsulationGroupItem.module.scss'

interface InsulationGroupItemProps {
  group: InsulationGroupWithQuantity
  isPieceDone: (groupPieceId: string) => boolean
  onTogglePiece: (groupPieceId: string) => void
}

export const InsulationGroupItem = ({ group, isPieceDone, onTogglePiece }: InsulationGroupItemProps) => {
  const { data: pieces = [], isLoading } = useGetPiecesForGroupQuery(group.id)
  const thicknessSummary = summarizeByThickness(pieces)
  // Чистое производное от индивидуальных отметок — отдельной логики "готова
  // ли группа" на сервере нет (docs/spec.md).
  const allDone = isGroupDone(
    pieces.map((piece) => piece.linkId),
    isPieceDone,
  )

  return (
    <Accordion.Item value={group.linkId} className={styles.item}>
      <Accordion.Header>
        <Accordion.Trigger className={styles.trigger}>
          <ChevronIcon className={styles.chevron} aria-hidden="true" />
          <span className={styles.name}>{group.name}</span>
          {allDone ? (
            <span className={styles.doneBadge}>
              <CheckIcon aria-hidden="true" />
              <span className={styles.visuallyHidden}>Группа готова</span>
            </span>
          ) : null}
          <span className={styles.count}>{pieces.length}</span>
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className={styles.content}>
        {isLoading ? null : pieces.length === 0 ? (
          <p className={styles.empty}>В группе нет кусков</p>
        ) : (
          <div className={styles.grid}>
            {pieces.map((piece) => (
              <InsulationPieceCard
                key={piece.linkId}
                piece={piece}
                isDone={isPieceDone(piece.linkId)}
                onToggle={() => onTogglePiece(piece.linkId)}
              />
            ))}
          </div>
        )}
        {thicknessSummary.length > 0 ? (
          <ul className={styles.summary}>
            {thicknessSummary.map((entry) => (
              <li key={entry.thicknessMm} className={styles.summaryItem}>
                {entry.thicknessMm} мм — {entry.areaM2.toFixed(3)} м²
              </li>
            ))}
          </ul>
        ) : null}
      </Accordion.Content>
    </Accordion.Item>
  )
}
