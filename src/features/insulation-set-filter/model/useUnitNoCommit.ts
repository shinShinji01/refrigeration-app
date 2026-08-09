import { useState } from 'react'
import { useModal } from '@/app/providers'
import type { UnitId } from '@/entities/refrigeration-unit'
import type { InsulationSetId } from '@/entities/insulation-set'
import { useLazyGetCuttingSessionByUnitNoQuery } from '@/entities/cutting-session'
import { useInsulationSetFilter } from './useInsulationSetFilter'
import { REOPEN_CUTTING_SESSION_MODAL } from '@/features/cutting-session-reopen'

interface UseUnitNoCommitArgs {
  unitId: UnitId | null
  setId: InsulationSetId | null
}

// Коммит вручную введённого/выбранного из чипов unitNo (по Enter/blur/клику —
// не на каждый символ). Если под этот номер уже есть ЗАВЕРШЁННАЯ сессия,
// unitNo в сторе не меняется до тех пор, пока пользователь не разрешит это
// через ReopenSessionDialog.
export const useUnitNoCommit = ({ unitId, setId }: UseUnitNoCommitArgs) => {
  const { open } = useModal()
  const { selectUnitNo } = useInsulationSetFilter()
  const [fetchSession] = useLazyGetCuttingSessionByUnitNoQuery()
  const [commitError, setCommitError] = useState<string | null>(null)

  const commit = async (unitNo: number): Promise<'committed' | 'dialogOpened' | 'skipped'> => {
    if (!unitId || !setId || !Number.isInteger(unitNo) || unitNo < 1) return 'skipped'
    try {
      setCommitError(null)
      const session = await fetchSession({ unitId, setId, unitNo }).unwrap()
      if (!session || session.status === 'in_progress') {
        selectUnitNo(unitNo)
        return 'committed'
      }
      open(REOPEN_CUTTING_SESSION_MODAL, { session, onReopened: selectUnitNo })
      return 'dialogOpened'
    } catch {
      setCommitError('Не удалось найти сессию. Попробуйте ещё раз.')
      return 'skipped'
    }
  }

  return { commit, commitError }
}
