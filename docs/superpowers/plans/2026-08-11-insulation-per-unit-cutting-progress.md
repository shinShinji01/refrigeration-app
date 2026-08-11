# Insulation cutting progress — per-unit tracking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a worker track partial cutting progress on an insulation piece whose `quantity > 1` (e.g. "cut 2 of 5 today"), instead of only an all-or-nothing done flag per `group_pieces` row.

**Architecture:** `cutting_sessions.donePieces` widens from `Record<groupPieceId, true>` to `Record<groupPieceId, number | true>` (same `json` PocketBase field, no schema change; legacy `true` reads as "fully done"). `features/insulation-progress` gains `resolveDoneCount`/`applySetCount`/`isGroupFullyDone` (built additively alongside the old `applyToggle`/`isGroupDone` first, so early tasks stay green), then one consolidated task swings `useInsulationProgress` and every consumer over to the new count-based API in a single commit — `tsc -b`'s whole-project check means the producer (hook) and all six consumers must move together, there is no safe halfway point to split that particular change across commits.

**Tech Stack:** React 19 + TypeScript strict, Redux Toolkit Query (optimistic cache patch + 500ms debounced flush — existing mechanism, unchanged), SASS modules, Vitest.

## Global Constraints

- Full spec: `docs/superpowers/specs/2026-08-11-insulation-per-unit-cutting-progress-design.md` — read it before starting, this plan implements it task-by-task.
- No PocketBase schema/migration changes — `donePieces` stays a `json` field; only the TS value type widens (`number | true`). Legacy `true` values are read as "fully done" via `resolveDoneCount`, never migrated.
- No new dependencies.
- Commit messages in English, imperative mood (project convention override of `CLAUDE.md`'s "Russian commit messages" — see `docs/decisions.md`/prior increments).
- Work happens on a fresh branch/worktree created from `master` before Task 1 (this repo's convention per prior increments: `EnterWorktree` / `git worktree`, not committing straight to `master`).
- Run `pnpm check` (typecheck + lint + test) at the end of every task — the repo must be green at every commit. Task 6 is the one exception to "green after every *step*" (not task): it's a single atomic rename that ripples through the hook and six consumers at once, so its intermediate steps are red by design and nothing is committed until its final verify step passes — see the note at the top of Task 6.
- No `any`. Id types stay branded (`InsulationGroupId`, `InsulationPieceId`, `CuttingSessionId`).
- Only pure/reducer logic gets automated tests (matches existing project convention). UI is verified manually via `pnpm dev` + `pnpm pb` — this feature is interaction-heavy (stepper taps, reset-on-full, partial-state styling), so the manual pass in Task 6 must actually run in a browser this time, not be skipped for lack of seed data (see spec's Testing section).
- Colors/spacing/radii — only via SCSS tokens, no hardcoded hex. Media queries only via `@include respond-to(tablet)`. Max 3 levels of SCSS nesting.

---

### Task 1: `shared/assets/icons` — add the minus icon

**Files:**
- Create: `src/shared/assets/icons/minus.svg`

**Interfaces:**
- Produces: an SVG importable as `import MinusIcon from '@/shared/assets/icons/minus.svg?react'` (same `vite-plugin-svgr` convention as every other icon in this folder).

- [ ] **Step 1: Create `minus.svg`**

Same style as the existing `close.svg` (`viewBox="0 0 24 24"`, `stroke="currentColor"`, `stroke-width="2"`, `stroke-linecap="round"`) — one horizontal line:

```svg
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M6 12h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
</svg>
```

- [ ] **Step 2: Verify**

Run: `pnpm check`
Expected: PASS (nothing imports it yet — this only needs to exist and lint clean as a static asset, no lint rule applies to SVGs).

- [ ] **Step 3: Commit**

```bash
git add src/shared/assets/icons/minus.svg
git commit -m "Add minus icon"
```

---

### Task 2: `features/insulation-progress` — `resolveDoneCount`

**Files:**
- Create: `src/features/insulation-progress/lib/resolveDoneCount.ts`
- Create: `src/features/insulation-progress/lib/resolveDoneCount.test.ts`

**Interfaces:**
- Produces: `resolveDoneCount(raw: number | true | undefined, quantity: number): number`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { resolveDoneCount } from './resolveDoneCount'

describe('resolveDoneCount', () => {
  it('возвращает число как есть', () => {
    expect(resolveDoneCount(2, 5)).toBe(2)
  })

  it('true (легаси-запись) трактует как «полностью готово»', () => {
    expect(resolveDoneCount(true, 5)).toBe(5)
  })

  it('undefined (ключа нет в donePieces) — 0', () => {
    expect(resolveDoneCount(undefined, 5)).toBe(0)
  })

  it('0 остаётся 0', () => {
    expect(resolveDoneCount(0, 5)).toBe(0)
  })
})
```

Save as `src/features/insulation-progress/lib/resolveDoneCount.test.ts`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test resolveDoneCount`
Expected: FAIL — `resolveDoneCount` module not found.

- [ ] **Step 3: Implement `resolveDoneCount.ts`**

```ts
// Значение в cutting_sessions.donePieces — число (сколько единиц куска
// отрезано) для новых записей, либо легаси true (записи до введения
// частичного прогресса, docs/superpowers/specs/2026-08-11-...) — трактуется
// как "полностью готово". Миграция данных не нужна: перезаписывается числом
// при первом же изменении этого куска.
export const resolveDoneCount = (raw: number | true | undefined, quantity: number): number =>
  raw === true ? quantity : (raw ?? 0)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test resolveDoneCount`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/insulation-progress/lib/resolveDoneCount.ts src/features/insulation-progress/lib/resolveDoneCount.test.ts
git commit -m "Add resolveDoneCount helper"
```

---

### Task 3: `features/insulation-progress` — add `applySetCount`

**Files:**
- Create: `src/features/insulation-progress/lib/applySetCount.ts`
- Create: `src/features/insulation-progress/lib/applySetCount.test.ts`

**Interfaces:**
- Produces: `applySetCount(donePieces: Record<string, number | true>, groupPieceId: string, count: number): Record<string, number | true>`.

This adds the new function **alongside** the still-in-use `applyToggle.ts` — nothing deletes or rewires `applyToggle` yet (that happens in Task 6, together with its only consumer, `useInsulationProgress`). This task is purely additive and stays green on its own.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { applySetCount } from './applySetCount'

describe('applySetCount', () => {
  it('пишет count, если count > 0', () => {
    expect(applySetCount({}, 'gp-1', 2)).toEqual({ 'gp-1': 2 })
  })

  it('перезаписывает существующее значение', () => {
    expect(applySetCount({ 'gp-1': 2 }, 'gp-1', 5)).toEqual({ 'gp-1': 5 })
  })

  it('перезаписывает легаси true новым числом', () => {
    expect(applySetCount({ 'gp-1': true }, 'gp-1', 3)).toEqual({ 'gp-1': 3 })
  })

  it('удаляет ключ при count === 0', () => {
    expect(applySetCount({ 'gp-1': 3, 'gp-2': 1 }, 'gp-1', 0)).toEqual({ 'gp-2': 1 })
  })

  it('удаляет ключ при count < 0 (защита от некорректного вызова)', () => {
    expect(applySetCount({ 'gp-1': 3 }, 'gp-1', -1)).toEqual({})
  })

  it('не трогает остальные ключи', () => {
    expect(applySetCount({ 'gp-2': 4 }, 'gp-1', 1)).toEqual({ 'gp-1': 1, 'gp-2': 4 })
  })
})
```

Save as `src/features/insulation-progress/lib/applySetCount.test.ts`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test applySetCount`
Expected: FAIL — `applySetCount` module not found.

- [ ] **Step 3: Implement `applySetCount.ts`**

```ts
export const applySetCount = (
  donePieces: Record<string, number | true>,
  groupPieceId: string,
  count: number,
): Record<string, number | true> => {
  if (count <= 0) {
    const rest = { ...donePieces }
    delete rest[groupPieceId]
    return rest
  }
  return { ...donePieces, [groupPieceId]: count }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test applySetCount`
Expected: PASS (6 tests).

- [ ] **Step 5: Verify**

Run: `pnpm check`
Expected: PASS. `applyToggle.ts` still exists untouched and `useInsulationProgress.ts` still uses it — this task only adds a new, not-yet-consumed file.

- [ ] **Step 6: Commit**

```bash
git add src/features/insulation-progress/lib/applySetCount.ts src/features/insulation-progress/lib/applySetCount.test.ts
git commit -m "Add count-based applySetCount alongside applyToggle"
```

---

### Task 4: `features/insulation-progress` — add `isGroupFullyDone`

**Files:**
- Create: `src/features/insulation-progress/lib/isGroupFullyDone.ts`
- Create: `src/features/insulation-progress/lib/isGroupFullyDone.test.ts`

**Interfaces:**
- Produces: `isGroupFullyDone(pieces: { linkId: string; quantity: number }[], getDoneCount: (linkId: string, quantity: number) => number): boolean`.

Same additive shape as Task 3 — `isGroupDone.ts` stays untouched, still used by `InsulationGroupItem.tsx` and `useInsulationGlobalActions.ts` until Task 6.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { isGroupFullyDone } from './isGroupFullyDone'

const piece = (linkId: string, quantity: number) => ({ linkId, quantity })
const getDoneCount = (counts: Record<string, number>) => (linkId: string) => counts[linkId] ?? 0

describe('isGroupFullyDone', () => {
  it('false для пустой группы', () => {
    expect(isGroupFullyDone([], getDoneCount({}))).toBe(false)
  })

  it('false, если хотя бы один кусок не полностью готов', () => {
    expect(isGroupFullyDone([piece('gp-1', 2), piece('gp-2', 1)], getDoneCount({ 'gp-1': 1, 'gp-2': 1 }))).toBe(
      false,
    )
  })

  it('true, если у каждого куска count достиг quantity', () => {
    expect(isGroupFullyDone([piece('gp-1', 2), piece('gp-2', 1)], getDoneCount({ 'gp-1': 2, 'gp-2': 1 }))).toBe(
      true,
    )
  })

  it('не зависит от лишних отметок вне группы', () => {
    expect(isGroupFullyDone([piece('gp-1', 1)], getDoneCount({ 'gp-1': 1, 'gp-99': 1 }))).toBe(true)
  })
})
```

Save as `src/features/insulation-progress/lib/isGroupFullyDone.test.ts`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test isGroupFullyDone`
Expected: FAIL — `isGroupFullyDone` module not found.

- [ ] **Step 3: Implement `isGroupFullyDone.ts`**

```ts
export const isGroupFullyDone = (
  pieces: { linkId: string; quantity: number }[],
  getDoneCount: (linkId: string, quantity: number) => number,
): boolean =>
  pieces.length > 0 && pieces.every((piece) => getDoneCount(piece.linkId, piece.quantity) >= piece.quantity)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test isGroupFullyDone`
Expected: PASS (4 tests).

- [ ] **Step 5: Verify**

Run: `pnpm check`
Expected: PASS. `isGroupDone.ts` still exists untouched and its two consumers still use it.

- [ ] **Step 6: Commit**

```bash
git add src/features/insulation-progress/lib/isGroupFullyDone.ts src/features/insulation-progress/lib/isGroupFullyDone.test.ts
git commit -m "Add quantity-aware isGroupFullyDone alongside isGroupDone"
```

---

### Task 5: `entities/cutting-session` — widen `donePieces` value type

**Files:**
- Modify: `src/entities/cutting-session/model/types.ts`
- Modify: `src/entities/cutting-session/api/cuttingSessionApi.ts`

**Interfaces:**
- Produces: `CuttingSession.donePieces: Record<string, number | true>` (was `Record<string, true>`); `useUpdateDonePiecesMutation` argument `donePieces: Record<string, number | true>`.

This is a pure widening — every existing call site only ever wrote `true`, and `Record<string, true>` is assignable to `Record<string, number | true>`, so nothing breaks.

- [ ] **Step 1: Update `CuttingSession.donePieces`**

In `src/entities/cutting-session/model/types.ts`, change:

```ts
  donePieces: Record<string, true>
```

to:

```ts
  donePieces: Record<string, number | true>
```

- [ ] **Step 2: Update the `updateDonePieces` mutation argument type**

In `src/entities/cutting-session/api/cuttingSessionApi.ts`, change:

```ts
    updateDonePieces: builder.mutation<
      CuttingSession,
      { sessionId: CuttingSessionId; donePieces: Record<string, true> }
    >({
```

to:

```ts
    updateDonePieces: builder.mutation<
      CuttingSession,
      { sessionId: CuttingSessionId; donePieces: Record<string, number | true> }
    >({
```

- [ ] **Step 3: Verify**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/entities/cutting-session
git commit -m "Widen CuttingSession.donePieces value type to number | true"
```

---

### Task 6: Swing the whole progress API over to counts

**Files:**
- Modify: `src/features/insulation-progress/lib/applyBulk.ts`
- Modify: `src/features/insulation-progress/lib/applyBulk.test.ts`
- Modify: `src/features/insulation-progress/model/useInsulationProgress.ts`
- Modify: `src/features/insulation-progress/index.ts`
- Delete: `src/features/insulation-progress/lib/applyToggle.ts`
- Delete: `src/features/insulation-progress/lib/applyToggle.test.ts`
- Delete: `src/features/insulation-progress/lib/isGroupDone.ts`
- Delete: `src/features/insulation-progress/lib/isGroupDone.test.ts`
- Modify: `src/entities/insulation-piece/ui/InsulationPieceCard.tsx`
- Modify: `src/entities/insulation-piece/ui/InsulationPieceCard.module.scss`
- Modify: `src/widgets/insulation-group-list/ui/InsulationGroupItem.tsx`
- Modify: `src/widgets/insulation-group-list/ui/InsulationThicknessList.tsx`
- Modify: `src/widgets/insulation-group-list/ui/InsulationGroupList.tsx`
- Modify: `src/widgets/insulation-global-actions/model/useInsulationGlobalActions.ts`
- Modify: `src/widgets/insulation-global-actions/ui/InsulationGlobalActions.tsx`
- Modify: `src/pages/insulation/ui/InsulationPage.tsx`

**Interfaces:**
- Consumes: `applySetCount` (Task 3), `isGroupFullyDone` (Task 4), `MinusIcon` (Task 1), `IconButton` (`@/shared/ui`).
- Produces: `useInsulationProgress(args)` returns `{ getPieceDoneCount: (groupPieceId: string, quantity: number) => number; setPieceCount: (groupPieceId: string, count: number) => void; setGroupDone: (groupId: string, pieces: { linkId: string; quantity: number }[], done: boolean) => void; pendingGroupIds: ReadonlySet<string>; isLoading: boolean }`. `InsulationPieceCardProps` drops `isDone`/`onToggle`, gains `doneCount: number` and `onChangeCount: (nextCount: number) => void`. `InsulationGroupItemProps`/`InsulationThicknessListProps`/`InsulationGroupListProps`/`InsulationGlobalActionsProps` all drop `isPieceDone`/`onTogglePiece` for `getPieceDoneCount`/`onSetPieceCount`, and `onSetGroupDone`'s second parameter becomes `{ linkId: string; quantity: number }[]` everywhere.

**Why one task:** `useInsulationProgress`'s return shape is consumed directly or indirectly by every file listed above. `tsc -b --noEmit` checks the whole project on every run, so changing that shape makes all six consumers fail to compile in the same instant — there is no ordering of separate commits that keeps every intermediate commit green without introducing a temporary dual-API shim (not worth the complexity for a rename with a single sequential implementer and no parallel consumers, per the design doc's approach). The steps below are ordered bottom-up for readability; `pnpm check` is expected to keep failing (with a shrinking, listed set of errors) until Step K — that's normal for this task and does not mean something is wrong. Nothing gets committed until Step L.

- [ ] **Step 1: Update `applyBulk`'s test to the new signature (write first, it will fail)**

Replace the full contents of `applyBulk.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { applyBulk } from './applyBulk'

const piece = (linkId: string, quantity: number) => ({ linkId, quantity })

describe('applyBulk', () => {
  it('пишет quantity каждому куску при done=true', () => {
    expect(applyBulk({}, [piece('gp-1', 2), piece('gp-2', 5)], true)).toEqual({ 'gp-1': 2, 'gp-2': 5 })
  })

  it('удаляет ключи всех переданных кусков при done=false', () => {
    expect(applyBulk({ 'gp-1': 2, 'gp-2': 5, 'gp-3': 1 }, [piece('gp-1', 2), piece('gp-2', 5)], false)).toEqual({
      'gp-3': 1,
    })
  })

  it('не трогает куски, не входящие в переданный список', () => {
    expect(applyBulk({ 'gp-9': 3 }, [piece('gp-1', 1)], true)).toEqual({ 'gp-9': 3, 'gp-1': 1 })
  })

  it('пустой список кусков не меняет содержимое', () => {
    expect(applyBulk({ 'gp-1': 1 }, [], true)).toEqual({ 'gp-1': 1 })
    expect(applyBulk({ 'gp-1': 1 }, [], false)).toEqual({ 'gp-1': 1 })
  })

  it('идемпотентна: повторный вызов с тем же done ничего не меняет', () => {
    const once = applyBulk({}, [piece('gp-1', 2), piece('gp-2', 3)], true)
    const twice = applyBulk(once, [piece('gp-1', 2), piece('gp-2', 3)], true)
    expect(twice).toEqual(once)

    const cleared = applyBulk(twice, [piece('gp-1', 2), piece('gp-2', 3)], false)
    const clearedAgain = applyBulk(cleared, [piece('gp-1', 2), piece('gp-2', 3)], false)
    expect(clearedAgain).toEqual(cleared)
  })

  it('всегда возвращает новый объект', () => {
    const original = { 'gp-1': 1 }
    expect(applyBulk(original, [piece('gp-1', 1)], true)).not.toBe(original)
    expect(applyBulk(original, [piece('gp-1', 1)], false)).not.toBe(original)
  })

  it('перезаписывает легаси true новым числом при done=true', () => {
    expect(applyBulk({ 'gp-1': true }, [piece('gp-1', 4)], true)).toEqual({ 'gp-1': 4 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test applyBulk`
Expected: FAIL — old `applyBulk` takes `string[]`, and the old implementation writes `true` not the quantity, so several assertions fail (e.g. `{ 'gp-1': 2 }` vs `{ 'gp-1': true }`).

- [ ] **Step 3: Update `applyBulk.ts`**

Replace the full contents:

```ts
export const applyBulk = (
  donePieces: Record<string, number | true>,
  pieces: { linkId: string; quantity: number }[],
  done: boolean,
): Record<string, number | true> => {
  const next = { ...donePieces }
  for (const { linkId, quantity } of pieces) {
    if (done) {
      next[linkId] = quantity
    } else {
      delete next[linkId]
    }
  }
  return next
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test applyBulk`
Expected: PASS (7 tests). Everything else in the project is now red (`useInsulationProgress.ts` calls `applyBulk` with the old `string[]` shape) — expected at this point, fixed in the next step.

- [ ] **Step 5: Rewrite `useInsulationProgress.ts`**

Update imports — replace:

```ts
import { applyToggle } from '../lib/applyToggle'
import { applyBulk } from '../lib/applyBulk'
```

with:

```ts
import { applySetCount } from '../lib/applySetCount'
import { applyBulk } from '../lib/applyBulk'
import { resolveDoneCount } from '../lib/resolveDoneCount'
```

Replace the `toggle` callback:

```ts
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
```

with:

```ts
  const setPieceCount = useCallback(
    (groupPieceId: string, count: number) => {
      const args = sessionArgsRef.current
      if (args === skipToken) return
      // Отметка "щёлкает" мгновенно — патчим кеш RTK Query, не дожидаясь сети.
      dispatch(
        cuttingSessionApi.util.updateQueryData('getActiveCuttingSession', args, (draft) => {
          draft.donePieces = applySetCount(draft.donePieces, groupPieceId, count)
        }),
      )
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(flush, FLUSH_DELAY_MS)
    },
    [dispatch, flush],
  )
```

Replace `setGroupDone`'s parameter type:

```ts
  const setGroupDone = useCallback(
    (groupId: string, groupPieceIds: string[], done: boolean) => {
      const args = sessionArgsRef.current
      if (args === skipToken) return
      dispatch(
        cuttingSessionApi.util.updateQueryData('getActiveCuttingSession', args, (draft) => {
          draft.donePieces = applyBulk(draft.donePieces, groupPieceIds, done)
        }),
      )
      setPendingGroupIds((prev) => new Set(prev).add(groupId))
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(flush, FLUSH_DELAY_MS)
    },
    [dispatch, flush],
  )
```

with:

```ts
  const setGroupDone = useCallback(
    (groupId: string, pieces: { linkId: string; quantity: number }[], done: boolean) => {
      const args = sessionArgsRef.current
      if (args === skipToken) return
      dispatch(
        cuttingSessionApi.util.updateQueryData('getActiveCuttingSession', args, (draft) => {
          draft.donePieces = applyBulk(draft.donePieces, pieces, done)
        }),
      )
      setPendingGroupIds((prev) => new Set(prev).add(groupId))
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(flush, FLUSH_DELAY_MS)
    },
    [dispatch, flush],
  )
```

Replace `isPieceDone` and the hook's return statement:

```ts
  const isPieceDone = useCallback(
    (groupPieceId: string) => Boolean(session?.donePieces[groupPieceId]),
    [session],
  )

  return { isPieceDone, toggle, setGroupDone, pendingGroupIds, isLoading }
```

with:

```ts
  const getPieceDoneCount = useCallback(
    (groupPieceId: string, quantity: number) => resolveDoneCount(session?.donePieces[groupPieceId], quantity),
    [session],
  )

  return { getPieceDoneCount, setPieceCount, setGroupDone, pendingGroupIds, isLoading }
```

- [ ] **Step 6: Delete the now-unused old lib files**

```bash
git rm src/features/insulation-progress/lib/applyToggle.ts src/features/insulation-progress/lib/applyToggle.test.ts
git rm src/features/insulation-progress/lib/isGroupDone.ts src/features/insulation-progress/lib/isGroupDone.test.ts
```

- [ ] **Step 7: Update the barrel export**

Replace the full contents of `src/features/insulation-progress/index.ts`:

```ts
export { useInsulationProgress } from './model/useInsulationProgress'
export { applySetCount } from './lib/applySetCount'
export { isGroupFullyDone } from './lib/isGroupFullyDone'
export { applyBulk } from './lib/applyBulk'
export { ALL_GROUPS_SENTINEL } from './lib/allGroupsSentinel'
```

- [ ] **Step 8: Replace `InsulationPieceCard.tsx`**

```tsx
import type { CSSProperties, KeyboardEvent } from 'react'
import clsx from 'clsx'
import TypeInsulationIcon from '@/shared/assets/icons/type-insulation.svg?react'
import CheckIcon from '@/shared/assets/icons/check.svg?react'
import MinusIcon from '@/shared/assets/icons/minus.svg?react'
import { IconButton } from '@/shared/ui'
import { formatArea } from '@/shared/lib/utils'
import type { InsulationPieceWithQuantity } from '../model/types'
import styles from './InsulationPieceCard.module.scss'

interface InsulationPieceCardProps {
  piece: InsulationPieceWithQuantity
  // Сколько единиц куска уже отрезано. Для piece.quantity === 1 принимает
  // только 0 или 1 (карточка ведёт себя как раньше — простой тоггл).
  doneCount: number
  onChangeCount: (nextCount: number) => void
  detailed?: boolean
  groupLabel?: string
}

const ACCENT = '#4a7a96'

const formatDimensions = (piece: InsulationPieceWithQuantity): string =>
  piece.geometry.kind === 'rect' ? `${piece.geometry.width} × ${piece.geometry.height} мм` : 'Многоугольник'

export const InsulationPieceCard = ({
  piece,
  doneCount,
  onChangeCount,
  detailed = true,
  groupLabel,
}: InsulationPieceCardProps) => {
  const style: CSSProperties & { '--accent': string } = { '--accent': ACCENT }
  const subtitle = piece.drawingNumbers.length > 0 ? piece.drawingNumbers.join(', ') : piece.id
  const hasStepper = piece.quantity > 1
  const isFull = doneCount >= piece.quantity
  const isPartial = doneCount > 0 && !isFull

  const body = (
    <div className={styles.body}>
      {groupLabel ? <span className={styles.groupLabel}>{groupLabel}</span> : null}
      <h4 className={styles.title}>{piece.name}</h4>
      {detailed ? <p className={styles.subtitle}>{subtitle}</p> : null}
      <dl className={styles.stats}>
        <div className={styles.stat}>
          <dt>Размер</dt>
          <dd>{formatDimensions(piece)}</dd>
        </div>
        <div className={styles.stat}>
          <dt>Толщина</dt>
          <dd>{piece.thicknessMm} мм</dd>
        </div>
        {detailed ? (
          <div className={styles.stat}>
            <dt>Площадь</dt>
            <dd>{formatArea(piece.areaMm2)}</dd>
          </div>
        ) : null}
      </dl>
      {detailed && piece.hasAdhesive ? <span className={styles.adhesive}>Клеевой слой</span> : null}
    </div>
  )

  // quantity === 1 — подавляющее большинство карточек: разметка и поведение
  // не меняются относительно того, что было до частичного прогресса
  // (docs/superpowers/specs/2026-08-11-...) — вся карточка кликабельна,
  // один тап переключает 0 ↔ 1.
  if (!hasStepper) {
    const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onChangeCount(isFull ? 0 : 1)
      }
    }

    return (
      <article
        className={clsx(styles.root, piece.isArchived && styles.archived, isFull && styles.done)}
        style={style}
        role="button"
        tabIndex={0}
        aria-pressed={isFull}
        aria-label={`${piece.name}${isFull ? ', готово' : ', отметить готовым'}`}
        onClick={() => onChangeCount(isFull ? 0 : 1)}
        onKeyDown={handleKeyDown}
      >
        <TypeInsulationIcon className={styles.icon} aria-hidden="true" />
        {body}
        {isFull ? <CheckIcon className={styles.doneIcon} aria-hidden="true" /> : null}
      </article>
    )
  }

  // quantity > 1 — степпер. <article> больше не role="button" (нельзя
  // вкладывать <button> в элемент с role="button"): основная область — свой
  // <button> ("increment"), кнопка "−" — соседний элемент, не вложенный.
  return (
    <article
      className={clsx(
        styles.root,
        styles.withStepper,
        piece.isArchived && styles.archived,
        isFull && styles.done,
        isPartial && styles.partial,
      )}
      style={style}
    >
      <button
        type="button"
        className={styles.increment}
        aria-label={`${piece.name}: ${doneCount} из ${piece.quantity}${isFull ? ', готово' : ''}`}
        onClick={() => onChangeCount(isFull ? 0 : doneCount + 1)}
      >
        <TypeInsulationIcon className={styles.icon} aria-hidden="true" />
        {body}
      </button>
      <div className={styles.stepperControls}>
        <span className={styles.progress}>
          {doneCount} / {piece.quantity}
        </span>
        <IconButton
          icon={MinusIcon}
          label="Убрать одну штуку"
          aria-disabled={doneCount === 0}
          onClick={() => onChangeCount(Math.max(0, doneCount - 1))}
        />
      </div>
      {isFull ? <CheckIcon className={styles.doneIcon} aria-hidden="true" /> : null}
    </article>
  )
}
```

- [ ] **Step 9: Add stepper styles**

Append to `InsulationPieceCard.module.scss`:

```scss
.withStepper {
  flex-direction: column;
  cursor: default;
}

.increment {
  display: flex;
  align-items: flex-start;
  width: 100%;
  gap: $space-3;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;

  @include tap-feedback;

  &:focus-visible {
    @include focus-ring;
  }
}

.stepperControls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-2;
  padding-left: calc(20px + #{$space-3});
}

.progress {
  font-size: 0.8125rem;
  font-weight: 600;
  color: $color-text;

  @include tabular-nums;
}

// Частичный прогресс (0 < doneCount < quantity) — заметнее базовой подложки
// куска, но не cyan (cyan зарезервирован под .done, CLAUDE.md → "Дизайн-
// направление"). Статус несёт бейдж N/M в .progress, не отдельная иконка.
.partial {
  background: color-mix(in srgb, var(--accent) 16%, $color-bg);
}
```

`padding-left: calc(20px + #{$space-3})` aligns `.stepperControls` under `.body` (past the 20px `.icon` width + its `$space-3` gap) so the progress badge and minus button sit under the title, not under the icon.

- [ ] **Step 10: Update `InsulationGroupItem.tsx`**

Replace the import:

```ts
import { isGroupDone } from '@/features/insulation-progress'
```

with:

```ts
import { isGroupFullyDone } from '@/features/insulation-progress'
```

Replace the props interface and destructure:

```ts
interface InsulationGroupItemProps {
  group: InsulationGroupWithQuantity
  detailed: boolean
  isPieceDone: (groupPieceId: string) => boolean
  onTogglePiece: (groupPieceId: string) => void
  pendingGroupIds: ReadonlySet<string>
  onSetGroupDone: (groupId: string, groupPieceIds: string[], done: boolean) => void
}

export const InsulationGroupItem = ({
  group,
  detailed,
  isPieceDone,
  onTogglePiece,
  pendingGroupIds,
  onSetGroupDone,
}: InsulationGroupItemProps) => {
```

with:

```ts
interface InsulationGroupItemProps {
  group: InsulationGroupWithQuantity
  detailed: boolean
  getPieceDoneCount: (groupPieceId: string, quantity: number) => number
  onSetPieceCount: (groupPieceId: string, count: number) => void
  pendingGroupIds: ReadonlySet<string>
  onSetGroupDone: (groupId: string, pieces: { linkId: string; quantity: number }[], done: boolean) => void
}

export const InsulationGroupItem = ({
  group,
  detailed,
  getPieceDoneCount,
  onSetPieceCount,
  pendingGroupIds,
  onSetGroupDone,
}: InsulationGroupItemProps) => {
```

Replace `allDone`/`hasAnyDone` and the bulk handlers:

```ts
  const allDone = isGroupDone(
    pieces.map((piece) => piece.linkId),
    isPieceDone,
  )
  const hasAnyDone = pieces.some((piece) => isPieceDone(piece.linkId))
```

```ts
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
```

with:

```ts
  const allDone = isGroupFullyDone(pieces, getPieceDoneCount)
  const hasAnyDone = pieces.some((piece) => getPieceDoneCount(piece.linkId, piece.quantity) > 0)
```

```ts
  const handleMarkAll = () => {
    if (allDone || isPending) return
    setPressedAction('markAll')
    onSetGroupDone(group.linkId, pieces, true)
  }

  const handleUnmark = () => {
    if (!hasAnyDone || isPending) return
    setPressedAction('unmark')
    onSetGroupDone(group.linkId, pieces, false)
  }
```

(`pieces` here is `InsulationPieceWithQuantity[]`, which already has `linkId`/`quantity` — passing it straight to `onSetGroupDone`/`isGroupFullyDone` works because TypeScript structurally allows extra properties on a non-literal value. No `.map()` needed.)

Replace the `InsulationPieceCard` call:

```tsx
              <InsulationPieceCard
                key={piece.linkId}
                piece={piece}
                isDone={isPieceDone(piece.linkId)}
                onToggle={() => onTogglePiece(piece.linkId)}
                detailed={detailed}
              />
```

with:

```tsx
              <InsulationPieceCard
                key={piece.linkId}
                piece={piece}
                doneCount={getPieceDoneCount(piece.linkId, piece.quantity)}
                onChangeCount={(next) => onSetPieceCount(piece.linkId, next)}
                detailed={detailed}
              />
```

- [ ] **Step 11: Update `InsulationThicknessList.tsx`**

Replace the props interface and destructure:

```tsx
interface InsulationThicknessListProps {
  groups: InsulationGroupWithQuantity[]
  detailed: boolean
  isPieceDone: (groupPieceId: string) => boolean
  onTogglePiece: (groupPieceId: string) => void
}
```

```tsx
export const InsulationThicknessList = ({
  groups,
  detailed,
  isPieceDone,
  onTogglePiece,
}: InsulationThicknessListProps) => {
```

with:

```tsx
interface InsulationThicknessListProps {
  groups: InsulationGroupWithQuantity[]
  detailed: boolean
  getPieceDoneCount: (groupPieceId: string, quantity: number) => number
  onSetPieceCount: (groupPieceId: string, count: number) => void
}
```

```tsx
export const InsulationThicknessList = ({
  groups,
  detailed,
  getPieceDoneCount,
  onSetPieceCount,
}: InsulationThicknessListProps) => {
```

Replace the `InsulationPieceCard` call:

```tsx
              <InsulationPieceCard
                key={piece.linkId}
                piece={piece}
                isDone={isPieceDone(piece.linkId)}
                onToggle={() => onTogglePiece(piece.linkId)}
                detailed={detailed}
                groupLabel={groupNameById.get(piece.groupId)}
              />
```

with:

```tsx
              <InsulationPieceCard
                key={piece.linkId}
                piece={piece}
                doneCount={getPieceDoneCount(piece.linkId, piece.quantity)}
                onChangeCount={(next) => onSetPieceCount(piece.linkId, next)}
                detailed={detailed}
                groupLabel={groupNameById.get(piece.groupId)}
              />
```

- [ ] **Step 12: Update `InsulationGroupList.tsx`**

Replace the props interface and destructure:

```tsx
interface InsulationGroupListProps {
  groups: InsulationGroupWithQuantity[]
  isLoading: boolean
  isPieceDone: (groupPieceId: string) => boolean
  onTogglePiece: (groupPieceId: string) => void
  pendingGroupIds: ReadonlySet<string>
  onSetGroupDone: (groupId: string, groupPieceIds: string[], done: boolean) => void
}
```

```tsx
export const InsulationGroupList = ({
  groups,
  isLoading,
  isPieceDone,
  onTogglePiece,
  pendingGroupIds,
  onSetGroupDone,
}: InsulationGroupListProps) => {
```

with:

```tsx
interface InsulationGroupListProps {
  groups: InsulationGroupWithQuantity[]
  isLoading: boolean
  getPieceDoneCount: (groupPieceId: string, quantity: number) => number
  onSetPieceCount: (groupPieceId: string, count: number) => void
  pendingGroupIds: ReadonlySet<string>
  onSetGroupDone: (groupId: string, pieces: { linkId: string; quantity: number }[], done: boolean) => void
}
```

```tsx
export const InsulationGroupList = ({
  groups,
  isLoading,
  getPieceDoneCount,
  onSetPieceCount,
  pendingGroupIds,
  onSetGroupDone,
}: InsulationGroupListProps) => {
```

Replace both prop-forwarding call sites:

```tsx
            <InsulationGroupItem
              key={group.linkId}
              group={group}
              detailed={detailed}
              isPieceDone={isPieceDone}
              onTogglePiece={onTogglePiece}
              pendingGroupIds={pendingGroupIds}
              onSetGroupDone={onSetGroupDone}
            />
```

with:

```tsx
            <InsulationGroupItem
              key={group.linkId}
              group={group}
              detailed={detailed}
              getPieceDoneCount={getPieceDoneCount}
              onSetPieceCount={onSetPieceCount}
              pendingGroupIds={pendingGroupIds}
              onSetGroupDone={onSetGroupDone}
            />
```

and:

```tsx
        <InsulationThicknessList
          groups={groups}
          detailed={detailed}
          isPieceDone={isPieceDone}
          onTogglePiece={onTogglePiece}
        />
```

with:

```tsx
        <InsulationThicknessList
          groups={groups}
          detailed={detailed}
          getPieceDoneCount={getPieceDoneCount}
          onSetPieceCount={onSetPieceCount}
        />
```

- [ ] **Step 13: Replace `useInsulationGlobalActions.ts`**

```ts
import { skipToken } from '@reduxjs/toolkit/query/react'
import { useGetPiecesForGroupsQuery } from '@/entities/insulation-piece'
import type { InsulationGroupWithQuantity } from '@/entities/insulation-group'
import { isGroupFullyDone } from '@/features/insulation-progress'

export const useInsulationGlobalActions = (
  groups: InsulationGroupWithQuantity[],
  getPieceDoneCount: (groupPieceId: string, quantity: number) => number,
) => {
  const groupIds = groups.map((group) => group.id)
  // currentData (не data) и isFetching (не isLoading) — иначе на смене версии
  // набора один рендер отдаёт куски СТАРОЙ версии при уже новом groupIds
  // (RTK Query отдаёт data от предыдущего arg, пока грузится новый). Клик по
  // «отметить всё готовым» в этот момент записал бы старые piece id в новую
  // сессию donePieces. currentData/isFetching гарантируют, что до появления
  // данных именно текущей версии allPieces пуст, а isLoading — true.
  const { currentData: pieces = [], isFetching } = useGetPiecesForGroupsQuery(
    groupIds.length === 0 ? skipToken : groupIds,
  )

  const allDone = isGroupFullyDone(pieces, getPieceDoneCount)
  const hasAnyDone = pieces.some((piece) => getPieceDoneCount(piece.linkId, piece.quantity) > 0)

  return { allPieces: pieces, allDone, hasAnyDone, isLoading: isFetching }
}
```

- [ ] **Step 14: Replace `InsulationGlobalActions.tsx`**

```tsx
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
  getPieceDoneCount: (groupPieceId: string, quantity: number) => number
  pendingGroupIds: ReadonlySet<string>
  onSetGroupDone: (groupId: string, pieces: { linkId: string; quantity: number }[], done: boolean) => void
}

export const InsulationGlobalActions = ({
  groups,
  isLoading,
  getPieceDoneCount,
  pendingGroupIds,
  onSetGroupDone,
}: InsulationGlobalActionsProps) => {
  const { allPieces, allDone, hasAnyDone, isLoading: piecesLoading } = useInsulationGlobalActions(
    groups,
    getPieceDoneCount,
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

  if (isLoading || piecesLoading || allPieces.length === 0) {
    return null
  }

  const handleMarkAll = () => {
    if (allDone || isPending) return
    setPressedAction('markAll')
    onSetGroupDone(ALL_GROUPS_SENTINEL, allPieces, true)
  }

  const handleUnmark = () => {
    if (!hasAnyDone || isPending) return
    if (!window.confirm('Снять готовность со всех кусков набора?')) return
    setPressedAction('unmark')
    onSetGroupDone(ALL_GROUPS_SENTINEL, allPieces, false)
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
```

- [ ] **Step 15: Update `InsulationPage.tsx`**

Replace:

```tsx
  const { isPieceDone, toggle, setGroupDone, pendingGroupIds } = useInsulationProgress({
    unitId,
    setId: selectedSetId,
    unitNo: selectedUnitNo,
  })
```

with:

```tsx
  const { getPieceDoneCount, setPieceCount, setGroupDone, pendingGroupIds } = useInsulationProgress({
    unitId,
    setId: selectedSetId,
    unitNo: selectedUnitNo,
  })
```

Replace:

```tsx
          <InsulationGroupList
            key={selectedSetId}
            groups={groups}
            isLoading={isFetching}
            isPieceDone={isPieceDone}
            onTogglePiece={toggle}
            pendingGroupIds={pendingGroupIds}
            onSetGroupDone={setGroupDone}
          />
          <InsulationGlobalActions
            groups={groups}
            isLoading={isFetching}
            isPieceDone={isPieceDone}
            pendingGroupIds={pendingGroupIds}
            onSetGroupDone={setGroupDone}
          />
```

with:

```tsx
          <InsulationGroupList
            key={selectedSetId}
            groups={groups}
            isLoading={isFetching}
            getPieceDoneCount={getPieceDoneCount}
            onSetPieceCount={setPieceCount}
            pendingGroupIds={pendingGroupIds}
            onSetGroupDone={setGroupDone}
          />
          <InsulationGlobalActions
            groups={groups}
            isLoading={isFetching}
            getPieceDoneCount={getPieceDoneCount}
            pendingGroupIds={pendingGroupIds}
            onSetGroupDone={setGroupDone}
          />
```

- [ ] **Step 16: Verify**

Run: `pnpm check`
Expected: PASS. This is the first point since Step 1 where the whole project type-checks, lints, and tests clean — every consumer now agrees on the new count-based shapes.

- [ ] **Step 17: Full manual end-to-end pass** (`pnpm pb` + `pnpm dev`, on `/insulation`)

If the local PocketBase has no seeded units/groups/pieces, create at minimum one unit → one insulation group → two pieces (one with `quantity: 1`, one with `quantity` ≥ 3) before testing — this feature is impossible to verify without real interaction.

1. Piece with `quantity: 1`: card looks and behaves exactly as before — single tap toggles done ↔ not done, cyan border + checkmark on done, no stepper visible.
2. Piece with `quantity ≥ 3`: card shows an `N / M` badge and a minus button, no checkmark yet at `N=0`.
3. Tap the card body repeatedly: badge increments `1/M`, `2/M`, ... up to `M/M`; at `M/M` the card gets the cyan `.done` border + checkmark, same visual treatment as a `quantity=1` done card.
4. Tap the now-full card once more: resets straight to `0/M`, checkmark disappears.
5. Build up a partial state (e.g. `2/5`) and check the `.partial` background tint is visible and distinct from both the default and `.done` tints.
6. Click the minus button at a partial state: count decrements by 1, doesn't affect the increment button's own click. Click minus at `0/M`: stays at `0/M` (no negative, no error).
7. Group accordion: with one piece partially done, the group's own "all done" checkmark and header state must NOT show done. Only once every piece in the group is fully done does the group show as done.
8. Group's "Отметить всё готовым" button: sets every piece in the group — including `quantity > 1` pieces — to its full count (`M/M`), not just `1/M`. "Снять готовность" clears every piece back to `0`.
9. Page-level "Весь набор изоляции" mark-all/unmark buttons (`InsulationGlobalActions`): same full-count behavior across every group in the набор, not just the one open group.
10. "По толщине" tab (`InsulationThicknessList`): a `quantity > 1` piece shown here has the same stepper behavior, and toggling it here is reflected back on the "По группам" tab for the same piece (same `linkId`).
11. Reload the page mid-progress (e.g. at `2/5`): the count is restored from the saved `cutting_sessions.donePieces` — confirms the debounced flush (500ms) actually persisted a number, not `true`.
12. Keyboard pass: for a `quantity=1` card, Tab reaches it and Enter/Space toggles it (unchanged behavior). For a `quantity>1` card, Tab reaches the increment button and the minus button as two separate stops; Enter/Space on each work as their respective clicks.

- [ ] **Step 18: Commit**

```bash
git add src/features/insulation-progress src/entities/insulation-piece/ui src/widgets/insulation-group-list src/widgets/insulation-global-actions src/pages/insulation/ui/InsulationPage.tsx
git commit -m "Switch insulation cutting progress to per-unit counts"
```
