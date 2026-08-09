import { skipToken } from '@reduxjs/toolkit/query/react'
import { useGetFirstUserQuery } from '@/entities/user'
import { useInsulationSetFilter } from '@/features/insulation-set-filter'
import {
  useGetActiveCuttingSessionQuery,
  useCompleteCuttingSessionMutation,
} from '@/entities/cutting-session'
import type { GetActiveCuttingSessionArgs } from '@/entities/cutting-session'

export const useInsulationSaveSession = () => {
  const { unitId, selectedSetId, selectedUnitNo, selectUnitNo } = useInsulationSetFilter()
  const { data: user } = useGetFirstUserQuery()

  // Тот же запрос (тот же кеш), что уже держит активным useInsulationProgress
  // в InsulationPage — лишнего запроса нет, RTK Query дедуплицирует по
  // эндпоинту+аргументам.
  const sessionArgs: GetActiveCuttingSessionArgs | typeof skipToken =
    unitId && selectedSetId && selectedUnitNo !== null && user
      ? { unitId, setId: selectedSetId, unitNo: selectedUnitNo, userId: user.id }
      : skipToken
  const { data: session } = useGetActiveCuttingSessionQuery(sessionArgs)
  const [completeSession, { isLoading: isSaving, error }] = useCompleteCuttingSessionMutation()

  const save = async () => {
    if (!session || !unitId || !selectedSetId || selectedUnitNo === null) return
    if (!window.confirm(`Сохранить прогресс по установке №${selectedUnitNo} и закрыть сессию?`)) return
    try {
      await completeSession({
        sessionId: session.id,
        unitId,
        setId: selectedSetId,
        unitNo: selectedUnitNo,
      }).unwrap()
      // Готово к следующей установке — тот же принцип, что get-or-create в
      // getActiveCuttingSession подхватит для нового номера сам.
      selectUnitNo(selectedUnitNo + 1)
    } catch {
      // ошибка уже осела в error ниже — инлайн выводит её UI-компонент
    }
  }

  // error — PocketbaseQueryError | SerializedError | undefined (кастомный
  // baseQuery, не fetchBaseQuery, но тот же принцип сужения типа ошибки, что
  // в usage-with-typescript.mdx RTK Query): SerializedError не несёт status,
  // поэтому проверяем 'status' in error, прежде чем сравнивать его с 409.
  const errorMessage = error
    ? 'status' in error && error.status === 409
      ? error.message
      : 'Не удалось сохранить'
    : null

  return {
    isReady: Boolean(session),
    isSaving,
    unitNo: selectedUnitNo,
    errorMessage,
    save,
  }
}
