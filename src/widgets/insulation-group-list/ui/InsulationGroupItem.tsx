import * as Accordion from '@radix-ui/react-accordion'
import ChevronIcon from '@/shared/assets/icons/chevron.svg?react'
import { useGetPiecesForGroupQuery } from '@/entities/insulation-piece'
import { InsulationPieceCard, summarizeByThickness } from '@/entities/insulation-piece'
import type { InsulationGroupWithQuantity } from '@/entities/insulation-group'
import styles from './InsulationGroupItem.module.scss'

interface InsulationGroupItemProps {
  group: InsulationGroupWithQuantity
}

export const InsulationGroupItem = ({ group }: InsulationGroupItemProps) => {
  const { data: pieces = [], isLoading } = useGetPiecesForGroupQuery(group.id)
  const thicknessSummary = summarizeByThickness(pieces)

  return (
    <Accordion.Item value={group.linkId} className={styles.item}>
      <Accordion.Header>
        <Accordion.Trigger className={styles.trigger}>
          <ChevronIcon className={styles.chevron} aria-hidden="true" />
          <span className={styles.name}>{group.name}</span>
          <span className={styles.count}>{pieces.length}</span>
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className={styles.content}>
        {isLoading ? null : pieces.length === 0 ? (
          <p className={styles.empty}>В группе нет кусков</p>
        ) : (
          <div className={styles.grid}>
            {pieces.map((piece) => (
              <InsulationPieceCard key={piece.linkId} piece={piece} />
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
