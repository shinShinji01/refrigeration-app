import { useState } from 'react'
import MarkAllIcon from '@/shared/assets/icons/mark-all.svg?react'
import CloseIcon from '@/shared/assets/icons/close.svg?react'
import { IconButton } from '@/shared/ui'
import type { InsulationGroupWithQuantity } from '@/entities/insulation-group'
import { ALL_GROUPS_SENTINEL } from '@/features/insulation-progress'
import { useInsulationGlobalActions } from '../model/useInsulationGlobalActions'
import styles from './InsulationGlobalActions.module.scss'

type PressedAction = 'markAll' | 'unmark' | null

interface InsulationGlobalActionsProps {
  groups: InsulationGroupWithQuantity[]
  isLoading: boolean
  isPieceDone: (groupPieceId: string) => boolean
  pendingGroupIds: ReadonlySet<string>
  onSetGroupDone: (groupId: string, groupPieceIds: string[], done: boolean) => void
}

export const InsulationGlobalActions = ({
  groups,
  isLoading,
  isPieceDone,
  pendingGroupIds,
  onSetGroupDone,
}: InsulationGlobalActionsProps) => {
  const { allPieceIds, allDone, hasAnyDone, isLoading: piecesLoading } = useInsulationGlobalActions(
    groups,
    isPieceDone,
  )
  const isPending = pendingGroupIds.has(ALL_GROUPS_SENTINEL)

  // Какая из двух кнопок нажата последней — тот же паттерн, что в
  // InsulationGroupItem: спиннер только на нажатой, вторая просто disabled.
  const [pressedAction, setPressedAction] = useState<PressedAction>(null)
  const [prevIsPending, setPrevIsPending] = useState(isPending)
  if (isPending !== prevIsPending) {
    setPrevIsPending(isPending)
    if (!isPending) setPressedAction(null)
  }

  if (isLoading || piecesLoading || allPieceIds.length === 0) {
    return null
  }

  const handleMarkAll = () => {
    if (allDone || isPending) return
    setPressedAction('markAll')
    onSetGroupDone(ALL_GROUPS_SENTINEL, allPieceIds, true)
  }

  const handleUnmark = () => {
    if (!hasAnyDone || isPending) return
    if (!window.confirm('Снять готовность со всех кусков набора?')) return
    setPressedAction('unmark')
    onSetGroupDone(ALL_GROUPS_SENTINEL, allPieceIds, false)
  }

  return (
    <div className={styles.root}>
      <span className={styles.label}>Весь набор изоляции</span>
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
    </div>
  )
}
