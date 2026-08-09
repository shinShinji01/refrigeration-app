import { baseApi, pb } from '@/shared/api'
import type { UnitId } from '@/entities/refrigeration-unit'
import type { InsulationSetId } from '@/entities/insulation-set'
import type { UserId } from '@/entities/user'
import type { CuttingSession, CuttingSessionId } from '../model/types'

export interface GetActiveCuttingSessionArgs {
  unitId: UnitId
  setId: InsulationSetId
  unitNo: number
  userId: UserId
}

export interface CuttingSessionLookupArgs {
  unitId: UnitId
  setId: InsulationSetId
  unitNo: number
}

export interface CuttingSessionListArgs {
  unitId: UnitId
  setId: InsulationSetId
}

// PocketBase хранит незаполненный json как null, а не {} — приводим на
// границе, как unitApi приводит drawingNumbers к [].
const normalizeCuttingSession = (session: CuttingSession): CuttingSession => ({
  ...session,
  donePieces: session.donePieces ?? {},
})

export const cuttingSessionApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Get-or-create: одна незакрытая сессия на (unit, set, unitNo) —
    // docs/data-model.md. queryFn вместо декларативного query() — нужна
    // многошаговая логика с обработкой гонки создания между устройствами
    // (см. docs/superpowers/specs/2026-08-02-insulation-cutting-progress-design.md).
    getActiveCuttingSession: builder.query<CuttingSession, GetActiveCuttingSessionArgs>({
      queryFn: async ({ unitId, setId, unitNo, userId }, _queryApi, _extraOptions, baseQuery) => {
        const filter = pb.filter(
          'unit = {:unitId} && set = {:setId} && unitNo = {:unitNo} && status = "in_progress"',
          { unitId, setId, unitNo },
        )

        const found = await baseQuery({ collection: 'cutting_sessions', method: 'getFirstListItem', filter })
        if (found.data) {
          return { data: normalizeCuttingSession(found.data as CuttingSession) }
        }
        if (found.error && found.error.status !== 404) {
          return { error: found.error }
        }

        const created = await baseQuery({
          collection: 'cutting_sessions',
          method: 'create',
          body: { unit: unitId, set: setId, unitNo, donePieces: {}, status: 'in_progress', user: userId },
        })
        if (created.data) {
          return { data: normalizeCuttingSession(created.data as CuttingSession) }
        }

        // Создание упало — вероятно, гонка: другое устройство успело создать
        // сессию на ту же тройку раньше (уникальный индекс в БД). Перечитываем:
        // нашли — гонка разрешена, не нашли — возвращаем исходную ошибку создания.
        const retry = await baseQuery({ collection: 'cutting_sessions', method: 'getFirstListItem', filter })
        if (retry.data) {
          return { data: normalizeCuttingSession(retry.data as CuttingSession) }
        }
        return {
          error: created.error ?? retry.error ?? { status: 0, message: 'Не удалось получить сессию нарезки' },
        }
      },
      providesTags: (result) => (result ? [{ type: 'CuttingSession', id: result.id }] : []),
      // Первая realtime-подписка в проекте — паттерн для будущих сессий
      // (docs/decisions.md №1: realtime только на активную сессию, не на всё подряд).
      async onCacheEntryAdded(_arg, { updateCachedData, cacheDataLoaded, cacheEntryRemoved }) {
        let sessionId: CuttingSessionId
        try {
          const { data } = await cacheDataLoaded
          sessionId = data.id
        } catch {
          return
        }

        const unsubscribe = await pb.collection('cutting_sessions').subscribe(sessionId, (event) => {
          if (event.action === 'update') {
            updateCachedData(() => normalizeCuttingSession(event.record as unknown as CuttingSession))
          }
        })

        await cacheEntryRemoved
        unsubscribe()
      },
    }),

    // Чистая проверка существования (любой статус, включая completed) — в отличие
    // от getActiveCuttingSession, без побочного эффекта create-если-не-найдено.
    // Единственная точка, которой важен статус completed (детект "уже завершена"
    // при повторном ручном вводе номера — docs/superpowers/specs/2026-08-09-...).
    getCuttingSessionByUnitNo: builder.query<CuttingSession | null, CuttingSessionLookupArgs>({
      queryFn: async ({ unitId, setId, unitNo }, _queryApi, _extraOptions, baseQuery) => {
        const filter = pb.filter('unit = {:unitId} && set = {:setId} && unitNo = {:unitNo}', {
          unitId,
          setId,
          unitNo,
        })
        const found = await baseQuery({ collection: 'cutting_sessions', method: 'getFirstListItem', filter })
        if (found.data) return { data: normalizeCuttingSession(found.data as CuttingSession) }
        if (found.error && found.error.status !== 404) return { error: found.error }
        return { data: null }
      },
      providesTags: (result) => (result ? [{ type: 'CuttingSession', id: result.id }] : []),
    }),

    // Номера "в работе" для пары установка+версия — питает чипы рядом с инпутом
    // unitNo (InsulationFilterBar).
    getInProgressCuttingSessions: builder.query<CuttingSession[], CuttingSessionListArgs>({
      query: ({ unitId, setId }) => ({
        collection: 'cutting_sessions',
        method: 'getFullList',
        params: {
          filter: pb.filter('unit = {:unitId} && set = {:setId} && status = "in_progress"', { unitId, setId }),
          sort: 'unitNo',
        },
      }),
      transformResponse: (sessions: CuttingSession[]): CuttingSession[] => sessions.map(normalizeCuttingSession),
      providesTags: (result, _error, { unitId, setId }) => [
        ...(result?.map(({ id }) => ({ type: 'CuttingSession' as const, id })) ?? []),
        { type: 'CuttingSession' as const, id: `LIST_${unitId}_${setId}` },
      ],
    }),

    // Реоткрытие уже завершённой сессии — та же запись, новая не создаётся.
    // resetDonePieces=true — «начать заново» (чистый лист), false — «редактировать»
    // (прогресс остаётся как был на момент завершения).
    reopenCuttingSession: builder.mutation<
      CuttingSession,
      { sessionId: CuttingSessionId; unitId: UnitId; setId: InsulationSetId; resetDonePieces: boolean }
    >({
      query: ({ sessionId, resetDonePieces }) => ({
        collection: 'cutting_sessions',
        method: 'update',
        id: sessionId,
        body: { status: 'in_progress', ...(resetDonePieces ? { donePieces: {} } : {}) },
      }),
      transformResponse: normalizeCuttingSession,
      invalidatesTags: (_result, _error, { sessionId, unitId, setId }) => [
        { type: 'CuttingSession', id: sessionId },
        { type: 'CuttingSession', id: `LIST_${unitId}_${setId}` },
      ],
    }),

    updateDonePieces: builder.mutation<
      CuttingSession,
      { sessionId: CuttingSessionId; donePieces: Record<string, true> }
    >({
      query: ({ sessionId, donePieces }) => ({
        collection: 'cutting_sessions',
        method: 'update',
        id: sessionId,
        body: { donePieces },
      }),
      async onQueryStarted({ sessionId }, { queryFulfilled, dispatch }) {
        try {
          await queryFulfilled
        } catch {
          // Запись не прошла — сбрасываем тег, чтобы перечитать актуальное
          // состояние с сервера, а не оставаться на разъехавшемся
          // оптимистичном кеше (docs/superpowers/specs/... → "Обработка ошибок").
          dispatch(baseApi.util.invalidateTags([{ type: 'CuttingSession', id: sessionId }]))
        }
      },
    }),
  }),
})

export const {
  useGetActiveCuttingSessionQuery,
  useUpdateDonePiecesMutation,
  useGetCuttingSessionByUnitNoQuery,
  useLazyGetCuttingSessionByUnitNoQuery,
  useGetInProgressCuttingSessionsQuery,
  useReopenCuttingSessionMutation,
} = cuttingSessionApi
