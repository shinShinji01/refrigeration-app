# Insulation set stats block (donut + bar chart) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the overall insulation-set statistics block (donut chart of area used per group + bar chart of area used per thickness) between `InsulationGroupList` and `InsulationGlobalActions` on the insulation page, per `docs/spec.md` line 245.

**Architecture:** One new combined RTK Query endpoint (`getInsulationSetStats`) aggregates `group_pieces` server-side into `{byGroup, byThickness}` in `transformResponse`. Two new headless SVG chart primitives (`DonutChart`, `BarChart`) live in `shared/ui/charts` with no charting library. A new widget `widgets/insulation-stats` wires the query to the charts and a legend, and is mounted in `InsulationPage` between the two existing widgets.

**Tech Stack:** React 19 + TypeScript strict, Redux Toolkit Query (custom baseQuery over PocketBase SDK), SASS modules, Vitest (pure-function unit tests only — see Global Constraints).

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-08-07-insulation-stats-chart-design.md` (approved, amended, committed at `ca734a7`) — every task's requirements implicitly include it.
- No charting library — hand-rolled SVG only (`docs/decisions.md`, "Графики").
- No `any`; unknown types narrow via `unknown`. Branded id types (`InsulationGroupId`, etc.) are not interchanged with plain `string`.
- All colors/spacing/radii through SCSS tokens (`_tokens.scss`) — no hardcoded hex. Donut/bar chart segments use `$color-graphite-300` for the inactive state and `$color-accent-cyan` for the active one only — no new categorical palette (per spec amendment).
- No RTK Query hook tests or RTL component tests in this increment — this codebase has no MSW/RTL test harness set up yet (verified: zero existing `renderHook`/`setupServer`/component render tests anywhere in `src`). Only pure functions get unit tests; everything else is verified manually via `pnpm dev` in the final task.
- `pnpm check` (typecheck + lint + test) must pass before every commit that the plan marks as a commit step.
- Commit messages: English, imperative mood (per current session convention — overrides `CLAUDE.md`'s "Russian commit messages" rule).
- Public API of every slice goes through its `index.ts` — no deep imports across slice boundaries.

---

### Task 1: `summarizeByGroup` — per-group area aggregation

**Files:**
- Create: `src/entities/insulation-piece/lib/summarizeByGroup.ts`
- Create: `src/entities/insulation-piece/lib/summarizeByGroup.test.ts`

**Interfaces:**
- Consumes: `InsulationGroupId` from `@/entities/insulation-group` (already used elsewhere in this slice's `api/insulationPieceApi.ts`).
- Produces: `summarizeByGroup(pieces: GroupPieceArea[]): GroupAreaSummary[]`, and the two exported interfaces `GroupPieceArea { groupId: InsulationGroupId; areaMm2: number; quantity: number }` and `GroupAreaSummary { groupId: InsulationGroupId; areaM2: number }`. Task 2 imports both the function and `GroupAreaSummary` from this file.

- [ ] **Step 1: Write the failing test**

```ts
// src/entities/insulation-piece/lib/summarizeByGroup.test.ts
import { describe, expect, it } from 'vitest'
import { summarizeByGroup } from './summarizeByGroup'
import type { InsulationGroupId } from '@/entities/insulation-group'

const GROUP_A = 'group-a' as InsulationGroupId
const GROUP_B = 'group-b' as InsulationGroupId

describe('summarizeByGroup', () => {
  it('суммирует площадь с учётом количества и переводит в м²', () => {
    // 1 000 000 мм² × 2 = 2 000 000 мм² = 2 м²
    const result = summarizeByGroup([{ groupId: GROUP_A, areaMm2: 1_000_000, quantity: 2 }])
    expect(result).toEqual([{ groupId: GROUP_A, areaM2: 2 }])
  })

  it('группирует по группе, куски разных групп не смешиваются', () => {
    const result = summarizeByGroup([
      { groupId: GROUP_A, areaMm2: 500_000, quantity: 1 },
      { groupId: GROUP_B, areaMm2: 500_000, quantity: 1 },
      { groupId: GROUP_A, areaMm2: 500_000, quantity: 1 },
    ])
    expect(result).toEqual([
      { groupId: GROUP_A, areaM2: 1 },
      { groupId: GROUP_B, areaM2: 0.5 },
    ])
  })

  it('пустой список — пустой результат', () => {
    expect(summarizeByGroup([])).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/entities/insulation-piece/lib/summarizeByGroup.test.ts`
Expected: FAIL — `Cannot find module './summarizeByGroup'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/entities/insulation-piece/lib/summarizeByGroup.ts
import type { InsulationGroupId } from '@/entities/insulation-group'

export interface GroupPieceArea {
  groupId: InsulationGroupId
  areaMm2: number
  quantity: number
}

export interface GroupAreaSummary {
  groupId: InsulationGroupId
  areaM2: number
}

const MM2_PER_M2 = 1_000_000

// Общая статистика набора по группам (docs/spec.md → "какая группа
// использовала наиболее большую площадь") — площадь с учётом количества
// каждого куска, без фильтрации по готовности (весь состав набора).
export const summarizeByGroup = (pieces: GroupPieceArea[]): GroupAreaSummary[] => {
  const totalsByGroup = new Map<InsulationGroupId, number>()

  for (const piece of pieces) {
    const totalAreaMm2 = piece.areaMm2 * piece.quantity
    totalsByGroup.set(piece.groupId, (totalsByGroup.get(piece.groupId) ?? 0) + totalAreaMm2)
  }

  return [...totalsByGroup.entries()].map(([groupId, areaMm2]) => ({
    groupId,
    areaM2: areaMm2 / MM2_PER_M2,
  }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/entities/insulation-piece/lib/summarizeByGroup.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/entities/insulation-piece/lib/summarizeByGroup.ts src/entities/insulation-piece/lib/summarizeByGroup.test.ts
git commit -m "Add summarizeByGroup for per-group insulation area totals"
```

---

### Task 2: `getInsulationSetStats` endpoint + public exports

**Files:**
- Modify: `src/entities/insulation-piece/api/insulationPieceApi.ts`
- Modify: `src/entities/insulation-piece/index.ts`

**Interfaces:**
- Consumes: `summarizeByGroup`, `GroupAreaSummary` from Task 1 (`../lib/summarizeByGroup`); existing `summarizeByThickness`, `ThicknessSummary` from `../lib/summarizeByThickness`; existing `GroupPieceRecord`, `toPiecesWithQuantity` (already defined in this file); `pb` from `@/shared/api`.
- Produces: `useGetInsulationSetStatsQuery(groupIds: InsulationGroupId[])` and type `InsulationSetStats { byGroup: GroupAreaSummary[]; byThickness: ThicknessSummary[] }`, both re-exported from `@/entities/insulation-piece`. Task 3/7 (widget hook) import `useGetInsulationSetStatsQuery` and `InsulationSetStats` from `@/entities/insulation-piece`.

No test infrastructure exists for RTK Query hooks in this codebase (see Global Constraints) — this task is verified by typecheck, not a hook test.

- [ ] **Step 1: Add the endpoint**

In `src/entities/insulation-piece/api/insulationPieceApi.ts`, add imports at the top (alongside the existing ones):

```ts
import { summarizeByGroup } from '../lib/summarizeByGroup'
import type { GroupAreaSummary } from '../lib/summarizeByGroup'
import { summarizeByThickness } from '../lib/summarizeByThickness'
import type { ThicknessSummary } from '../lib/summarizeByThickness'
```

Add this interface above `insulationPieceApi`:

```ts
export interface InsulationSetStats {
  byGroup: GroupAreaSummary[]
  byThickness: ThicknessSummary[]
}
```

Add a new endpoint inside `insulationPieceApi.injectEndpoints({ endpoints: (builder) => ({ ... }) })`, after `getPiecesForGroups`:

```ts
// Общая статистика набора (docs/spec.md → "Под списком групп отображаем
// общую статистику..."): площадь по группам и по толщине, по всему
// составу набора (не только готовые куски) — один запрос вместо двух,
// т.к. оба среза нужны для одного и того же блока на странице.
getInsulationSetStats: builder.query<InsulationSetStats, InsulationGroupId[]>({
  query: (groupIds) => ({
    collection: 'group_pieces',
    method: 'getFullList',
    params: {
      filter: groupIds.map((groupId) => pb.filter('group = {:groupId}', { groupId })).join(' || '),
      expand: 'piece',
    },
  }),
  transformResponse: (records: GroupPieceRecord[]): InsulationSetStats => {
    const withPiece = records.filter((record) => record.expand?.piece)
    return {
      byGroup: summarizeByGroup(
        withPiece.map((record) => ({
          groupId: record.group as InsulationGroupId,
          areaMm2: record.expand!.piece.areaMm2,
          quantity: record.quantity,
        })),
      ),
      byThickness: summarizeByThickness(toPiecesWithQuantity(records)),
    }
  },
  providesTags: (_result, _error, groupIds) =>
    groupIds.map((groupId) => ({ type: 'InsulationPiece' as const, id: `GROUP_${groupId}` })),
}),
```

Update the final export line:

```ts
export const { useGetPiecesForGroupQuery, useGetPiecesForGroupsQuery, useGetInsulationSetStatsQuery } =
  insulationPieceApi
```

- [ ] **Step 2: Re-export from the slice's public API**

In `src/entities/insulation-piece/index.ts`, add:

```ts
export { useGetInsulationSetStatsQuery } from './api/insulationPieceApi'
export type { InsulationSetStats } from './api/insulationPieceApi'
export { summarizeByGroup } from './lib/summarizeByGroup'
export type { GroupAreaSummary } from './lib/summarizeByGroup'
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/entities/insulation-piece/api/insulationPieceApi.ts src/entities/insulation-piece/index.ts
git commit -m "Add getInsulationSetStats bulk endpoint for insulation-piece"
```

---

### Task 3: `computeDonutGeometry` — donut segment arc math

**Files:**
- Create: `src/shared/ui/charts/lib/donutGeometry.ts`
- Create: `src/shared/ui/charts/lib/donutGeometry.test.ts`

**Interfaces:**
- Consumes: nothing outside this file (pure, no domain types).
- Produces: `computeDonutGeometry(segments: DonutGeometryInput[], circumference: number): DonutSegmentGeometry[]`, `DonutGeometryInput { id: string; value: number }`, `DonutSegmentGeometry { id: string; dasharray: string; dashoffset: number }`. Task 4 (`DonutChart.tsx`) imports all three.

- [ ] **Step 1: Write the failing test**

```ts
// src/shared/ui/charts/lib/donutGeometry.test.ts
import { describe, expect, it } from 'vitest'
import { computeDonutGeometry } from './donutGeometry'

describe('computeDonutGeometry', () => {
  it('делит окружность пропорционально значениям, с зазором между сегментами', () => {
    const result = computeDonutGeometry(
      [
        { id: 'a', value: 1 },
        { id: 'b', value: 1 },
        { id: 'c', value: 2 },
      ],
      400,
    )
    expect(result).toEqual([
      { id: 'a', dasharray: '97 303', dashoffset: 0 },
      { id: 'b', dasharray: '97 303', dashoffset: -100 },
      { id: 'c', dasharray: '197 203', dashoffset: -200 },
    ])
  })

  it('единственный сегмент — без зазора, занимает всю окружность', () => {
    const result = computeDonutGeometry([{ id: 'a', value: 5 }], 400)
    expect(result).toEqual([{ id: 'a', dasharray: '400 0', dashoffset: 0 }])
  })

  it('пустой список — пустой результат', () => {
    expect(computeDonutGeometry([], 400)).toEqual([])
  })

  it('нулевая сумма значений — пустой результат, без деления на ноль', () => {
    expect(computeDonutGeometry([{ id: 'a', value: 0 }], 400)).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/shared/ui/charts/lib/donutGeometry.test.ts`
Expected: FAIL — `Cannot find module './donutGeometry'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/shared/ui/charts/lib/donutGeometry.ts
export interface DonutGeometryInput {
  id: string
  value: number
}

export interface DonutSegmentGeometry {
  id: string
  dasharray: string
  dashoffset: number
}

const SEGMENT_GAP_PX = 3

// SVG donut без построения path-дуг: каждый сегмент — тот же <circle>,
// у которого stroke-dasharray показывает только его долю окружности,
// а stroke-dashoffset сдвигает начало этой доли на сумму предыдущих.
export const computeDonutGeometry = (
  segments: DonutGeometryInput[],
  circumference: number,
): DonutSegmentGeometry[] => {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  if (total <= 0) return []

  const hasGap = segments.length > 1
  let cumulative = 0

  return segments.map((segment) => {
    const rawLength = (segment.value / total) * circumference
    const length = Math.max(rawLength - (hasGap ? SEGMENT_GAP_PX : 0), 0)
    const dashoffset = cumulative === 0 ? 0 : -cumulative
    cumulative += rawLength
    return { id: segment.id, dasharray: `${length} ${circumference - length}`, dashoffset }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/shared/ui/charts/lib/donutGeometry.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/shared/ui/charts/lib/donutGeometry.ts src/shared/ui/charts/lib/donutGeometry.test.ts
git commit -m "Add computeDonutGeometry for hand-rolled SVG donut charts"
```

---

### Task 4: `DonutChart` component

**Files:**
- Create: `src/shared/ui/charts/DonutChart.tsx`
- Create: `src/shared/ui/charts/DonutChart.module.scss`
- Create: `src/shared/ui/charts/index.ts`
- Modify: `src/shared/ui/index.ts`

**Interfaces:**
- Consumes: `computeDonutGeometry`, `DonutGeometryInput`, `DonutSegmentGeometry` from Task 3 (`./lib/donutGeometry`); `clsx` (already a project dependency, used in `IconButton.tsx`).
- Produces: `DonutChart` component and `DonutSegment { id: string; label: string; value: number }` type, re-exported from `@/shared/ui`. Task 8 (`InsulationStats.tsx`) imports `DonutChart, DonutSegment` from `@/shared/ui`.

No RTL test infra (Global Constraints) — verified by typecheck + manual check in Task 10.

- [ ] **Step 1: Write the component**

```tsx
// src/shared/ui/charts/DonutChart.tsx
import { useId } from 'react'
import clsx from 'clsx'
import { computeDonutGeometry } from './lib/donutGeometry'
import styles from './DonutChart.module.scss'

export interface DonutSegment {
  id: string
  label: string
  value: number
}

interface DonutChartProps {
  segments: DonutSegment[]
  activeId: string | null
  onSegmentActivate: (id: string | null) => void
  valueFormatter?: (value: number) => string
}

const SIZE = 200
const STROKE_WIDTH = 28
const RADIUS = (SIZE - STROKE_WIDTH) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export const DonutChart = ({
  segments,
  activeId,
  onSegmentActivate,
  valueFormatter = String,
}: DonutChartProps) => {
  const titleId = useId()
  const geometry = computeDonutGeometry(segments, CIRCUMFERENCE)

  const toggle = (id: string) => {
    onSegmentActivate(id === activeId ? null : id)
  }

  return (
    <svg className={styles.root} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-labelledby={titleId}>
      <title id={titleId}>Диаграмма распределения площади</title>
      <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
        {segments.map((segment, index) => (
          <circle
            key={segment.id}
            className={clsx(styles.segment, segment.id === activeId && styles.segmentActive)}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE_WIDTH}
            strokeDasharray={geometry[index].dasharray}
            strokeDashoffset={geometry[index].dashoffset}
            tabIndex={0}
            role="button"
            aria-label={`${segment.label}: ${valueFormatter(segment.value)}`}
            aria-pressed={segment.id === activeId}
            onClick={() => toggle(segment.id)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              toggle(segment.id)
            }}
          />
        ))}
      </g>
    </svg>
  )
}
```

- [ ] **Step 2: Write the styles**

```scss
// src/shared/ui/charts/DonutChart.module.scss
.root {
  display: block;
  width: 100%;
  max-width: 220px;
  margin: 0 auto;
}

.segment {
  stroke: $color-graphite-300;
  cursor: pointer;
  transition: stroke $duration-fast $easing-standard;

  &:focus-visible {
    @include focus-ring;
  }
}

.segmentActive {
  stroke: $color-accent-cyan;
}

@include reduced-motion {
  .segment {
    transition: none;
  }
}
```

- [ ] **Step 3: Export from the charts barrel and shared/ui**

```ts
// src/shared/ui/charts/index.ts
export { DonutChart } from './DonutChart'
export type { DonutSegment } from './DonutChart'
```

Add to `src/shared/ui/index.ts`:

```ts
export { DonutChart } from './charts'
export type { DonutSegment } from './charts'
```

- [ ] **Step 4: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/shared/ui/charts/DonutChart.tsx src/shared/ui/charts/DonutChart.module.scss src/shared/ui/charts/index.ts src/shared/ui/index.ts
git commit -m "Add headless DonutChart SVG primitive"
```

---

### Task 5: `BarChart` component

**Files:**
- Create: `src/shared/ui/charts/BarChart.tsx`
- Create: `src/shared/ui/charts/BarChart.module.scss`
- Modify: `src/shared/ui/charts/index.ts`
- Modify: `src/shared/ui/index.ts`

**Interfaces:**
- Consumes: `clsx`.
- Produces: `BarChart` component and `Bar { id: string; label: string; value: number }` type, re-exported from `@/shared/ui`. Task 8 (`InsulationStats.tsx`) imports `BarChart, Bar` from `@/shared/ui`.

- [ ] **Step 1: Write the component**

```tsx
// src/shared/ui/charts/BarChart.tsx
import clsx from 'clsx'
import styles from './BarChart.module.scss'

export interface Bar {
  id: string
  label: string
  value: number
}

interface BarChartProps {
  bars: Bar[]
  activeId: string | null
  onBarActivate: (id: string | null) => void
  valueFormatter?: (value: number) => string
}

const HEIGHT = 160
const BAR_WIDTH = 32
const BAR_GAP = 16
const AXIS_TICKS = 4

export const BarChart = ({ bars, activeId, onBarActivate, valueFormatter = String }: BarChartProps) => {
  const maxValue = Math.max(...bars.map((bar) => bar.value), 0)
  const width = bars.length * (BAR_WIDTH + BAR_GAP) + BAR_GAP

  const toggle = (id: string) => {
    onBarActivate(id === activeId ? null : id)
  }

  return (
    <div className={styles.root}>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        role="img"
        aria-label="Диаграмма распределения по толщине"
      >
        {Array.from({ length: AXIS_TICKS + 1 }, (_, tick) => {
          const y = HEIGHT - (tick / AXIS_TICKS) * HEIGHT
          return <line key={tick} className={styles.axisLine} x1={0} x2={width} y1={y} y2={y} />
        })}
        {bars.map((bar, index) => {
          const barHeight = maxValue > 0 ? (bar.value / maxValue) * HEIGHT : 0
          const x = BAR_GAP + index * (BAR_WIDTH + BAR_GAP)
          return (
            <g key={bar.id}>
              <rect
                className={clsx(styles.bar, bar.id === activeId && styles.barActive)}
                x={x}
                y={HEIGHT - barHeight}
                width={BAR_WIDTH}
                height={barHeight}
                tabIndex={0}
                role="button"
                aria-label={`${bar.label}: ${valueFormatter(bar.value)}`}
                aria-pressed={bar.id === activeId}
                onClick={() => toggle(bar.id)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  toggle(bar.id)
                }}
              />
              <text className={styles.value} x={x + BAR_WIDTH / 2} y={Math.max(HEIGHT - barHeight - 6, 10)} textAnchor="middle">
                {valueFormatter(bar.value)}
              </text>
            </g>
          )
        })}
      </svg>
      <div className={styles.labels} style={{ gridTemplateColumns: `repeat(${bars.length}, 1fr)` }}>
        {bars.map((bar) => (
          <span key={bar.id} className={styles.label}>
            {bar.label}
          </span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write the styles**

```scss
// src/shared/ui/charts/BarChart.module.scss
.root {
  display: flex;
  flex-direction: column;
  gap: $space-2;
}

.chart {
  display: block;
  width: 100%;
  height: 160px;
}

.axisLine {
  stroke: $color-border;
  stroke-width: 1;
}

.bar {
  fill: $color-graphite-300;
  cursor: pointer;
  transition: fill $duration-fast $easing-standard;

  &:focus-visible {
    @include focus-ring;
  }
}

.barActive {
  fill: $color-accent-cyan;
}

.value {
  fill: $color-text;
  font-size: 10px;

  @include tabular-nums;
}

.labels {
  display: grid;
  gap: $space-1;
  color: $color-text-muted;
  font-size: 0.75rem;
  text-align: center;

  @include tabular-nums;
}

@include reduced-motion {
  .bar {
    transition: none;
  }
}
```

- [ ] **Step 3: Export from the charts barrel and shared/ui**

Add to `src/shared/ui/charts/index.ts`:

```ts
export { BarChart } from './BarChart'
export type { Bar } from './BarChart'
```

Add to `src/shared/ui/index.ts`:

```ts
export { BarChart } from './charts'
export type { Bar } from './charts'
```

- [ ] **Step 4: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/shared/ui/charts/BarChart.tsx src/shared/ui/charts/BarChart.module.scss src/shared/ui/charts/index.ts src/shared/ui/index.ts
git commit -m "Add headless BarChart SVG primitive"
```

---

### Task 6: `useInsulationStats` hook

**Files:**
- Create: `src/widgets/insulation-stats/model/useInsulationStats.ts`

**Interfaces:**
- Consumes: `useGetInsulationSetStatsQuery` from `@/entities/insulation-piece` (Task 2); `InsulationGroupWithQuantity` from `@/entities/insulation-group`; `skipToken` from `@reduxjs/toolkit/query/react`.
- Produces: `useInsulationStats(groups: InsulationGroupWithQuantity[]): { byGroup: GroupAreaEntry[]; byThickness: ThicknessSummary[]; totalAreaM2: number; isLoading: boolean }` and `GroupAreaEntry { id: string; label: string; areaM2: number }`. Task 7 (`InsulationStats.tsx`) imports `useInsulationStats` from `../model/useInsulationStats`.

No test infra for hooks (Global Constraints) — verified by typecheck, and end-to-end in Task 10.

- [ ] **Step 1: Write the hook**

```ts
// src/widgets/insulation-stats/model/useInsulationStats.ts
import { skipToken } from '@reduxjs/toolkit/query/react'
import { useGetInsulationSetStatsQuery } from '@/entities/insulation-piece'
import type { InsulationGroupWithQuantity } from '@/entities/insulation-group'

export interface GroupAreaEntry {
  id: string
  label: string
  areaM2: number
}

export const useInsulationStats = (groups: InsulationGroupWithQuantity[]) => {
  const groupIds = groups.map((group) => group.id)
  // currentData (не data) и isFetching (не isLoading) — тот же паттерн
  // защиты от гонки версий набора, что и в InsulationPage/
  // useInsulationGlobalActions: иначе на смене версии currentData
  // какое-то время отдаёт статистику СТАРОЙ версии при уже новых groupIds.
  const { currentData, isFetching } = useGetInsulationSetStatsQuery(
    groupIds.length === 0 ? skipToken : groupIds,
  )

  const byGroup: GroupAreaEntry[] = (currentData?.byGroup ?? [])
    .map((entry) => ({
      id: entry.groupId,
      label: groups.find((group) => group.id === entry.groupId)?.name ?? '—',
      areaM2: entry.areaM2,
    }))
    .sort((a, b) => b.areaM2 - a.areaM2)

  const byThickness = currentData?.byThickness ?? []
  const totalAreaM2 = byGroup.reduce((sum, entry) => sum + entry.areaM2, 0)

  return { byGroup, byThickness, totalAreaM2, isLoading: isFetching }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/widgets/insulation-stats/model/useInsulationStats.ts
git commit -m "Add useInsulationStats hook aggregating set-level chart data"
```

---

### Task 7: `InsulationStats` component + widget public API

**Files:**
- Create: `src/widgets/insulation-stats/ui/InsulationStats.tsx`
- Create: `src/widgets/insulation-stats/ui/InsulationStats.module.scss`
- Create: `src/widgets/insulation-stats/index.ts`

**Interfaces:**
- Consumes: `useInsulationStats` from Task 6 (`../model/useInsulationStats`); `DonutChart`, `DonutSegment`, `BarChart`, `Bar`, `EmptyState` from `@/shared/ui`; `InsulationGroupWithQuantity` from `@/entities/insulation-group`.
- Produces: `InsulationStats` component, re-exported from `@/widgets/insulation-stats`. Task 8 (`InsulationPage.tsx`) imports it from there.

- [ ] **Step 1: Write the component**

```tsx
// src/widgets/insulation-stats/ui/InsulationStats.tsx
import { useState } from 'react'
import { BarChart, DonutChart, EmptyState } from '@/shared/ui'
import type { InsulationGroupWithQuantity } from '@/entities/insulation-group'
import { useInsulationStats } from '../model/useInsulationStats'
import styles from './InsulationStats.module.scss'

interface InsulationStatsProps {
  groups: InsulationGroupWithQuantity[]
  isLoading: boolean
}

// Фиксированные 3 знака в м² — тот же формат, что уже использует подвал
// группы (InsulationGroupItem, summarizeByThickness), а не адаптивный
// shared/lib/utils/formatArea (тот подбирает см²/м² под площадь ОДНОГО
// куска и явно не предназначен для площади группы/набора — см. его
// комментарий).
const formatAreaM2 = (value: number) => `${value.toFixed(3)} м²`

export const InsulationStats = ({ groups, isLoading }: InsulationStatsProps) => {
  const { byGroup, byThickness, totalAreaM2, isLoading: statsLoading } = useInsulationStats(groups)
  const [donutActiveId, setDonutActiveId] = useState<string | null>(null)
  const [barActiveId, setBarActiveId] = useState<string | null>(null)

  if (isLoading || statsLoading) {
    return null
  }

  if (totalAreaM2 === 0) {
    return <EmptyState message="Нет данных для статистики" />
  }

  return (
    <div className={styles.root}>
      <DonutChart
        segments={byGroup.map((entry) => ({ id: entry.id, label: entry.label, value: entry.areaM2 }))}
        activeId={donutActiveId}
        onSegmentActivate={setDonutActiveId}
        valueFormatter={formatAreaM2}
      />
      <ul className={styles.legend}>
        {byGroup.map((entry, index) => (
          <li key={entry.id}>
            <button
              type="button"
              className={styles.legendRow}
              aria-current={entry.id === donutActiveId}
              onClick={() => setDonutActiveId(entry.id === donutActiveId ? null : entry.id)}
            >
              <span className={styles.legendIndex}>{index + 1}</span>
              <span className={styles.legendName}>{entry.label}</span>
              <span className={styles.legendValue}>{formatAreaM2(entry.areaM2)}</span>
              <span className={styles.legendPercent}>{Math.round((entry.areaM2 / totalAreaM2) * 100)}%</span>
            </button>
          </li>
        ))}
      </ul>
      <BarChart
        bars={byThickness.map((entry) => ({
          id: String(entry.thicknessMm),
          label: `${entry.thicknessMm} мм`,
          value: entry.areaM2,
        }))}
        activeId={barActiveId}
        onBarActivate={setBarActiveId}
        valueFormatter={formatAreaM2}
      />
    </div>
  )
}
```

- [ ] **Step 2: Write the styles**

```scss
// src/widgets/insulation-stats/ui/InsulationStats.module.scss
.root {
  @include card-surface;

  display: flex;
  flex-direction: column;
  gap: $space-4;
  padding: $space-4;
}

.legend {
  display: flex;
  flex-direction: column;
  gap: $space-1;
  margin: 0;
  padding: 0;
  list-style: none;
}

.legendRow {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  width: 100%;
  gap: $space-2;
  padding: $space-2;

  @include touch-target;
  @include tap-feedback;

  border: none;
  border-radius: $radius-sm;
  background: none;
  color: $color-text;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: $color-accent-cyan-muted;
  }

  &:focus-visible {
    @include focus-ring;
  }

  &[aria-current='true'] {
    background: $color-accent-cyan-muted;
    color: $color-accent-cyan;
  }
}

.legendIndex {
  color: $color-text-muted;
  font-size: 0.75rem;

  @include tabular-nums;
}

.legendName {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.legendValue,
.legendPercent {
  color: $color-text-muted;
  font-size: 0.8125rem;

  @include tabular-nums;
}
```

- [ ] **Step 3: Export from the widget's public API**

```ts
// src/widgets/insulation-stats/index.ts
export { InsulationStats } from './ui/InsulationStats'
```

- [ ] **Step 4: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/widgets/insulation-stats/ui/InsulationStats.tsx src/widgets/insulation-stats/ui/InsulationStats.module.scss src/widgets/insulation-stats/index.ts
git commit -m "Add InsulationStats widget composing donut and bar charts"
```

---

### Task 8: Wire `InsulationStats` into `InsulationPage`

**Files:**
- Modify: `src/pages/insulation/ui/InsulationPage.tsx`

**Interfaces:**
- Consumes: `InsulationStats` from `@/widgets/insulation-stats` (Task 7).
- Produces: nothing further downstream — this is the last wiring point.

- [ ] **Step 1: Add the import and mount point**

In `src/pages/insulation/ui/InsulationPage.tsx`, add the import next to the other widget imports:

```ts
import { InsulationStats } from '@/widgets/insulation-stats'
```

Insert `<InsulationStats>` between `<InsulationGroupList>` and `<InsulationGlobalActions>`, with the same `key={selectedSetId}` reset pattern as the group list (resets `activeId` state on both charts when the set version changes):

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
<InsulationStats key={selectedSetId} groups={groups} isLoading={isFetching} />
<InsulationGlobalActions
  groups={groups}
  isLoading={isFetching}
  isPieceDone={isPieceDone}
  pendingGroupIds={pendingGroupIds}
  onSetGroupDone={setGroupDone}
/>
```

- [ ] **Step 2: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/insulation/ui/InsulationPage.tsx
git commit -m "Mount InsulationStats between group list and global actions"
```

---

### Task 9: Full verification pass

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Run the full check suite**

Run: `pnpm check`
Expected: typecheck, lint, and all unit tests (including the new `summarizeByGroup.test.ts` and `donutGeometry.test.ts`) pass.

- [ ] **Step 2: Manual verification via `pnpm dev`**

Start the dev server (`pnpm dev`), open the insulation page, select a unit/set with multiple groups of insulation pieces at multiple thicknesses, and check each item from the spec's manual checklist:

- `EmptyState` renders when the selected set has zero pieces (find or temporarily pick a set with empty groups).
- Legend values and percentages match the known per-group piece data for a test set (spot-check the math against `summarizeByGroup`/`summarizeByThickness` by hand for one group).
- Donut segments and legend rows are ordered by descending area.
- Clicking/tapping a donut segment highlights it (cyan) and highlights the same row in the legend; clicking the legend row does the same in reverse; clicking the active segment/row again clears the highlight.
- Clicking/tapping a bar in the bar chart highlights only that bar; the donut/legend highlight state is unaffected, and vice versa.
- Switching the set version (if the unit has more than one) resets both highlights and shows the new version's data without a flash of stale data.
- Keyboard: `Tab` reaches each donut segment, legend row, and bar in order; `Enter`/`Space` toggles the highlight the same way a click does; focus rings are visible.

- [ ] **Step 3: Fix anything found, re-run `pnpm check`, then stop**

No commit in this task — it's verification of the already-committed work from Tasks 1–8. If manual verification finds a bug, fix it in the relevant task's files, re-run `pnpm check`, and commit the fix separately with a message describing what was wrong (e.g. `git commit -m "Fix donut segment highlight not clearing on second click"`).
