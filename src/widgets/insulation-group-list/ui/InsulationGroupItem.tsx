import { useState } from 'react'
import * as Accordion from '@radix-ui/react-accordion'
import ChevronIcon from '@/shared/assets/icons/chevron.svg?react'
import CheckIcon from '@/shared/assets/icons/check.svg?react'
import CloseIcon from '@/shared/assets/icons/close.svg?react'
import MarkAllIcon from '@/shared/assets/icons/mark-all.svg?react'
import { IconButton } from '@/shared/ui'
import { useGetPiecesForGroupQuery } from '@/entities/insulation-piece'
import { InsulationPieceCard, summarizeByThickness } from '@/entities/insulation-piece'
import type { InsulationGroupWithQuantity } from '@/entities/insulation-group'
import { isGroupDone } from '@/features/insulation-progress'
import styles from './InsulationGroupItem.module.scss'

type PressedAction = 'markAll' | 'unmark' | null

interface InsulationGroupItemProps {
  group: InsulationGroupWithQuantity
  isPieceDone: (groupPieceId: string) => boolean
  onTogglePiece: (groupPieceId: string) => void
  pendingGroupIds: ReadonlySet<string>
  onSetGroupDone: (groupId: string, groupPieceIds: string[], done: boolean) => void
}

export const InsulationGroupItem = ({
  group,
  isPieceDone,
  onTogglePiece,
  pendingGroupIds,
  onSetGroupDone,
}: InsulationGroupItemProps) => {
  const { data: pieces = [], isLoading } = useGetPiecesForGroupQuery(group.id)
  const thicknessSummary = summarizeByThickness(pieces)
  // Чистое производное от индивидуальных отметок — отдельной логики "готова
  // ли группа" на сервере нет (docs/spec.md).
  const allDone = isGroupDone(
    pieces.map((piece) => piece.linkId),
    isPieceDone,
  )
  const hasAnyDone = pieces.some((piece) => isPieceDone(piece.linkId))
  const isPending = pendingGroupIds.has(group.linkId)

  // Какая из двух кнопок нажата последней — чтобы спиннер показывался
  // только на ней, а не на обеих сразу, пока обе disabled.
  const [pressedAction, setPressedAction] = useState<PressedAction>(null)
  // Сброс при переходе isPending → false — во время рендера (а не в
  // эффекте), по паттерну "adjusting state when a prop changes" из
  // документации React: не даёт лишнего каскадного рендера.
  const [prevIsPending, setPrevIsPending] = useState(isPending)
  if (isPending !== prevIsPending) {
    setPrevIsPending(isPending)
    if (!isPending) setPressedAction(null)
  }

  const handleMarkAll = () => {
    if (allDone || isPending) return
    setPressedAction('markAll')
    onSetGroupDone(
      group.linkId,
      pieces.map((piece) => piece.linkId),
      true,
    )
  }

  const handleUnmark = () => {
    if (!hasAnyDone || isPending) return
    setPressedAction('unmark')
    onSetGroupDone(
      group.linkId,
      pieces.map((piece) => piece.linkId),
      false,
    )
  }

  return (
    <Accordion.Item value={group.linkId} className={styles.item}>
      <Accordion.Header className={styles.header}>
        <Accordion.Trigger className={styles.trigger}>
          <ChevronIcon className={styles.chevron} aria-hidden="true" />
          <span className={styles.name} title={group.name}>
            {group.name}
          </span>
          {allDone ? (
            <span className={styles.doneBadge}>
              <CheckIcon aria-hidden="true" />
              <span className={styles.visuallyHidden}>Группа готова</span>
            </span>
          ) : null}
          <span className={styles.count}>{pieces.length}</span>
        </Accordion.Trigger>
        {pieces.length === 0 || isLoading ? null : (
          <span className={styles.actions}>
            <IconButton
              icon={MarkAllIcon}
              label="Отметить всё готовым"
              loading={isPending && pressedAction === 'markAll'}
              aria-disabled={allDone || isPending}
              onClick={handleMarkAll}
            />
            <IconButton
              icon={CloseIcon}
              label="Снять готовность"
              loading={isPending && pressedAction === 'unmark'}
              aria-disabled={!hasAnyDone || isPending}
              onClick={handleUnmark}
            />
          </span>
        )}
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
