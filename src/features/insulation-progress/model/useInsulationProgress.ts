import { useCallback, useEffect, useRef } from 'react'
import { skipToken } from '@reduxjs/toolkit/query/react'
import { useAppDispatch, useAppStore } from '@/app/store'
import { useGetFirstUserQuery } from '@/entities/user'
import { useGetUnitsQuery } from '@/entities/refrigeration-unit'
import type { UnitId } from '@/entities/refrigeration-unit'
import type { InsulationSetId } from '@/entities/insulation-set'
import {
  cuttingSessionApi,
  useGetActiveCuttingSessionQuery,
  useUpdateDonePiecesMutation,
} from '@/entities/cutting-session'
import type { GetActiveCuttingSessionArgs } from '@/entities/cutting-session'
import { applyToggle } from '../lib/applyToggle'

const FLUSH_DELAY_MS = 500

interface UseInsulationProgressArgs {
  unitId: UnitId | null
  setId: InsulationSetId | null
}

export const useInsulationProgress = ({ unitId, setId }: UseInsulationProgressArgs) => {
  const dispatch = useAppDispatch()
  const store = useAppStore()
  const { data: user } = useGetFirstUserQuery()
  // Тот же кеш, что уже прогрет InsulationFilterBar — лишнего запроса нет.
  const { data: units = [] } = useGetUnitsQuery({ includeArchived: false })

  const unit = units.find((candidate) => candidate.id === unitId) ?? null
  const unitNo = unit ? (unit.lastCompletedUnitNoInsulation ?? 0) + 1 : null

  const sessionArgs: GetActiveCuttingSessionArgs | typeof skipToken =
    unitId && setId && unitNo !== null && user ? { unitId, setId, unitNo, userId: user.id } : skipToken

  const { data: session, isLoading } = useGetActiveCuttingSessionQuery(sessionArgs)
  const [updateDonePieces] = useUpdateDonePiecesMutation()

  // "Последние известные" аргументы запроса — читаются в cleanup-эффекте ниже
  // и в flush(), где обычные замыкания на момент клика уже устарели бы при
  // смене установки/версии набора.
  const sessionArgsRef = useRef(sessionArgs)
  useEffect(() => {
    sessionArgsRef.current = sessionArgs
  })

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const args = sessionArgsRef.current
    if (args === skipToken) return
    const current = cuttingSessionApi.endpoints.getActiveCuttingSession.select(args)(store.getState()).data
    if (!current) return
    updateDonePieces({ sessionId: current.id, donePieces: current.donePieces })
  }, [store, updateDonePieces])

  // Досылаем недописанный прогресс при смене установки/версии набора и при
  // уходе со страницы — не ждём таймер.
  useEffect(() => {
    return () => flush()
  }, [unitId, setId, unitNo, user?.id, flush])

  const toggle = useCallback(
    (groupPieceId: string) => {
      const args = sessionArgsRef.current
      if (args === skipToken) return
      // Отметка "щёлкает" мгновенно — патчим кеш RTK Query, не дожидаясь сети.
      dispatch(
        cuttingSessionApi.util.updateQueryData('getActiveCuttingSession', args, (draft) => {
          draft.donePieces = applyToggle(draft.donePieces, groupPieceId)
        }),
      )
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(flush, FLUSH_DELAY_MS)
    },
    [dispatch, flush],
  )

  const isPieceDone = useCallback(
    (groupPieceId: string) => Boolean(session?.donePieces[groupPieceId]),
    [session],
  )

  return { isPieceDone, toggle, isLoading }
}
