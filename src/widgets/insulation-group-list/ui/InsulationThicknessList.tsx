import { skipToken } from '@reduxjs/toolkit/query/react'
import { EmptyState } from '@/shared/ui'
import type { InsulationGroupWithQuantity, InsulationGroupId } from '@/entities/insulation-group'
import { useGetPiecesForGroupsQuery, groupByThickness, InsulationPieceCard } from '@/entities/insulation-piece'
import styles from './InsulationThicknessList.module.scss'

interface InsulationThicknessListProps {
  groups: InsulationGroupWithQuantity[]
  detailed: boolean
  getPieceDoneCount: (groupPieceId: string, quantity: number) => number
  onSetPieceCount: (groupPieceId: string, count: number) => void
}

// Сквозной (вне групп) вид кусков изоляции набора, сгруппированных по
// толщине — для удобства физической нарезки одной пачкой
// (docs/superpowers/specs/2026-08-10-insulation-view-controls-design.md).
// Плоский список без сворачивания и без кнопок массовой отметки — это
// осталось только у групп (InsulationGroupItem).
export const InsulationThicknessList = ({
  groups,
  detailed,
  getPieceDoneCount,
  onSetPieceCount,
}: InsulationThicknessListProps) => {
  const groupIds = groups.map((group) => group.id)
  // currentData/isFetching — тот же паттерн защиты от гонки версий набора,
  // что в useInsulationGlobalActions/useInsulationStats: иначе на смене
  // версии currentData какое-то время отдаёт куски СТАРОЙ версии, пока
  // грузится новая (RTK Query отдаёт data от предыдущего arg).
  const { currentData: pieces = [], isFetching } = useGetPiecesForGroupsQuery(
    groupIds.length === 0 ? skipToken : groupIds,
  )
  const groupNameById = new Map<InsulationGroupId, string>(groups.map((group) => [group.id, group.name]))
  const sections = groupByThickness(pieces)

  if (isFetching) {
    return null
  }

  if (sections.length === 0) {
    return <EmptyState message="В наборе нет кусков" />
  }

  return (
    <div className={styles.root}>
      {sections.map((section) => (
        <section key={section.thicknessMm} className={styles.section}>
          <h3 className={styles.heading}>{section.thicknessMm} мм</h3>
          <div className={styles.grid}>
            {section.pieces.map((piece) => (
              <InsulationPieceCard
                key={piece.linkId}
                piece={piece}
                doneCount={getPieceDoneCount(piece.linkId, piece.quantity)}
                onChangeCount={(next) => onSetPieceCount(piece.linkId, next)}
                detailed={detailed}
                groupLabel={groupNameById.get(piece.groupId)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
