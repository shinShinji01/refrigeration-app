import { baseApi, pb } from '@/shared/api'
import type { UnitId, RefrigerationUnit } from '@/entities/refrigeration-unit'
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
      queryFn: async ({ unitId, setId, unitNo, userId }, queryApi, _extraOptions, baseQuery) => {
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

        // Дошли сюда только если исходной in_progress сессии не было (404) —
        // значит ниже мы либо создаём новую, либо находим её через
        // race-retry; в обоих случаях список чипов (LIST_-тег) устарел и его
        // нужно инвалидировать, иначе новая сессия не появится как чип, пока
        // не случится что-то ещё, что триггернёт рефетч.
        const invalidateList = () =>
          queryApi.dispatch(
            baseApi.util.invalidateTags([{ type: 'CuttingSession', id: `LIST_${unitId}_${setId}` }]),
          )

        const created = await baseQuery({
          collection: 'cutting_sessions',
          method: 'create',
          body: { unit: unitId, set: setId, unitNo, donePieces: {}, status: 'in_progress', user: userId },
        })
        if (created.data) {
          invalidateList()
          return { data: normalizeCuttingSession(created.data as CuttingSession) }
        }

        // Создание упало — вероятно, гонка: другое устройство успело создать
        // сессию на ту же тройку раньше (уникальный индекс в БД). Перечитываем:
        // нашли — гонка разрешена, не нашли — возвращаем исходную ошибку создания.
        const retry = await baseQuery({ collection: 'cutting_sessions', method: 'getFirstListItem', filter })
        if (retry.data) {
          invalidateList()
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

    // Финализация: status -> completed + units.lastCompletedUnitNoInsulation
    // подтягивается до max(текущее, unitNo). Блокируется, если по ЭТОЙ установке
    // (по всем версиям набора, не только текущей — счётчик общий для установки)
    // есть более ранний in_progress номер: нельзя завершить #48 раньше #47.
    completeCuttingSession: builder.mutation<
      { unit: RefrigerationUnit },
      { sessionId: CuttingSessionId; unitId: UnitId; setId: InsulationSetId; unitNo: number }
    >({
      queryFn: async ({ sessionId, unitId, unitNo }, _queryApi, _extraOptions, baseQuery) => {
        const blockingFilter = pb.filter('unit = {:unitId} && status = "in_progress" && unitNo < {:unitNo}', {
          unitId,
          unitNo,
        })
        const blocking = await baseQuery({
          collection: 'cutting_sessions',
          method: 'getFullList',
          params: { filter: blockingFilter, sort: 'unitNo' },
        })
        if (blocking.error) return { error: blocking.error }

        const earliest = (blocking.data as CuttingSession[])[0]
        if (earliest) {
          return {
            error: {
              status: 409,
              message: `Установка №${earliest.unitNo} ещё не завершена по изоляции. Сначала завершите её.`,
              data: { blockingUnitNo: earliest.unitNo },
            },
          }
        }

        const sessionUpdate = await baseQuery({
          collection: 'cutting_sessions',
          method: 'update',
          id: sessionId,
          body: { status: 'completed' },
        })
        if (sessionUpdate.error) return { error: sessionUpdate.error }

        // Ниже сессия уже помечена completed. Если что-то из шагов по unit
        // упадёт, откатываем статус сессии обратно в in_progress — иначе
        // get-or-create в getActiveCuttingSession не найдёт in_progress-запись
        // для этой же тройки (unit, set, unitNo) и молча создаст ВТОРУЮ,
        // пустую сессию-дубликат. Откат — best-effort: исходная ошибка (по
        // unit) всегда возвращается вызывающему, даже если сам откат не удался.
        const rollbackSession = async () => {
          await baseQuery({
            collection: 'cutting_sessions',
            method: 'update',
            id: sessionId,
            body: { status: 'in_progress' },
          })
        }

        const unitResult = await baseQuery({ collection: 'units', method: 'getOne', id: unitId })
        if (unitResult.error) {
          await rollbackSession()
          return { error: unitResult.error }
        }
        const current = (unitResult.data as RefrigerationUnit).lastCompletedUnitNoInsulation ?? 0

        const updatedUnit = await baseQuery({
          collection: 'units',
          method: 'update',
          id: unitId,
          body: { lastCompletedUnitNoInsulation: Math.max(current, unitNo) },
        })
        if (updatedUnit.error) {
          await rollbackSession()
          return { error: updatedUnit.error }
        }

        return { data: { unit: updatedUnit.data as RefrigerationUnit } }
      },
      // ВАЖНО: не инвалидируем { type: 'CuttingSession', id: sessionId } здесь.
      // getActiveCuttingSession для (unitId, setId, старый unitNo) — get-or-create
      // по status="in_progress"; если бы мы форсировали его рефетч тегом, он бы
      // не нашёл только что завершённую запись (status уже completed) и молча
      // СОЗДАЛ БЫ новую пустую сессию под тем же номером. Компоненты, ещё
      // подписанные на старый unitNo, узнают о завершении через уже работающую
      // realtime-подписку onCacheEntryAdded (патчит кеш напрямую, без рефетча
      // queryFn) — этого достаточно, а наш собственный save() сразу переключает
      // unitNo на N+1, так что старая подписка снимается почти сразу.
      invalidatesTags: (_result, _error, { unitId, setId }) => [
        { type: 'CuttingSession', id: `LIST_${unitId}_${setId}` },
        { type: 'Unit', id: unitId },
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
  useCompleteCuttingSessionMutation,
} = cuttingSessionApi
