# Insulation unitNo tracking + session save — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add manual `unitNo` (physical unit instance number) input with a "in-progress numbers" picker to the insulation cutting page, handle re-entering an already-completed number via a reopen dialog, and add the "Сохранить" button that finalizes a cutting session and advances `units.lastCompletedUnitNoInsulation`.

**Architecture:** Extends the existing `entities/cutting-session` API (4 new endpoints, no schema changes), the existing `insulationFilterSlice` (one new field), a new `features/cutting-session-reopen` modal feature (registered via the existing `MODAL_REGISTRY` pattern), and a new `widgets/insulation-save-session` widget. No changes to the already-working `getActiveCuttingSession`/`updateDonePieces` piece-toggling flow.

**Tech Stack:** React 19 + TypeScript strict, Redux Toolkit + RTK Query over a custom PocketBase `queryFn`/`baseQuery`, SASS modules, Vitest.

## Global Constraints

- Full spec: `docs/superpowers/specs/2026-08-09-insulation-unitno-tracking-design.md` — read it before starting, this plan implements it task-by-task.
- No PocketBase schema/migration changes — `cutting_sessions` and `units` already have every field needed.
- No new npm dependencies.
- Commit messages in English, imperative mood (overrides `CLAUDE.md`'s "Russian commit messages" — see project convention).
- Work happens on branch `feature/insulation-unitno-tracking`, created from `master` before Task 1 if it doesn't already exist.
- Run `pnpm check` (typecheck + lint + test) at the end of every task — the repo must stay green after each one, not just at the end of the plan.
- No `any` — unknown types get narrowed. Id types stay branded (`UnitId`, `InsulationSetId`, `CuttingSessionId`).
- Only pure/reducer logic gets automated tests (matches existing project convention — there is no RTL/MSW test infrastructure yet). UI is verified manually via `pnpm dev`.

---

### Task 1: `entities/cutting-session` — existence check + in-progress list

**Files:**
- Modify: `src/entities/cutting-session/api/cuttingSessionApi.ts`
- Modify: `src/entities/cutting-session/index.ts`

**Interfaces:**
- Produces: `CuttingSessionLookupArgs { unitId: UnitId; setId: InsulationSetId; unitNo: number }`, `CuttingSessionListArgs { unitId: UnitId; setId: InsulationSetId }`, `useGetCuttingSessionByUnitNoQuery`, `useLazyGetCuttingSessionByUnitNoQuery` (query returns `CuttingSession | null`), `useGetInProgressCuttingSessionsQuery` (returns `CuttingSession[]`, sorted by `unitNo` ascending).

- [ ] **Step 1: Add `getCuttingSessionByUnitNo` and `getInProgressCuttingSessions` to `cuttingSessionApi.ts`**

Open `src/entities/cutting-session/api/cuttingSessionApi.ts`. Add this new exported interface right after `GetActiveCuttingSessionArgs`:

```ts
export interface CuttingSessionLookupArgs {
  unitId: UnitId
  setId: InsulationSetId
  unitNo: number
}

export interface CuttingSessionListArgs {
  unitId: UnitId
  setId: InsulationSetId
}
```

Inside `cuttingSessionApi.injectEndpoints({ endpoints: (builder) => ({ ... }) })`, add two new endpoints (after `getActiveCuttingSession`, before `updateDonePieces`):

```ts
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
```

At the bottom of the file, add the two new hooks to the existing export line:

```ts
export const {
  useGetActiveCuttingSessionQuery,
  useUpdateDonePiecesMutation,
  useGetCuttingSessionByUnitNoQuery,
  useLazyGetCuttingSessionByUnitNoQuery,
  useGetInProgressCuttingSessionsQuery,
} = cuttingSessionApi
```

- [ ] **Step 2: Re-export from `entities/cutting-session/index.ts`**

```ts
export type { CuttingSessionId, CuttingSession, CuttingSessionStatus } from './model/types'
export {
  cuttingSessionApi,
  useGetActiveCuttingSessionQuery,
  useUpdateDonePiecesMutation,
  useGetCuttingSessionByUnitNoQuery,
  useLazyGetCuttingSessionByUnitNoQuery,
  useGetInProgressCuttingSessionsQuery,
} from './api/cuttingSessionApi'
export type { GetActiveCuttingSessionArgs, CuttingSessionLookupArgs, CuttingSessionListArgs } from './api/cuttingSessionApi'
```

- [ ] **Step 3: Verify**

Run: `pnpm check`
Expected: PASS (nothing consumes the new endpoints yet — this only needs to compile and lint clean).

- [ ] **Step 4: Commit**

```bash
git add src/entities/cutting-session
git commit -m "Add getCuttingSessionByUnitNo and getInProgressCuttingSessions endpoints"
```

---

### Task 2: `entities/cutting-session` — `reopenCuttingSession` mutation

**Files:**
- Modify: `src/entities/cutting-session/api/cuttingSessionApi.ts`
- Modify: `src/entities/cutting-session/index.ts`

**Interfaces:**
- Consumes: nothing new from Task 1.
- Produces: `useReopenCuttingSessionMutation()` — args `{ sessionId: CuttingSessionId; unitId: UnitId; setId: InsulationSetId; resetDonePieces: boolean }`, returns `CuttingSession`.

- [ ] **Step 1: Add the mutation**

Add after `getInProgressCuttingSessions` (still inside `endpoints: (builder) => ({ ... })`):

```ts
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
```

Add `useReopenCuttingSessionMutation` to the export block at the bottom of the file.

- [ ] **Step 2: Re-export from `entities/cutting-session/index.ts`**

Add `useReopenCuttingSessionMutation` to the existing named export list.

- [ ] **Step 3: Verify**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/entities/cutting-session
git commit -m "Add reopenCuttingSession mutation"
```

---

### Task 3: `entities/cutting-session` — `completeCuttingSession` mutation

**Files:**
- Modify: `src/entities/cutting-session/api/cuttingSessionApi.ts`
- Modify: `src/entities/cutting-session/index.ts`

**Interfaces:**
- Consumes: `RefrigerationUnit` type from `@/entities/refrigeration-unit` (same-layer import via public `index.ts`, already an established pattern in this file for `UnitId`).
- Produces: `useCompleteCuttingSessionMutation()` — args `{ sessionId: CuttingSessionId; unitId: UnitId; setId: InsulationSetId; unitNo: number }`, returns `{ unit: RefrigerationUnit }`. On failure with an earlier unpaid in-progress `unitNo` for the same unit, the error has `status: 409` and a ready-to-display Russian `message`.

- [ ] **Step 1: Add the `RefrigerationUnit` import**

At the top of `cuttingSessionApi.ts`, extend the existing import:

```ts
import type { UnitId, RefrigerationUnit } from '@/entities/refrigeration-unit'
```

- [ ] **Step 2: Add the mutation**

Add after `reopenCuttingSession`:

```ts
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

    const unitResult = await baseQuery({ collection: 'units', method: 'getOne', id: unitId })
    if (unitResult.error) return { error: unitResult.error }
    const current = (unitResult.data as RefrigerationUnit).lastCompletedUnitNoInsulation ?? 0

    const updatedUnit = await baseQuery({
      collection: 'units',
      method: 'update',
      id: unitId,
      body: { lastCompletedUnitNoInsulation: Math.max(current, unitNo) },
    })
    if (updatedUnit.error) return { error: updatedUnit.error }

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
```

Add `useCompleteCuttingSessionMutation` to the export block at the bottom of the file.

- [ ] **Step 3: Re-export from `entities/cutting-session/index.ts`**

Add `useCompleteCuttingSessionMutation` to the named export list.

- [ ] **Step 4: Verify**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/entities/cutting-session
git commit -m "Add completeCuttingSession mutation with same-unit ordering guard"
```

---

### Task 4: `insulationFilterSlice` — `unitNo` field

**Files:**
- Modify: `src/features/insulation-set-filter/model/insulationFilterSlice.ts`
- Modify: `src/features/insulation-set-filter/model/insulationFilterSlice.test.ts`

**Interfaces:**
- Produces: `InsulationFilterState.unitNo: number | null`, action `unitNoSelected(number | null)`.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `src/features/insulation-set-filter/model/insulationFilterSlice.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  insulationFilterReducer,
  unitSelected,
  setSelected,
  unitNoSelected,
  type InsulationFilterState,
} from './insulationFilterSlice'
import type { UnitId } from '@/entities/refrigeration-unit'
import type { InsulationSetId } from '@/entities/insulation-set'

const UNIT_A = 'unit-a' as UnitId
const UNIT_B = 'unit-b' as UnitId
const SET_A = 'set-a' as InsulationSetId

const filledState: InsulationFilterState = {
  unitId: UNIT_A,
  setId: SET_A,
  unitNo: 47,
}

describe('insulationFilterSlice', () => {
  it('смена установки сбрасывает явный выбор версии и unitNo', () => {
    const state = insulationFilterReducer(filledState, unitSelected(UNIT_B))
    expect(state).toEqual({ unitId: UNIT_B, setId: null, unitNo: null })
  })

  it('выбор версии не трогает установку и unitNo', () => {
    const state = insulationFilterReducer(filledState, setSelected(null))
    expect(state).toEqual({ unitId: UNIT_A, setId: null, unitNo: 47 })
  })

  it('unitNoSelected выставляет номер, не трогая установку и версию', () => {
    const state = insulationFilterReducer(filledState, unitNoSelected(48))
    expect(state).toEqual({ unitId: UNIT_A, setId: SET_A, unitNo: 48 })
  })

  it('unitNoSelected(null) сбрасывает явный выбор номера', () => {
    const state = insulationFilterReducer(filledState, unitNoSelected(null))
    expect(state).toEqual({ unitId: UNIT_A, setId: SET_A, unitNo: null })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test insulationFilterSlice -- --run`
Expected: FAIL — `unitNoSelected` is not exported, `unitNo` missing from state shape.

- [ ] **Step 3: Implement**

Replace the full contents of `src/features/insulation-set-filter/model/insulationFilterSlice.ts`:

```ts
import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { UnitId } from '@/entities/refrigeration-unit'
import type { InsulationSetId } from '@/entities/insulation-set'

export interface InsulationFilterState {
  unitId: UnitId | null
  // null — версия не выбрана явно, действует авто-выбор самой актуальной
  // (pickCurrentSet). Не то же самое, что "нет наборов вообще".
  setId: InsulationSetId | null
  // null — номер не выбран явно, действует автовычисление
  // (lastCompletedUnitNoInsulation + 1) в useInsulationSetFilter.
  unitNo: number | null
}

const initialState: InsulationFilterState = {
  unitId: null,
  setId: null,
  unitNo: null,
}

// Смена установки сбрасывает явный выбор версии — снова действует авто-выбор
// самой актуальной для новой установки (docs/spec.md → "По-умолчанию при
// выборе установки ставится самая актуальная") — и явный выбор unitNo, т.к.
// это про физический экземпляр КОНКРЕТНОЙ установки, не переносится на другую.
const insulationFilterSlice = createSlice({
  name: 'insulationFilter',
  initialState,
  reducers: {
    unitSelected: (state, action: PayloadAction<UnitId | null>) => {
      state.unitId = action.payload
      state.setId = null
      state.unitNo = null
    },
    setSelected: (state, action: PayloadAction<InsulationSetId | null>) => {
      state.setId = action.payload
    },
    // Смена версии набора НЕ сбрасывает unitNo — версия и физический номер
    // независимы (тот же принцип, что "состав установки и набор изоляции
    // независимы", docs/data-model.md).
    unitNoSelected: (state, action: PayloadAction<number | null>) => {
      state.unitNo = action.payload
    },
  },
})

export const { unitSelected, setSelected, unitNoSelected } = insulationFilterSlice.actions
export const insulationFilterReducer = insulationFilterSlice.reducer
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test insulationFilterSlice -- --run`
Expected: PASS (4 tests).

- [ ] **Step 5: Verify full check**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/insulation-set-filter/model/insulationFilterSlice.ts src/features/insulation-set-filter/model/insulationFilterSlice.test.ts
git commit -m "Add unitNo field to insulationFilterSlice"
```

---

### Task 5: `useInsulationSetFilter` — `selectedUnitNo` / `selectUnitNo`

**Files:**
- Modify: `src/features/insulation-set-filter/model/useInsulationSetFilter.ts`

**Interfaces:**
- Consumes: `insulationFilterSlice`'s `unitNo` state + `unitNoSelected` action (Task 4), `useGetUnitsQuery` from `@/entities/refrigeration-unit`.
- Produces: hook return gains `selectedUnitNo: number | null` and `selectUnitNo: (n: number | null) => void`.

- [ ] **Step 1: Implement**

Replace the full contents of `src/features/insulation-set-filter/model/useInsulationSetFilter.ts`:

```ts
import { skipToken } from '@reduxjs/toolkit/query/react'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { useGetUnitsQuery } from '@/entities/refrigeration-unit'
import type { UnitId } from '@/entities/refrigeration-unit'
import { useGetInsulationSetsForUnitQuery, pickCurrentSet } from '@/entities/insulation-set'
import type { InsulationSet, InsulationSetId } from '@/entities/insulation-set'
import { unitSelected, setSelected, unitNoSelected } from './insulationFilterSlice'

// selectedSetId/selectedUnitNo — явный выбор пользователя или, пока его нет,
// авто-выбор (самая актуальная версия / lastCompletedUnitNoInsulation + 1).
// Оборачивать в effect не нужно: это просто производные значения.
export const useInsulationSetFilter = () => {
  const dispatch = useAppDispatch()
  const { unitId, setId, unitNo } = useAppSelector((state) => state.insulationFilter)

  // Тот же кеш, что уже прогрет InsulationFilterBar (дропдаун установки) —
  // лишнего запроса нет, RTK Query дедуплицирует по эндпоинту+аргументам.
  const { data: units = [] } = useGetUnitsQuery({ includeArchived: false })
  const unit = units.find((candidate) => candidate.id === unitId) ?? null

  const { data: sets = [], isLoading } = useGetInsulationSetsForUnitQuery(unitId ?? skipToken)
  const currentSet = pickCurrentSet(sets)
  const selectedSetId = setId ?? currentSet?.id ?? null
  const selectedSet: InsulationSet | null = sets.find((set) => set.id === selectedSetId) ?? null

  const defaultUnitNo = unit ? (unit.lastCompletedUnitNoInsulation ?? 0) + 1 : null
  const selectedUnitNo = unitNo ?? defaultUnitNo

  return {
    unitId,
    selectUnit: (id: UnitId | null) => dispatch(unitSelected(id)),
    sets,
    selectedSet,
    selectedSetId,
    selectSet: (id: InsulationSetId | null) => dispatch(setSelected(id)),
    selectedUnitNo,
    selectUnitNo: (n: number | null) => dispatch(unitNoSelected(n)),
    isLoading,
  }
}
```

- [ ] **Step 2: Verify**

Run: `pnpm check`
Expected: PASS (no consumers use the new fields yet — `InsulationPage.tsx` still destructures only `unitId`/`selectedSetId`, which still exist).

- [ ] **Step 3: Commit**

```bash
git add src/features/insulation-set-filter/model/useInsulationSetFilter.ts
git commit -m "Add selectedUnitNo/selectUnitNo to useInsulationSetFilter"
```

---

### Task 6: `features/cutting-session-reopen` — reopen dialog

**Files:**
- Create: `src/features/cutting-session-reopen/ui/ReopenSessionDialog.tsx`
- Create: `src/features/cutting-session-reopen/ui/ReopenSessionDialog.module.scss`
- Create: `src/features/cutting-session-reopen/index.ts`

**Interfaces:**
- Consumes: `useReopenCuttingSessionMutation` (Task 2), `useModal`/`MODAL_REGISTRY`/`ModalProps` from `@/app/providers`, `Modal` from `@/shared/ui`, `CuttingSession` type from `@/entities/cutting-session`.
- Produces: `MODAL_REGISTRY['reopenCuttingSession']` registered as a side effect of importing this module's `index.ts` (same pattern as `features/component-edit`). `ReopenSessionDialogProps` takes an `onReopened(unitNo)` callback rather than importing `useInsulationSetFilter` directly — `features/insulation-set-filter` (Task 7) imports *this* feature to open the dialog, so this feature must not import back into it, or the two slices would form an import cycle. The caller (Task 7) supplies `onReopened: selectUnitNo`.

- [ ] **Step 1: Write `ReopenSessionDialog.tsx`**

```tsx
import { useState } from 'react'
import { Modal } from '@/shared/ui'
import { useModal } from '@/app/providers'
import { useReopenCuttingSessionMutation } from '@/entities/cutting-session'
import type { CuttingSession } from '@/entities/cutting-session'
import styles from './ReopenSessionDialog.module.scss'

interface ReopenSessionDialogProps {
  session: CuttingSession
  onReopened: (unitNo: number) => void
}

// Открывается из InsulationFilterBar, когда пользователь вручную вводит
// unitNo, для которого уже есть ЗАВЕРШЁННАЯ сессия (docs/superpowers/specs/
// 2026-08-09-insulation-unitno-tracking-design.md). onReopened вместо прямого
// импорта useInsulationSetFilter — та фича сама открывает эту модалку, импорт
// в обратную сторону дал бы цикл между двумя слайсами features/.
export const ReopenSessionDialog = ({ session, onReopened }: ReopenSessionDialogProps) => {
  const { close } = useModal()
  const [reopenSession, { isLoading }] = useReopenCuttingSessionMutation()
  const [error, setError] = useState<string | null>(null)

  const handleReopen = async (resetDonePieces: boolean) => {
    setError(null)
    try {
      await reopenSession({
        sessionId: session.id,
        unitId: session.unit,
        setId: session.set,
        resetDonePieces,
      }).unwrap()
      onReopened(session.unitNo)
      close()
    } catch {
      setError('Не удалось выполнить действие. Попробуйте ещё раз.')
    }
  }

  return (
    <Modal title={`Установка №${session.unitNo} уже завершена по изоляции`} onClose={close}>
      <p className={styles.description}>
        Начать заново — сбросить отметки готовности и резать с чистого листа.
        Редактировать — открыть как есть, отметки останутся такими же, как на
        момент завершения.
      </p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.restart}
          disabled={isLoading}
          onClick={() => handleReopen(true)}
        >
          Начать заново
        </button>
        <button type="button" className={styles.edit} disabled={isLoading} onClick={() => handleReopen(false)}>
          Редактировать
        </button>
        <button type="button" className={styles.cancel} disabled={isLoading} onClick={close}>
          Отмена
        </button>
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
    </Modal>
  )
}
```

- [ ] **Step 2: Write `ReopenSessionDialog.module.scss`**

```scss
.description {
  color: $color-text-muted;
  font-size: 0.9375rem;
  line-height: 1.5;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: $space-2;
  margin-top: $space-3;
}

.restart,
.edit,
.cancel {
  padding: 0 $space-4;

  @include touch-target;

  border-radius: $radius-sm;
  font-size: 0.9375rem;
  font-weight: 600;

  @include tap-feedback;
}

.restart,
.edit {
  color: $color-text;
  background: $color-bg;
  border: 1px solid $color-border;
}

.cancel {
  color: $color-text-muted;
  background: transparent;
  border: 1px solid transparent;
}

.error {
  margin-top: $space-2;
  color: $color-red;
  font-size: 0.875rem;
}
```

- [ ] **Step 3: Write `index.ts` (modal registration)**

```ts
import type { ComponentType } from 'react'
import { MODAL_REGISTRY, type ModalProps } from '@/app/providers'
import { ReopenSessionDialog } from './ui/ReopenSessionDialog'

// Импорт этого модуля где угодно (см. InsulationFilterBar) гарантированно
// регистрирует модалку до первого open() (docs/structure.md → "Модалки").
export const REOPEN_CUTTING_SESSION_MODAL = 'reopenCuttingSession'

MODAL_REGISTRY[REOPEN_CUTTING_SESSION_MODAL] = ReopenSessionDialog as unknown as ComponentType<ModalProps>
```

- [ ] **Step 4: Verify**

Run: `pnpm check`
Expected: PASS. Nothing imports `features/cutting-session-reopen` yet, so the registration side effect doesn't run in the app yet — that's fine, Task 7 wires the import in.

- [ ] **Step 5: Commit**

```bash
git add src/features/cutting-session-reopen
git commit -m "Add ReopenSessionDialog feature"
```

---

### Task 7: `InsulationFilterBar` — unitNo input + in-progress chips

**Files:**
- Create: `src/features/insulation-set-filter/model/useUnitNoCommit.ts`
- Modify: `src/features/insulation-set-filter/ui/InsulationFilterBar.tsx`
- Modify: `src/features/insulation-set-filter/ui/InsulationFilterBar.module.scss`

**Interfaces:**
- Consumes: `useLazyGetCuttingSessionByUnitNoQuery`, `useGetInProgressCuttingSessionsQuery` (Task 1), `REOPEN_CUTTING_SESSION_MODAL` (Task 6), `useModal` (`@/app/providers`), `useInsulationSetFilter` (Task 5).
- Produces: `useUnitNoCommit({ unitId, setId }) -> { commit: (unitNo: number) => Promise<void> }`.

- [ ] **Step 1: Write `useUnitNoCommit.ts`**

```ts
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

  const commit = async (unitNo: number) => {
    if (!unitId || !setId || !Number.isInteger(unitNo) || unitNo < 1) return
    const session = await fetchSession({ unitId, setId, unitNo }).unwrap()
    if (!session || session.status === 'in_progress') {
      selectUnitNo(unitNo)
      return
    }
    open(REOPEN_CUTTING_SESSION_MODAL, { session, onReopened: selectUnitNo })
  }

  return { commit }
}
```

- [ ] **Step 2: Wire the import that registers the reopen modal**

`features/cutting-session-reopen`'s `MODAL_REGISTRY` entry only exists once that module is imported somewhere reachable from the app. `useUnitNoCommit.ts` already imports `REOPEN_CUTTING_SESSION_MODAL` from it above, which is enough — importing any named export from `index.ts` runs the module's top-level `MODAL_REGISTRY[...] = ...` side effect. No separate import needed.

- [ ] **Step 3: Update `InsulationFilterBar.tsx`**

Replace the full contents of `src/features/insulation-set-filter/ui/InsulationFilterBar.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { skipToken } from '@reduxjs/toolkit/query/react'
import { format } from 'date-fns'
import { Combobox } from '@/shared/ui'
import { useGetUnitsQuery } from '@/entities/refrigeration-unit'
import type { RefrigerationUnit } from '@/entities/refrigeration-unit'
import type { InsulationSet } from '@/entities/insulation-set'
import { useGetInProgressCuttingSessionsQuery } from '@/entities/cutting-session'
import { useInsulationSetFilter } from '../model/useInsulationSetFilter'
import { useUnitNoCommit } from '../model/useUnitNoCommit'
import styles from './InsulationFilterBar.module.scss'

const getUnitLabel = (unit: RefrigerationUnit): string => unit.name
const getUnitKey = (unit: RefrigerationUnit): string => unit.id

const getSetLabel = (set: InsulationSet): string => {
  const date = format(new Date(set.effectiveFrom), 'dd.MM.yyyy')
  return set.name ? `${set.name} (${date})` : date
}
const getSetKey = (set: InsulationSet): string => set.id

// Установка → версия набора → номер установки: версия недоступна, пока не
// выбрана установка, номер — пока не выбраны установка и версия
// (docs/spec.md).
export const InsulationFilterBar = () => {
  const { unitId, selectUnit, sets, selectedSet, selectSet, selectedSetId, selectedUnitNo } =
    useInsulationSetFilter()
  const { data: units = [] } = useGetUnitsQuery({ includeArchived: false })
  const { commit } = useUnitNoCommit({ unitId, setId: selectedSetId })
  const { data: inProgress = [] } = useGetInProgressCuttingSessionsQuery(
    unitId && selectedSetId ? { unitId, setId: selectedSetId } : skipToken,
  )

  // Локальный draft — коммитим по Enter/blur, не на каждый символ. Синк с
  // selectedUnitNo обрабатывает и внешние смены (чипы, реоткрытие, "Сохранить"
  // переключает на N+1), и первичный автовыбор.
  const [draft, setDraft] = useState('')
  useEffect(() => {
    setDraft(selectedUnitNo !== null ? String(selectedUnitNo) : '')
  }, [selectedUnitNo])

  const selectedUnit = units.find((unit) => unit.id === unitId) ?? null

  const commitDraft = () => {
    const parsed = Number(draft)
    if (Number.isInteger(parsed) && parsed >= 1) {
      commit(parsed)
    } else {
      setDraft(selectedUnitNo !== null ? String(selectedUnitNo) : '')
    }
  }

  return (
    <div className={styles.root}>
      <Combobox<RefrigerationUnit>
        items={units}
        value={selectedUnit}
        onChange={(unit) => selectUnit(unit?.id ?? null)}
        getItemLabel={getUnitLabel}
        getItemKey={getUnitKey}
        placeholder="Установка"
        aria-label="Выбор холодильной установки"
      />
      <Combobox<InsulationSet>
        items={sets}
        value={selectedSet}
        onChange={(set) => selectSet(set?.id ?? null)}
        getItemLabel={getSetLabel}
        getItemKey={getSetKey}
        placeholder="Версия набора"
        disabled={!unitId}
        aria-label="Выбор версии набора изоляции"
      />
      {unitId && selectedSetId ? (
        <div className={styles.unitNo}>
          <input
            className={styles.unitNoInput}
            type="number"
            min={1}
            step={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitDraft()
              }
            }}
            placeholder="№ установки"
            aria-label="Номер установки"
          />
          {inProgress.length > 0 ? (
            <div className={styles.chips} role="group" aria-label="Установки в работе">
              {inProgress.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  className={styles.chip}
                  aria-pressed={session.unitNo === selectedUnitNo}
                  onClick={() => commit(session.unitNo)}
                >
                  {session.unitNo}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 4: Add styles to `InsulationFilterBar.module.scss`**

Append to the existing file:

```scss
.unitNo {
  display: flex;
  flex-direction: column;
  gap: $space-1;
}

.unitNoInput {
  width: 100%;
  height: $touch-target-min;
  padding: 0 $space-3;
  border: 1px solid $color-border;
  border-radius: $radius-sm;
  background: $color-bg;
  color: $color-text;
  font-size: 0.9375rem;
  font-variant-numeric: tabular-nums;

  @include respond-to(tablet) {
    width: 140px;
  }

  &:focus-visible {
    @include focus-ring;
  }
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: $space-1;
}

.chip {
  padding: 0 $space-2;
  min-height: 32px;
  color: $color-text-muted;
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: $radius-sm;
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;

  @include tap-feedback;

  &[aria-pressed='true'] {
    color: $color-accent-cyan;
    background: $color-accent-cyan-muted;
    border-color: $color-accent-cyan;
  }
}
```

- [ ] **Step 5: Verify**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 6: Manual verification** (`pnpm pb` + `pnpm dev`)

- Selecting a unit+set shows the number input pre-filled with `lastCompletedUnitNoInsulation + 1`.
- Typing a new number and pressing Enter creates a new session for it (verify via a fresh `InsulationGroupList` render — pieces show as not-done).
- Typing a number that already has a completed session opens the reopen dialog (build one manually in this task's manual check by completing a session first isn't possible yet — defer full end-to-end check on this specific path to Task 10; for now just confirm invalid input, e.g. `0` or blank, reverts to `selectedUnitNo` on blur).
- Chips appear once at least one other in-progress session exists for the same unit+set (open a second browser tab or devtools to create one via a different number, confirm the chip list updates within one refetch).

- [ ] **Step 7: Commit**

```bash
git add src/features/insulation-set-filter
git commit -m "Add manual unitNo input and in-progress chips to InsulationFilterBar"
```

---

### Task 8: `useInsulationProgress` — accept `unitNo` from the filter

**Files:**
- Modify: `src/features/insulation-progress/model/useInsulationProgress.ts`
- Modify: `src/pages/insulation/ui/InsulationPage.tsx`

**Interfaces:**
- Consumes: `useInsulationSetFilter().selectedUnitNo` (Task 5).
- Produces: `useInsulationProgress({ unitId, setId, unitNo }: { unitId: UnitId | null; setId: InsulationSetId | null; unitNo: number | null })` — same return shape as before (`isPieceDone, toggle, setGroupDone, pendingGroupIds, isLoading`).

- [ ] **Step 1: Update `useInsulationProgress.ts`**

Remove the internal `unitNo` computation — the hook now receives it as a parameter. Replace the top of the file (imports through the `sessionArgs` line):

```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import { skipToken } from '@reduxjs/toolkit/query/react'
import { useAppDispatch, useAppStore } from '@/app/store'
import { useGetFirstUserQuery } from '@/entities/user'
import type { UnitId } from '@/entities/refrigeration-unit'
import type { InsulationSetId } from '@/entities/insulation-set'
import {
  cuttingSessionApi,
  useGetActiveCuttingSessionQuery,
  useUpdateDonePiecesMutation,
} from '@/entities/cutting-session'
import type { GetActiveCuttingSessionArgs } from '@/entities/cutting-session'
import { applyToggle } from '../lib/applyToggle'
import { applyBulk } from '../lib/applyBulk'

const FLUSH_DELAY_MS = 500

interface UseInsulationProgressArgs {
  unitId: UnitId | null
  setId: InsulationSetId | null
  // Приходит из useInsulationSetFilter().selectedUnitNo — вычисление номера
  // (автовыбор lastCompletedUnitNoInsulation + 1 или явный выбор пользователя)
  // больше не задача этого хука.
  unitNo: number | null
}

export const useInsulationProgress = ({ unitId, setId, unitNo }: UseInsulationProgressArgs) => {
  const dispatch = useAppDispatch()
  const store = useAppStore()
  const { data: user } = useGetFirstUserQuery()

  const sessionArgs: GetActiveCuttingSessionArgs | typeof skipToken =
    unitId && setId && unitNo !== null && user ? { unitId, setId, unitNo, userId: user.id } : skipToken
```

The block above replaces everything from the top of the file through the `sessionArgs` assignment — it already drops the `useGetUnitsQuery` import and the `unit`/`unitNo` computation lines (that logic moved to `useInsulationSetFilter` in Task 5). Everything from `const { data: session, isLoading } = useGetActiveCuttingSessionQuery(sessionArgs)` to the end of the file needs no edits at all — including the `useEffect(() => { return () => flush() }, [unitId, setId, unitNo, user?.id, flush])` cleanup effect, which keeps working unchanged since `unitNo` still resolves to the same name, just as a prop now instead of a local `const`.

- [ ] **Step 2: Update `InsulationPage.tsx`'s call site**

In `src/pages/insulation/ui/InsulationPage.tsx`, change:

```ts
const { unitId, selectedSetId } = useInsulationSetFilter()
```

to:

```ts
const { unitId, selectedSetId, selectedUnitNo } = useInsulationSetFilter()
```

and change:

```ts
const { isPieceDone, toggle, setGroupDone, pendingGroupIds } = useInsulationProgress({
  unitId,
  setId: selectedSetId,
})
```

to:

```ts
const { isPieceDone, toggle, setGroupDone, pendingGroupIds } = useInsulationProgress({
  unitId,
  setId: selectedSetId,
  unitNo: selectedUnitNo,
})
```

- [ ] **Step 3: Verify**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 4: Manual verification** (`pnpm pb` + `pnpm dev`)

- Piece toggling on `/insulation` still works exactly as before (this task is a pure refactor of where `unitNo` comes from, not a behavior change for the default case).

- [ ] **Step 5: Commit**

```bash
git add src/features/insulation-progress/model/useInsulationProgress.ts src/pages/insulation/ui/InsulationPage.tsx
git commit -m "Move unitNo computation from useInsulationProgress to useInsulationSetFilter"
```

---

### Task 9: `widgets/insulation-save-session`

**Files:**
- Create: `src/widgets/insulation-save-session/model/useInsulationSaveSession.ts`
- Create: `src/widgets/insulation-save-session/ui/InsulationSaveSession.tsx`
- Create: `src/widgets/insulation-save-session/ui/InsulationSaveSession.module.scss`
- Create: `src/widgets/insulation-save-session/index.ts`

**Interfaces:**
- Consumes: `useInsulationSetFilter` (Task 5), `useGetActiveCuttingSessionQuery`, `useCompleteCuttingSessionMutation` (Task 3), `useGetFirstUserQuery` (`@/entities/user`).
- Produces: `<InsulationSaveSession />` — zero-prop widget, self-contained (pulls unit/set/unitNo from the filter slice itself, same standalone pattern as `InsulationFilterBar`).

- [ ] **Step 1: Write `useInsulationSaveSession.ts`**

```ts
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
```

- [ ] **Step 2: Write `InsulationSaveSession.tsx`**

```tsx
import { useInsulationSaveSession } from '../model/useInsulationSaveSession'
import styles from './InsulationSaveSession.module.scss'

// Финализация текущей активной сессии нарезки — отдельный блок под
// InsulationGlobalActions (docs/superpowers/specs/2026-08-09-...).
export const InsulationSaveSession = () => {
  const { isReady, isSaving, unitNo, errorMessage, save } = useInsulationSaveSession()

  if (!isReady) return null

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={styles.save}
        aria-disabled={isSaving}
        onClick={isSaving ? undefined : save}
      >
        {isSaving ? 'Сохранение…' : unitNo !== null ? `Сохранить установку №${unitNo}` : 'Сохранить'}
      </button>
      {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
    </div>
  )
}
```

- [ ] **Step 3: Write `InsulationSaveSession.module.scss`**

```scss
.root {
  display: flex;
  flex-direction: column;
  gap: $space-2;
  align-items: flex-start;
}

.save {
  padding: 0 $space-4;

  @include touch-target;

  color: $color-white;
  background: $color-accent-cyan;
  border: 1px solid $color-accent-cyan;
  border-radius: $radius-sm;
  font-size: 0.9375rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;

  @include tap-feedback;

  &[aria-disabled='true'] {
    opacity: 0.6;
  }
}

.error {
  color: $color-red;
  font-size: 0.875rem;
}
```

- [ ] **Step 4: Write `index.ts`**

```ts
export { InsulationSaveSession } from './ui/InsulationSaveSession'
```

- [ ] **Step 5: Verify**

Run: `pnpm check`
Expected: PASS. Nothing mounts `InsulationSaveSession` yet (Task 10 does).

- [ ] **Step 6: Commit**

```bash
git add src/widgets/insulation-save-session
git commit -m "Add InsulationSaveSession widget"
```

---

### Task 10: Wire `InsulationSaveSession` into `InsulationPage` + full manual pass

**Files:**
- Modify: `src/pages/insulation/ui/InsulationPage.tsx`

**Interfaces:**
- Consumes: `InsulationSaveSession` from `@/widgets/insulation-save-session` (Task 9).

- [ ] **Step 1: Mount the widget**

In `src/pages/insulation/ui/InsulationPage.tsx`, add the import:

```ts
import { InsulationSaveSession } from '@/widgets/insulation-save-session'
```

Add `<InsulationSaveSession />` right after `<InsulationGlobalActions ... />` (still inside the same fragment, after the group list and stats):

```tsx
<InsulationGlobalActions
  groups={groups}
  isLoading={isFetching}
  isPieceDone={isPieceDone}
  pendingGroupIds={pendingGroupIds}
  onSetGroupDone={setGroupDone}
/>
<InsulationSaveSession />
```

- [ ] **Step 2: Verify**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 3: Full manual verification** (`pnpm pb` + `pnpm dev`, on `/insulation`)

Walk through the whole flow end to end:

- Select a unit + set with no prior sessions — input shows `lastCompletedUnitNoInsulation + 1`, "Сохранить установку №N" button appears once the session loads.
- Toggle a few pieces, click "Сохранить" → confirm dialog → accept → `units.lastCompletedUnitNoInsulation` updates (check via the unit's card elsewhere in the app, or PocketBase admin UI) and the input/button switch to N+1 automatically.
- Type the just-completed number N again, press Enter → `ReopenSessionDialog` opens with the title `Установка №N уже завершена по изоляции`.
  - "Отмена" → dialog closes, input reverts to whatever was selected before (not N).
  - Re-trigger, choose "Начать заново" → dialog closes, input shows N, all pieces show not-done.
  - Toggle one piece, save again, re-trigger the dialog on N, choose "Редактировать" → pieces show the state they had at the moment of the previous save (not reset).
- Two parallel numbers: switch to a fresh number M for the same unit+set (e.g. N+2), toggle pieces there, switch back to N+1 via the chip — confirm N+1's progress is untouched by what happened on M, and vice versa.
- Ordering guard: with N+1 still `in_progress`, switch to N+2's session and click "Сохранить" — expect the inline error `Установка №{N+1} ещё не завершена по изоляции. Сначала завершите её.` and no counter update.
- Switching the insulation-set version dropdown does not reset the number in the input; switching the unit dropdown does reset it (back to that unit's own default).
- Keyboard-only pass: Tab to the number input, edit with keyboard, Enter to commit; Tab through chips (each is a real `<button>`); Tab/Enter through the reopen dialog's three actions; visible focus ring throughout.

- [ ] **Step 4: Final full check**

Run: `pnpm check`
Expected: PASS (typecheck + lint + all unit tests).

- [ ] **Step 5: Commit**

```bash
git add src/pages/insulation/ui/InsulationPage.tsx
git commit -m "Mount InsulationSaveSession on the insulation page"
```
