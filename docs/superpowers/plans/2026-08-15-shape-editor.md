# Графический редактор геометрии куска изоляции (`features/shape-editor`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `features/shape-editor` — a controlled SVG form-field component that lets a user draw a piece-of-insulation contour on a precise 5mm-grid blueprint canvas, auto-classifying the result as `rect` or `polygon`.

**Architecture:** All interaction logic (state machine, grid snap, rect/polygon classification, self-intersection check, auto-fit scale) lives in pure, fully unit-tested functions under `lib/`. `ShapeEditor.tsx` is a thin wiring layer: it dispatches pointer gestures into the pure `editorReducer`, renders SVG from the resulting state, and emits `Geometry | null` via a controlled `onChange` prop. `shared/lib/geometry` gains the `computeArea`/`withComputedArea` functions already documented in `docs/data-model.md` but not yet implemented.

**Tech Stack:** React 19 + TypeScript (strict), plain SVG (no charting/canvas library, matching `docs/decisions.md`), SASS modules, Vitest + React Testing Library.

**Design doc:** `docs/superpowers/specs/2026-08-15-shape-editor-design.md` — read it before starting; this plan implements it exactly, tasks below reference its sections by name.

## Global Constraints

- No `any` — unknown types get `unknown` + narrowing (`CLAUDE.md`).
- Domain types (`Point`, `Geometry`) live in `shared/lib/geometry`, already defined — do not redefine them elsewhere.
- All colors/spacing/radii through SCSS tokens in `src/app/styles/_tokens.scss` — no hardcoded hex.
- Media queries only via `@include respond-to(...)`.
- Touch targets ≥44px (`$touch-target-min` / `@include touch-target`).
- Visible focus-ring (`@include focus-ring`) on every interactive element; `@include reduced-motion` must null out any transition used for feedback (`@include tap-feedback`, highlight flashes).
- Named exports only, one component per file.
- Component in `ui/` must not know about the form/domain — plain `value`/`onChange` props, logic lives in `lib/`.
- Files over ~120 lines get decomposed.
- `pnpm check` (typecheck + lint + test) must pass after every task before committing.

---

### Task 1: `shared/lib/geometry` — `computeArea` + `withComputedArea`

**Files:**
- Create: `src/shared/lib/geometry/computeArea.ts`
- Create: `src/shared/lib/geometry/computeArea.test.ts`
- Create: `src/shared/lib/geometry/withComputedArea.ts`
- Create: `src/shared/lib/geometry/withComputedArea.test.ts`
- Modify: `src/shared/lib/geometry/index.ts`

**Interfaces:**
- Consumes: `Point`, `Geometry` from `./types` (already exist).
- Produces: `computeArea(geometry: Geometry): number` (mm²), `withComputedArea<T extends { geometry: Geometry }>(piece: T): T & { areaMm2: number }`. Both re-exported from `@/shared/lib/geometry`. Used by `features/shape-editor` (Task 6 onward) for the live area readout.

- [ ] **Step 1: Write the failing tests**

`src/shared/lib/geometry/computeArea.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { computeArea } from './computeArea'

describe('computeArea', () => {
  it('прямоугольник: ширина × высота', () => {
    expect(computeArea({ kind: 'rect', width: 300, height: 200 })).toBe(60_000)
  })

  it('многоугольник: формула шнурков для квадрата', () => {
    const geometry = {
      kind: 'polygon' as const,
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
    }
    expect(computeArea(geometry)).toBe(10_000)
  })

  it('многоугольник: невыпуклая L-образная фигура', () => {
    const geometry = {
      kind: 'polygon' as const,
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
        { x: 50, y: 50 },
        { x: 50, y: 100 },
        { x: 0, y: 100 },
      ],
    }
    // квадрат 100×100 минус вырезанный угол 50×50
    expect(computeArea(geometry)).toBe(10_000 - 2_500)
  })

  it('вырожденный многоугольник (все точки совпадают) — площадь 0', () => {
    const geometry = {
      kind: 'polygon' as const,
      vertices: [
        { x: 5, y: 5 },
        { x: 5, y: 5 },
        { x: 5, y: 5 },
      ],
    }
    expect(computeArea(geometry)).toBe(0)
  })
})
```

`src/shared/lib/geometry/withComputedArea.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { withComputedArea } from './withComputedArea'

describe('withComputedArea', () => {
  it('пересчитывает areaMm2 из geometry и сохраняет остальные поля', () => {
    const piece = {
      id: 'piece-1',
      name: 'Кусок',
      geometry: { kind: 'rect' as const, width: 10, height: 10 },
      areaMm2: 999, // заведомо устаревшее значение
    }

    const result = withComputedArea(piece)

    expect(result.areaMm2).toBe(100)
    expect(result.id).toBe('piece-1')
    expect(result.name).toBe('Кусок')
    expect(result.geometry).toBe(piece.geometry)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/shared/lib/geometry`
Expected: FAIL — `computeArea`/`withComputedArea` modules not found.

- [ ] **Step 3: Write minimal implementation**

`src/shared/lib/geometry/computeArea.ts`:

```ts
import type { Geometry, Point } from './types'

export const computeArea = (geometry: Geometry): number => {
  if (geometry.kind === 'rect') return geometry.width * geometry.height
  return shoelaceArea(geometry.vertices)
}

// Формула шнурков: |Σ(x_i·y_{i+1} − x_{i+1}·y_i)| / 2, см. docs/data-model.md.
const shoelaceArea = (vertices: Point[]): number => {
  let sum = 0
  for (let i = 0; i < vertices.length; i++) {
    const current = vertices[i]!
    const next = vertices[(i + 1) % vertices.length]!
    sum += current.x * next.y - next.x * current.y
  }
  return Math.abs(sum) / 2
}
```

`src/shared/lib/geometry/withComputedArea.ts`:

```ts
import type { Geometry } from './types'
import { computeArea } from './computeArea'

// Единственная точка записи areaMm2 (docs/decisions.md №6) — все мутации
// куска изоляции обязаны проходить через эту функцию.
export const withComputedArea = <T extends { geometry: Geometry }>(piece: T) =>
  ({ ...piece, areaMm2: computeArea(piece.geometry) }) as T & { areaMm2: number }
```

`src/shared/lib/geometry/index.ts`:

```ts
export type { Point, Geometry } from './types'
export { computeArea } from './computeArea'
export { withComputedArea } from './withComputedArea'
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/shared/lib/geometry`
Expected: PASS, all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/geometry
git commit -m "Add computeArea and withComputedArea to shared geometry lib"
```

---

### Task 2: `features/shape-editor/lib/snapToGrid`

**Files:**
- Create: `src/features/shape-editor/lib/snapToGrid.ts`
- Create: `src/features/shape-editor/lib/snapToGrid.test.ts`

**Interfaces:**
- Consumes: `Point` from `@/shared/lib/geometry`.
- Produces: `GRID_STEP_MM = 5` (used by Task 6's reducer tests and by `ShapeEditor.tsx` for pointer coordinate snapping), `snapToGrid(point: Point): Point`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { snapToGrid, GRID_STEP_MM } from './snapToGrid'

describe('snapToGrid', () => {
  it('шаг сетки — 5мм', () => {
    expect(GRID_STEP_MM).toBe(5)
  })

  it('округляет к ближайшему узлу сетки по обеим осям', () => {
    expect(snapToGrid({ x: 12, y: 3 })).toEqual({ x: 10, y: 5 })
  })

  it('уже выровненная по сетке точка не меняется', () => {
    expect(snapToGrid({ x: 25, y: 100 })).toEqual({ x: 25, y: 100 })
  })

  it('граница ровно посередине между двумя узлами округляется вверх', () => {
    // 2.5 — ровно посередине между 0 и 5
    expect(snapToGrid({ x: 2.5, y: 7.5 })).toEqual({ x: 5, y: 10 })
  })

  it('отрицательные координаты снапаются симметрично', () => {
    expect(snapToGrid({ x: -12, y: -3 })).toEqual({ x: -10, y: -5 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/shape-editor/lib/snapToGrid`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { Point } from '@/shared/lib/geometry'

export const GRID_STEP_MM = 5

export const snapToGrid = (point: Point): Point => ({
  x: Math.round(point.x / GRID_STEP_MM) * GRID_STEP_MM,
  y: Math.round(point.y / GRID_STEP_MM) * GRID_STEP_MM,
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/shape-editor/lib/snapToGrid`
Expected: PASS, 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/shape-editor/lib/snapToGrid.ts src/features/shape-editor/lib/snapToGrid.test.ts
git commit -m "Add snapToGrid for shape-editor 5mm grid"
```

---

### Task 3: `features/shape-editor/lib/classifyContour`

**Files:**
- Create: `src/features/shape-editor/lib/classifyContour.ts`
- Create: `src/features/shape-editor/lib/classifyContour.test.ts`

**Interfaces:**
- Consumes: `Point`, `Geometry` from `@/shared/lib/geometry`.
- Produces: `classifyContour(points: Point[]): Geometry`. Used by `editorReducer` (Task 6).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { classifyContour } from './classifyContour'

describe('classifyContour', () => {
  it('4 точки, оси совпадают (по часовой) — rect', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 200 },
      { x: 0, y: 200 },
    ]
    expect(classifyContour(points)).toEqual({ kind: 'rect', width: 300, height: 200 })
  })

  it('4 точки, оси совпадают, обход против часовой и с другого угла — тоже rect', () => {
    const points = [
      { x: 300, y: 200 },
      { x: 0, y: 200 },
      { x: 0, y: 0 },
      { x: 300, y: 0 },
    ]
    expect(classifyContour(points)).toEqual({ kind: 'rect', width: 300, height: 200 })
  })

  it('4 точки, не по осям (ромб) — polygon', () => {
    const points = [
      { x: 50, y: 0 },
      { x: 100, y: 50 },
      { x: 50, y: 100 },
      { x: 0, y: 50 },
    ]
    expect(classifyContour(points)).toEqual({ kind: 'polygon', vertices: points })
  })

  it('3 точки — polygon', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 100 },
    ]
    expect(classifyContour(points)).toEqual({ kind: 'polygon', vertices: points })
  })

  it('5 точек — polygon', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 50, y: 150 },
      { x: 0, y: 100 },
    ]
    expect(classifyContour(points)).toEqual({ kind: 'polygon', vertices: points })
  })

  it('4 точки с нулевой шириной (вырожденный прямоугольник) — polygon', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 100 },
      { x: 0, y: 100 },
    ]
    expect(classifyContour(points)).toEqual({ kind: 'polygon', vertices: points })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/shape-editor/lib/classifyContour`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { Point, Geometry } from '@/shared/lib/geometry'

export const classifyContour = (points: Point[]): Geometry => {
  if (points.length === 4 && isAxisAlignedRect(points as [Point, Point, Point, Point])) {
    const xs = points.map((point) => point.x)
    const ys = points.map((point) => point.y)
    return {
      kind: 'rect',
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    }
  }
  return { kind: 'polygon', vertices: points }
}

// Порядок обхода (по/против часовой, с любого угла) не важен: контур —
// осевой прямоугольник тогда и только тогда, когда его 4 точки — это ровно
// 4 угла своего bounding box, каждый встречается один раз, и bounding box
// не вырожден в линию/точку.
const isAxisAlignedRect = (points: [Point, Point, Point, Point]): boolean => {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  if (minX === maxX || minY === maxY) return false

  const corners = [
    `${minX},${minY}`,
    `${maxX},${minY}`,
    `${maxX},${maxY}`,
    `${minX},${maxY}`,
  ]
  const pointKeys = points.map((point) => `${point.x},${point.y}`)
  return corners.every((corner) => pointKeys.includes(corner)) && new Set(pointKeys).size === 4
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/shape-editor/lib/classifyContour`
Expected: PASS, 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/shape-editor/lib/classifyContour.ts src/features/shape-editor/lib/classifyContour.test.ts
git commit -m "Add classifyContour to auto-detect rect vs polygon"
```

---

### Task 4: `features/shape-editor/lib/hasSelfIntersection`

**Files:**
- Create: `src/features/shape-editor/lib/hasSelfIntersection.ts`
- Create: `src/features/shape-editor/lib/hasSelfIntersection.test.ts`

**Interfaces:**
- Consumes: `Point` from `@/shared/lib/geometry`.
- Produces: `hasSelfIntersection(points: Point[]): boolean` — treats `points` as a closed contour (last point implicitly connects back to first). Used by `editorReducer` (Task 6).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { hasSelfIntersection } from './hasSelfIntersection'

describe('hasSelfIntersection', () => {
  it('треугольник — никогда не самопересекается', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 100 },
    ]
    expect(hasSelfIntersection(points)).toBe(false)
  })

  it('простой квадрат — нет пересечений', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ]
    expect(hasSelfIntersection(points)).toBe(false)
  })

  it('невыпуклая L-образная фигура — нет пересечений', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 50, y: 50 },
      { x: 50, y: 100 },
      { x: 0, y: 100 },
    ]
    expect(hasSelfIntersection(points)).toBe(false)
  })

  it('контур-бабочка (диагонали четырёхугольника пересекаются) — true', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
    ]
    expect(hasSelfIntersection(points)).toBe(true)
  })

  it('соседние стороны, разделяющие общую вершину, не считаются пересечением', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
      { x: 0, y: 50 },
    ]
    expect(hasSelfIntersection(points)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/shape-editor/lib/hasSelfIntersection`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { Point } from '@/shared/lib/geometry'

export const hasSelfIntersection = (points: Point[]): boolean => {
  const n = points.length
  if (n < 4) return false // треугольник самопересечься не может

  for (let i = 0; i < n; i++) {
    const a1 = points[i]!
    const a2 = points[(i + 1) % n]!
    for (let j = i + 1; j < n; j++) {
      const sharesVertex = j === i || j === (i + 1) % n || (j + 1) % n === i
      if (sharesVertex) continue
      const b1 = points[j]!
      const b2 = points[(j + 1) % n]!
      if (segmentsIntersect(a1, a2, b1, b2)) return true
    }
  }
  return false
}

const orientation = (p: Point, q: Point, r: Point): number => {
  const value = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y)
  if (value === 0) return 0
  return value > 0 ? 1 : 2
}

const onSegment = (p: Point, q: Point, r: Point): boolean =>
  q.x <= Math.max(p.x, r.x) &&
  q.x >= Math.min(p.x, r.x) &&
  q.y <= Math.max(p.y, r.y) &&
  q.y >= Math.min(p.y, r.y)

const segmentsIntersect = (p1: Point, q1: Point, p2: Point, q2: Point): boolean => {
  const o1 = orientation(p1, q1, p2)
  const o2 = orientation(p1, q1, q2)
  const o3 = orientation(p2, q2, p1)
  const o4 = orientation(p2, q2, q1)

  if (o1 !== o2 && o3 !== o4) return true

  if (o1 === 0 && onSegment(p1, p2, q1)) return true
  if (o2 === 0 && onSegment(p1, q2, q1)) return true
  if (o3 === 0 && onSegment(p2, p1, q2)) return true
  if (o4 === 0 && onSegment(p2, q1, q2)) return true

  return false
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/shape-editor/lib/hasSelfIntersection`
Expected: PASS, 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/shape-editor/lib/hasSelfIntersection.ts src/features/shape-editor/lib/hasSelfIntersection.test.ts
git commit -m "Add hasSelfIntersection contour validation"
```

---

### Task 5: `features/shape-editor/lib/fitScale`

**Files:**
- Create: `src/features/shape-editor/lib/fitScale.ts`
- Create: `src/features/shape-editor/lib/fitScale.test.ts`

**Interfaces:**
- Consumes: nothing external.
- Produces: `Bounds` type `{ minX, minY, maxX, maxY }`, `ViewBox` type `{ x, y, width, height }` (mm), `fitScale(bounds: Bounds): ViewBox`. Used by `ShapeEditor.tsx` (Task 7) as the SVG `viewBox` when auto-fit is active.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { fitScale } from './fitScale'

describe('fitScale', () => {
  it('квадратные границы 100×100 — viewBox с 15% отступом, центрированный', () => {
    const result = fitScale({ minX: 0, minY: 0, maxX: 100, maxY: 100 })
    expect(result).toEqual({ x: -15, y: -15, width: 130, height: 130 })
  })

  it('прямоугольные границы — viewBox квадратный по большей стороне', () => {
    const result = fitScale({ minX: 0, minY: 0, maxX: 300, maxY: 200 })
    // большая сторона 300, +30% отступ = 390, центр по обеим осям — центр bounds
    expect(result.width).toBe(390)
    expect(result.height).toBe(390)
    expect(result.x).toBeCloseTo(150 - 195)
    expect(result.y).toBeCloseTo(100 - 195)
  })

  it('большие границы (метры) — тот же алгоритм, без переполнения', () => {
    const result = fitScale({ minX: 0, minY: 0, maxX: 3000, maxY: 2000 })
    expect(result.width).toBe(3900)
    expect(result.height).toBe(3900)
  })

  it('границы не по центру начала координат — центрируется корректно', () => {
    const result = fitScale({ minX: 100, minY: 100, maxX: 200, maxY: 200 })
    expect(result).toEqual({ x: 100 - 15, y: 100 - 15, width: 130, height: 130 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/shape-editor/lib/fitScale`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface ViewBox {
  x: number
  y: number
  width: number
  height: number
}

const MARGIN_RATIO = 0.15

// Квадратный viewBox по большей стороне bounds + отступ с каждой стороны —
// упрощает zoom/pinch (соотношение сторон канваса всегда 1:1), letterbox
// по короткой стороне рисует SVG сам (preserveAspectRatio по умолчанию).
export const fitScale = (bounds: Bounds): ViewBox => {
  const contentWidth = Math.max(bounds.maxX - bounds.minX, 1)
  const contentHeight = Math.max(bounds.maxY - bounds.minY, 1)
  const size = Math.max(contentWidth, contentHeight) * (1 + MARGIN_RATIO * 2)
  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2
  return { x: centerX - size / 2, y: centerY - size / 2, width: size, height: size }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/shape-editor/lib/fitScale`
Expected: PASS, 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/shape-editor/lib/fitScale.ts src/features/shape-editor/lib/fitScale.test.ts
git commit -m "Add fitScale auto-fit viewBox calculation"
```

---

### Task 6: `features/shape-editor/lib/editorReducer`

**Files:**
- Create: `src/features/shape-editor/lib/editorReducer.ts`
- Create: `src/features/shape-editor/lib/editorReducer.test.ts`

**Interfaces:**
- Consumes: `Point`, `Geometry` from `@/shared/lib/geometry`; `classifyContour` (Task 3); `hasSelfIntersection` (Task 4).
- Produces: `DrawingStatus`, `EditorState { points: Point[]; status: DrawingStatus; intersecting: boolean }`, `EditorAction` (union below), `initEditorState(geometry: Geometry | null): EditorState`, `editorReducer(state: EditorState, action: EditorAction): EditorState`, `geometryFromState(state: EditorState): Geometry | null`, `geometryEquals(a: Geometry | null, b: Geometry | null): boolean`. All consumed by `ShapeEditor.tsx` starting Task 7 — this is the entire state machine described in the design doc's "Состояния контура" / "Построение контура" / "Редактирование замкнутого контура" sections, with no DOM/React dependency, so every gesture rule is unit-tested here rather than via pointer-event simulation later.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  editorReducer,
  initEditorState,
  geometryFromState,
  geometryEquals,
  type EditorState,
} from './editorReducer'

const EMPTY: EditorState = { points: [], status: 'empty', intersecting: false }

describe('initEditorState', () => {
  it('null geometry — empty', () => {
    expect(initEditorState(null)).toEqual(EMPTY)
  })

  it('rect geometry — closed с 4 точками bounding box', () => {
    const state = initEditorState({ kind: 'rect', width: 100, height: 50 })
    expect(state).toEqual({
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
        { x: 0, y: 50 },
      ],
      status: 'closed',
      intersecting: false,
    })
  })

  it('polygon geometry — closed с исходными вершинами', () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 50, y: 100 },
    ]
    expect(initEditorState({ kind: 'polygon', vertices })).toEqual({
      points: vertices,
      status: 'closed',
      intersecting: false,
    })
  })
})

describe('editorReducer — построение многоугольника тапами', () => {
  it('point-added добавляет точку и переводит в drawing', () => {
    const state = editorReducer(EMPTY, { type: 'point-added', point: { x: 10, y: 10 } })
    expect(state).toEqual({ points: [{ x: 10, y: 10 }], status: 'drawing', intersecting: false })
  })

  it('point-added на замкнутом контуре — no-op (возвращает тот же state)', () => {
    const closed: EditorState = {
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      status: 'closed',
      intersecting: false,
    }
    expect(editorReducer(closed, { type: 'point-added', point: { x: 20, y: 20 } })).toBe(closed)
  })

  it('тап точно в первую точку при ≥3 точках без самопересечения — замыкает контур', () => {
    const drawing: EditorState = {
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      status: 'drawing',
      intersecting: false,
    }
    const state = editorReducer(drawing, { type: 'point-added', point: { x: 0, y: 0 } })
    expect(state.status).toBe('closed')
    expect(state.points).toEqual(drawing.points)
  })

  it('тап в первую точку при <3 точек — просто добавляет точку поверх (не замыкает)', () => {
    const drawing: EditorState = {
      points: [{ x: 0, y: 0 }],
      status: 'drawing',
      intersecting: false,
    }
    const state = editorReducer(drawing, { type: 'point-added', point: { x: 0, y: 0 } })
    expect(state.status).toBe('drawing')
    expect(state.points).toEqual([{ x: 0, y: 0 }, { x: 0, y: 0 }])
  })

  it('замыкание в самопересекающийся контур — остаётся drawing с intersecting=true', () => {
    const drawing: EditorState = {
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        { x: 100, y: 0 },
      ],
      status: 'drawing',
      intersecting: false,
    }
    const state = editorReducer(drawing, { type: 'point-added', point: { x: 0, y: 100 } })
    // 4 точки-бабочка при замыкании самопересекаются
    expect(state.status).toBe('drawing')
    expect(state.intersecting).toBe(true)
  })
})

describe('editorReducer — closed-by-button', () => {
  it('<3 точек — no-op', () => {
    const state: EditorState = { points: [{ x: 0, y: 0 }], status: 'drawing', intersecting: false }
    expect(editorReducer(state, { type: 'closed-by-button' })).toBe(state)
  })

  it('≥3 точек без пересечений — замыкает', () => {
    const state: EditorState = {
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 100 },
      ],
      status: 'drawing',
      intersecting: false,
    }
    expect(editorReducer(state, { type: 'closed-by-button' }).status).toBe('closed')
  })
})

describe('editorReducer — rect-drawn (drag-шорткат)', () => {
  it('из пустого состояния — сразу closed с 4 углами', () => {
    const state = editorReducer(EMPTY, {
      type: 'rect-drawn',
      corner1: { x: 0, y: 0 },
      corner2: { x: 100, y: 50 },
    })
    expect(state).toEqual({
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
        { x: 0, y: 50 },
      ],
      status: 'closed',
      intersecting: false,
    })
  })

  it('если уже есть хотя бы одна точка — no-op', () => {
    const drawing: EditorState = { points: [{ x: 0, y: 0 }], status: 'drawing', intersecting: false }
    expect(
      editorReducer(drawing, { type: 'rect-drawn', corner1: { x: 0, y: 0 }, corner2: { x: 10, y: 10 } }),
    ).toBe(drawing)
  })

  it('нулевая ширина/высота драга — no-op', () => {
    expect(
      editorReducer(EMPTY, { type: 'rect-drawn', corner1: { x: 0, y: 0 }, corner2: { x: 0, y: 50 } }),
    ).toBe(EMPTY)
  })
})

describe('editorReducer — last-point-undone / cleared', () => {
  it('last-point-undone убирает последнюю точку', () => {
    const state: EditorState = {
      points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
      status: 'drawing',
      intersecting: false,
    }
    expect(editorReducer(state, { type: 'last-point-undone' })).toEqual({
      points: [{ x: 0, y: 0 }],
      status: 'drawing',
      intersecting: false,
    })
  })

  it('last-point-undone до 0 точек — возвращается в empty', () => {
    const state: EditorState = { points: [{ x: 0, y: 0 }], status: 'drawing', intersecting: false }
    expect(editorReducer(state, { type: 'last-point-undone' })).toEqual(EMPTY)
  })

  it('last-point-undone на пустом состоянии — no-op', () => {
    expect(editorReducer(EMPTY, { type: 'last-point-undone' })).toBe(EMPTY)
  })

  it('cleared сбрасывает в empty из любого состояния', () => {
    const closed: EditorState = {
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
      status: 'closed',
      intersecting: false,
    }
    expect(editorReducer(closed, { type: 'cleared' })).toEqual(EMPTY)
  })
})

describe('editorReducer — vertex-moved', () => {
  const square: EditorState = {
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ],
    status: 'closed',
    intersecting: false,
  }

  it('двигает вершину по индексу, остаётся closed', () => {
    const state = editorReducer(square, { type: 'vertex-moved', index: 1, point: { x: 80, y: 20 } })
    expect(state.status).toBe('closed')
    expect(state.points[1]).toEqual({ x: 80, y: 20 })
    expect(state.intersecting).toBe(false)
  })

  it('движение, создающее самопересечение — intersecting=true, но остаётся closed', () => {
    const state = editorReducer(square, { type: 'vertex-moved', index: 0, point: { x: 100, y: 100 } })
    expect(state.status).toBe('closed')
    expect(state.intersecting).toBe(true)
  })
})

describe('editorReducer — value-synced', () => {
  it('делегирует в initEditorState', () => {
    const state = editorReducer(EMPTY, {
      type: 'value-synced',
      geometry: { kind: 'rect', width: 10, height: 10 },
    })
    expect(state).toEqual(initEditorState({ kind: 'rect', width: 10, height: 10 }))
  })
})

describe('geometryFromState', () => {
  it('closed без пересечений — валидная Geometry', () => {
    const state: EditorState = {
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }],
      status: 'closed',
      intersecting: false,
    }
    expect(geometryFromState(state)).toEqual({ kind: 'rect', width: 100, height: 50 })
  })

  it('drawing — null', () => {
    expect(geometryFromState({ points: [{ x: 0, y: 0 }], status: 'drawing', intersecting: false })).toBeNull()
  })

  it('closed, но intersecting — null (невалидная геометрия наружу не идёт)', () => {
    const state: EditorState = {
      points: [{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 0 }, { x: 0, y: 100 }],
      status: 'closed',
      intersecting: true,
    }
    expect(geometryFromState(state)).toBeNull()
  })
})

describe('geometryEquals', () => {
  it('оба null — равны', () => {
    expect(geometryEquals(null, null)).toBe(true)
  })

  it('один null — не равны', () => {
    expect(geometryEquals(null, { kind: 'rect', width: 1, height: 1 })).toBe(false)
  })

  it('одинаковые rect по значению — равны', () => {
    expect(
      geometryEquals({ kind: 'rect', width: 10, height: 20 }, { kind: 'rect', width: 10, height: 20 }),
    ).toBe(true)
  })

  it('разные rect — не равны', () => {
    expect(
      geometryEquals({ kind: 'rect', width: 10, height: 20 }, { kind: 'rect', width: 10, height: 21 }),
    ).toBe(false)
  })

  it('одинаковые polygon по значению — равны', () => {
    const vertices = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }]
    expect(
      geometryEquals({ kind: 'polygon', vertices }, { kind: 'polygon', vertices: [...vertices] }),
    ).toBe(true)
  })

  it('rect и polygon — не равны', () => {
    expect(
      geometryEquals(
        { kind: 'rect', width: 10, height: 10 },
        { kind: 'polygon', vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }] },
      ),
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/features/shape-editor/lib/editorReducer`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { Point, Geometry } from '@/shared/lib/geometry'
import { classifyContour } from './classifyContour'
import { hasSelfIntersection } from './hasSelfIntersection'

export type DrawingStatus = 'empty' | 'drawing' | 'closed'

export interface EditorState {
  points: Point[]
  status: DrawingStatus
  intersecting: boolean
}

export type EditorAction =
  | { type: 'point-added'; point: Point }
  | { type: 'closed-by-button' }
  | { type: 'rect-drawn'; corner1: Point; corner2: Point }
  | { type: 'last-point-undone' }
  | { type: 'cleared' }
  | { type: 'vertex-moved'; index: number; point: Point }
  | { type: 'value-synced'; geometry: Geometry | null }

const geometryToPoints = (geometry: Geometry | null): Point[] => {
  if (!geometry) return []
  if (geometry.kind === 'polygon') return geometry.vertices
  const { width, height } = geometry
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ]
}

export const initEditorState = (geometry: Geometry | null): EditorState => {
  const points = geometryToPoints(geometry)
  return { points, status: points.length > 0 ? 'closed' : 'empty', intersecting: false }
}

const closeIfValid = (points: Point[]): EditorState => {
  const intersecting = hasSelfIntersection(points)
  return { points, status: intersecting ? 'drawing' : 'closed', intersecting }
}

export const editorReducer = (state: EditorState, action: EditorAction): EditorState => {
  switch (action.type) {
    case 'point-added': {
      if (state.status === 'closed') return state
      const first = state.points[0]
      const isClosingTap =
        state.points.length >= 3 &&
        first !== undefined &&
        first.x === action.point.x &&
        first.y === action.point.y
      if (isClosingTap) return closeIfValid(state.points)
      return { points: [...state.points, action.point], status: 'drawing', intersecting: false }
    }
    case 'closed-by-button': {
      if (state.points.length < 3) return state
      return closeIfValid(state.points)
    }
    case 'rect-drawn': {
      if (state.points.length > 0) return state
      const { corner1, corner2 } = action
      if (corner1.x === corner2.x || corner1.y === corner2.y) return state
      return {
        points: [
          { x: corner1.x, y: corner1.y },
          { x: corner2.x, y: corner1.y },
          { x: corner2.x, y: corner2.y },
          { x: corner1.x, y: corner2.y },
        ],
        status: 'closed',
        intersecting: false,
      }
    }
    case 'last-point-undone': {
      if (state.points.length === 0) return state
      const points = state.points.slice(0, -1)
      return { points, status: points.length > 0 ? 'drawing' : 'empty', intersecting: false }
    }
    case 'cleared':
      return state.points.length === 0 ? state : { points: [], status: 'empty', intersecting: false }
    case 'vertex-moved': {
      const points = state.points.map((point, index) => (index === action.index ? action.point : point))
      return { points, status: 'closed', intersecting: hasSelfIntersection(points) }
    }
    case 'value-synced':
      return initEditorState(action.geometry)
    default:
      return state
  }
}

export const geometryFromState = (state: EditorState): Geometry | null =>
  state.status === 'closed' && !state.intersecting ? classifyContour(state.points) : null

export const geometryEquals = (a: Geometry | null, b: Geometry | null): boolean => {
  if (a === b) return true
  if (a === null || b === null) return false
  if (a.kind !== b.kind) return false
  if (a.kind === 'rect' && b.kind === 'rect') return a.width === b.width && a.height === b.height
  if (a.kind === 'polygon' && b.kind === 'polygon') {
    if (a.vertices.length !== b.vertices.length) return false
    return a.vertices.every(
      (point, index) => point.x === b.vertices[index]!.x && point.y === b.vertices[index]!.y,
    )
  }
  return false
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/features/shape-editor/lib/editorReducer`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/shape-editor/lib/editorReducer.ts src/features/shape-editor/lib/editorReducer.test.ts
git commit -m "Add pure editorReducer state machine for shape-editor"
```

---

### Task 7: Pure render helpers + `useShapeEditor` skeleton + `ShapeEditor.tsx` render-only

CLAUDE.md's hard requirement — "разделение логики и UI: компонент в `ui/` не знает о домене; вся логика в кастомных хуках; если в компоненте больше ~120 строк — декомпозируй" — governs how this and every later UI task in this plan are written. All interaction logic accumulates in one hook, `model/useShapeEditor.ts` (co-located per the `model/useCascadeFilter.ts`, `model/useCardSort.ts` convention already used elsewhere in this codebase); `ShapeEditor.tsx` only renders what the hook returns. Two more pure calculations move out to `lib/` here too, alongside the existing `boundsOfPoints`-shaped logic — this keeps the hook itself smaller and adds unit-test coverage that doesn't need RTL.

**Files:**
- Create: `src/features/shape-editor/lib/boundsOfPoints.ts`
- Create: `src/features/shape-editor/lib/boundsOfPoints.test.ts`
- Create: `src/features/shape-editor/lib/formatReadout.ts`
- Create: `src/features/shape-editor/lib/formatReadout.test.ts`
- Create: `src/features/shape-editor/model/useShapeEditor.ts`
- Create: `src/features/shape-editor/ui/ShapeEditor.tsx`
- Create: `src/features/shape-editor/ui/ShapeEditor.module.scss`
- Create: `src/features/shape-editor/ui/ShapeEditor.test.tsx`
- Create: `src/features/shape-editor/index.ts`

**Interfaces:**
- Consumes: `Point`, `Geometry` from `@/shared/lib/geometry`; `initEditorState`, `editorReducer`, `geometryFromState`, `geometryEquals`, `EditorState` from `../lib/editorReducer` (Task 6); `fitScale`, `Bounds`, `ViewBox` from `../lib/fitScale` (Task 5); `GRID_STEP_MM` from `../lib/snapToGrid` (Task 2).
- Produces: `boundsOfPoints(points: Point[]): Bounds`; `formatReadout(state: EditorState): string`; `useShapeEditor(value, onChange)` returning `{ state, dispatch, viewBox }` in this task — Tasks 8–11 extend both the hook's internals and its returned object (adding `svgRef`, pointer handlers, vertex-drag handlers, zoom controls) without changing these three keys. `ShapeEditor({ value, onChange }: ShapeEditorProps)`, exported from `features/shape-editor/index.ts` — renders whatever `value` is passed and reflects external changes; no pointer interaction yet.

- [ ] **Step 1: Write the failing tests**

`src/features/shape-editor/lib/boundsOfPoints.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { boundsOfPoints, DEFAULT_BOUNDS } from './boundsOfPoints'

describe('boundsOfPoints', () => {
  it('пустой массив — DEFAULT_BOUNDS', () => {
    expect(boundsOfPoints([])).toEqual(DEFAULT_BOUNDS)
  })

  it('одна точка — границы схлопнуты в эту точку', () => {
    expect(boundsOfPoints([{ x: 10, y: 20 }])).toEqual({ minX: 10, minY: 20, maxX: 10, maxY: 20 })
  })

  it('несколько точек — минимум/максимум по каждой оси', () => {
    const points = [
      { x: 0, y: 50 },
      { x: 100, y: 0 },
      { x: 30, y: 200 },
    ]
    expect(boundsOfPoints(points)).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 200 })
  })
})
```

`src/features/shape-editor/lib/formatReadout.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatReadout } from './formatReadout'
import type { EditorState } from './editorReducer'

describe('formatReadout', () => {
  it('empty — просит первые 3 точки', () => {
    expect(formatReadout({ points: [], status: 'empty', intersecting: false })).toBe('Поставьте ещё 3 точки')
  })

  it('drawing с 1 точкой — просит ещё 2', () => {
    const state: EditorState = { points: [{ x: 0, y: 0 }], status: 'drawing', intersecting: false }
    expect(formatReadout(state)).toBe('Поставьте ещё 2 точки')
  })

  it('drawing с ≥3 точками — «Можно замкнуть»', () => {
    const state: EditorState = {
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
      status: 'drawing',
      intersecting: false,
    }
    expect(formatReadout(state)).toBe('Можно замкнуть')
  })

  it('closed rect — тип, размеры, площадь', () => {
    const state: EditorState = {
      points: [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 200 }, { x: 0, y: 200 }],
      status: 'closed',
      intersecting: false,
    }
    expect(formatReadout(state)).toBe('rect 300×200 мм · 0.06 м²')
  })

  it('closed polygon — тип и площадь', () => {
    const state: EditorState = {
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 }],
      status: 'closed',
      intersecting: false,
    }
    expect(formatReadout(state)).toBe('polygon · 0.01 м²')
  })

  it('closed, но intersecting — сообщение об ошибке', () => {
    const state: EditorState = {
      points: [{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 0 }, { x: 0, y: 100 }],
      status: 'closed',
      intersecting: true,
    }
    expect(formatReadout(state)).toBe('Самопересечение — исправьте контур')
  })
})
```

`src/features/shape-editor/ui/ShapeEditor.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ShapeEditor } from './ShapeEditor'

describe('ShapeEditor — рендер по value', () => {
  it('value=null — пустой канвас, подсказка «Поставьте ещё 3 точки»', () => {
    render(<ShapeEditor value={null} onChange={vi.fn()} />)
    expect(screen.getByText(/Поставьте ещё 3 точки/)).toBeInTheDocument()
    expect(screen.queryAllByTestId(/shape-editor-vertex-/)).toHaveLength(0)
  })

  it('value=rect — рендерит 4 вершины и живой отчёт с площадью', () => {
    render(<ShapeEditor value={{ kind: 'rect', width: 300, height: 200 }} onChange={vi.fn()} />)
    expect(screen.getAllByTestId(/shape-editor-vertex-/)).toHaveLength(4)
    expect(screen.getByText('rect 300×200 мм · 0.06 м²')).toBeInTheDocument()
  })

  it('value=polygon — рендерит N вершин и живой отчёт с площадью', () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 50, y: 150 },
      { x: 0, y: 100 },
    ]
    render(<ShapeEditor value={{ kind: 'polygon', vertices }} onChange={vi.fn()} />)
    expect(screen.getAllByTestId(/shape-editor-vertex-/)).toHaveLength(5)
    expect(screen.getByText(/^polygon · /)).toBeInTheDocument()
  })

  it('изменение value извне (другой кусок) перерисовывает контур', () => {
    const { rerender } = render(<ShapeEditor value={{ kind: 'rect', width: 10, height: 10 }} onChange={vi.fn()} />)
    expect(screen.getAllByTestId(/shape-editor-vertex-/)).toHaveLength(4)

    rerender(<ShapeEditor value={null} onChange={vi.fn()} />)
    expect(screen.queryAllByTestId(/shape-editor-vertex-/)).toHaveLength(0)
    expect(screen.getByText(/Поставьте ещё 3 точки/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/features/shape-editor`
Expected: FAIL — none of the modules exist yet.

- [ ] **Step 3: Write minimal implementation**

`src/features/shape-editor/lib/boundsOfPoints.ts`:

```ts
import type { Point } from '@/shared/lib/geometry'
import type { Bounds } from './fitScale'

export const DEFAULT_BOUNDS: Bounds = { minX: 0, minY: 0, maxX: 200, maxY: 200 }

export const boundsOfPoints = (points: Point[]): Bounds => {
  if (points.length === 0) return DEFAULT_BOUNDS
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
}
```

`src/features/shape-editor/lib/formatReadout.ts`:

```ts
import { computeArea } from '@/shared/lib/geometry'
import { geometryFromState, type EditorState } from './editorReducer'

export const formatReadout = (state: EditorState): string => {
  if (state.status === 'empty' || state.status === 'drawing') {
    const remaining = Math.max(3 - state.points.length, 0)
    return remaining > 0 ? `Поставьте ещё ${remaining} точки` : 'Можно замкнуть'
  }
  const geometry = geometryFromState(state)
  if (!geometry) return 'Самопересечение — исправьте контур'
  const areaM2 = Number((computeArea(geometry) / 1_000_000).toFixed(2))
  if (geometry.kind === 'rect') return `rect ${geometry.width}×${geometry.height} мм · ${areaM2} м²`
  return `polygon · ${areaM2} м²`
}
```

`src/features/shape-editor/model/useShapeEditor.ts`:

```ts
import { useEffect, useMemo, useReducer, useRef } from 'react'
import type { Geometry } from '@/shared/lib/geometry'
import {
  editorReducer,
  geometryEquals,
  geometryFromState,
  initEditorState,
  type EditorState,
  type EditorAction,
} from '../lib/editorReducer'
import { fitScale, type ViewBox } from '../lib/fitScale'
import { boundsOfPoints } from '../lib/boundsOfPoints'

export interface UseShapeEditorResult {
  state: EditorState
  dispatch: (action: EditorAction) => void
  viewBox: ViewBox
}

export const useShapeEditor = (
  value: Geometry | null,
  onChange: (geometry: Geometry | null) => void,
): UseShapeEditorResult => {
  const [state, dispatch] = useReducer(editorReducer, value, initEditorState)
  const lastSyncedValueRef = useRef<Geometry | null>(value)
  const lastEmittedRef = useRef<Geometry | null>(geometryFromState(state))

  // Внешнее изменение value (другой кусок, сброс формы) — синхронизируем
  // внутреннее состояние. Сравнение по ссылке отличает «нас попросили
  // измениться извне» от «мы сами только что вызвали onChange», т.к.
  // родитель (react-hook-form Controller) отражает ровно тот же объект
  // обратно в value, пока ничего другого не произошло.
  useEffect(() => {
    if (value === lastSyncedValueRef.current) return
    lastSyncedValueRef.current = value
    dispatch({ type: 'value-synced', geometry: value })
  }, [value])

  const geometry = geometryFromState(state)
  useEffect(() => {
    if (lastSyncedValueRef.current !== value) return // синхронизация извне ещё не применилась к state
    if (geometryEquals(geometry, lastEmittedRef.current)) return
    lastEmittedRef.current = geometry
    onChange(geometry)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry])

  const bounds = useMemo(() => boundsOfPoints(state.points), [state.points])
  const viewBox = useMemo(() => fitScale(bounds), [bounds])

  return { state, dispatch, viewBox }
}
```

`src/features/shape-editor/ui/ShapeEditor.tsx`:

```tsx
import clsx from 'clsx'
import type { Geometry } from '@/shared/lib/geometry'
import { useShapeEditor } from '../model/useShapeEditor'
import { formatReadout } from '../lib/formatReadout'
import { GRID_STEP_MM } from '../lib/snapToGrid'
import styles from './ShapeEditor.module.scss'

interface ShapeEditorProps {
  value: Geometry | null
  onChange: (geometry: Geometry | null) => void
}

// Литеральные линии сетки каждые 5мм как отдельные SVG-элементы дали бы
// сотни/тысячи узлов DOM на крупных кусках (метры) — вместо этого тайлим
// <pattern> фиксированного мм-размера, число DOM-узлов не зависит от
// размера контура и зума. Числовые подписи на линиях — не в этой версии,
// точные размеры и так видны в живом отчёте под канвасом.
const GRID_MAJOR_STEP_MM = GRID_STEP_MM * 10

export const ShapeEditor = ({ value, onChange }: ShapeEditorProps) => {
  const { state, viewBox } = useShapeEditor(value, onChange)
  const readout = formatReadout(state)
  const contourPoints = state.status === 'closed' ? [...state.points, state.points[0]!] : state.points

  return (
    <div className={styles.root}>
      <svg
        className={styles.canvas}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        role="img"
        aria-label="Редактор геометрии куска"
        data-testid="shape-editor-canvas"
      >
        <defs>
          <pattern id="grid-minor" width={GRID_STEP_MM} height={GRID_STEP_MM} patternUnits="userSpaceOnUse">
            <circle cx={0} cy={0} r={0.4} className={styles.gridMinorDot} />
          </pattern>
          <pattern id="grid-major" width={GRID_MAJOR_STEP_MM} height={GRID_MAJOR_STEP_MM} patternUnits="userSpaceOnUse">
            <path d={`M ${GRID_MAJOR_STEP_MM} 0 L 0 0 0 ${GRID_MAJOR_STEP_MM}`} className={styles.gridMajorLine} />
          </pattern>
        </defs>
        <rect x={viewBox.x} y={viewBox.y} width={viewBox.width} height={viewBox.height} fill="url(#grid-minor)" />
        <rect x={viewBox.x} y={viewBox.y} width={viewBox.width} height={viewBox.height} fill="url(#grid-major)" />
        {state.points.length >= 2 ? (
          <polyline
            className={clsx(styles.contour, state.intersecting && styles.contourInvalid)}
            points={contourPoints.map((point) => `${point.x},${point.y}`).join(' ')}
          />
        ) : null}
        {state.status === 'closed' ? (
          <polygon className={styles.fill} points={state.points.map((point) => `${point.x},${point.y}`).join(' ')} />
        ) : null}
        {state.points.map((point, index) => (
          <circle
            key={index}
            data-testid={`shape-editor-vertex-${index}`}
            className={styles.vertex}
            cx={point.x}
            cy={point.y}
            r={4}
          />
        ))}
      </svg>
      <p className={styles.readout}>{readout}</p>
    </div>
  )
}
```

`src/features/shape-editor/ui/ShapeEditor.module.scss`:

```scss
.root {
  display: flex;
  flex-direction: column;
  gap: $space-2;
}

.canvas {
  width: 100%;
  aspect-ratio: 1 / 1;
  max-width: 360px;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  background: $color-surface;
  touch-action: none; // жесты (pinch/drag) обрабатываются самим редактором, не браузером
}

.gridMinorDot {
  fill: $color-graphite-100;
}

.gridMajorLine {
  fill: none;
  stroke: $color-graphite-100;
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.contour {
  fill: none;
  stroke: $color-accent-cyan;
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.contourInvalid {
  stroke: $color-red;
}

.fill {
  fill: $color-accent-cyan-muted;
  stroke: none;
}

.vertex {
  fill: $color-accent-cyan;
  stroke: $color-white;
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.readout {
  @include tabular-nums;

  font-family: $font-family-mono;
  font-size: 0.875rem;
  color: $color-text-muted;
  margin: 0;
}
```

`src/features/shape-editor/index.ts`:

```ts
export { ShapeEditor } from './ui/ShapeEditor'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/shape-editor/ui/ShapeEditor`
Expected: PASS, 4 tests green. (`areaM2` interpolates as `0.06` for 60000mm² and similar — Vitest's `toBeInTheDocument` string match must equal exactly what `formatReadout` produces; if the printed number differs from the literal in the test, e.g. floating point noise, fix `formatReadout` to use `Number(areaM2.toFixed(2))` before interpolating, then rerun.)

- [ ] **Step 5: Commit**

```bash
git add src/features/shape-editor
git commit -m "Add ShapeEditor skeleton rendering from value"
```

---

### Task 8: Polygon click-to-place + Замкнуть/Назад/Очистить

**Files:**
- Create: `src/features/shape-editor/lib/clientToMm.ts`
- Create: `src/features/shape-editor/lib/clientToMm.test.ts`
- Modify: `src/features/shape-editor/model/useShapeEditor.ts`
- Modify: `src/features/shape-editor/ui/ShapeEditor.tsx`
- Modify: `src/features/shape-editor/ui/ShapeEditor.module.scss`
- Modify: `src/features/shape-editor/ui/ShapeEditor.test.tsx`

**Interfaces:**
- Consumes: `snapToGrid`, `GRID_STEP_MM` from `../lib/snapToGrid` (Task 2).
- Produces: `clientToMm(clientX, clientY, rect, viewBox): Point` — a pure coordinate-conversion helper (takes a plain `{ left, top, width, height }` rect instead of a real `DOMRect` so it needs no DOM mocking to test) used by every pointer handler from here through Task 11. `useShapeEditor` now also returns `svgRef`, `canClose`, and `handleCanvasClick`; `ShapeEditor.tsx` wires `svgRef`/`handleCanvasClick` onto the `<svg>` and adds the toolbar, dispatching `closed-by-button` / `last-point-undone` / `cleared` directly via the hook's `dispatch`, each button with a `data-testid` (`shape-editor-close`, `shape-editor-undo`, `shape-editor-clear`) so later tasks' tests and future consumers can target them without relying on visible text. Task 9 (drag rectangle) replaces `handleCanvasClick` inside the hook with a pointerdown/move/up handler pair that preserves this task's click-equivalent behavior — covered by re-running this task's tests in Task 9's Step 4.

- [ ] **Step 1: Write the failing tests**

`src/features/shape-editor/lib/clientToMm.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { clientToMm } from './clientToMm'

const RECT = { left: 0, top: 0, width: 360, height: 360 }
const VIEW_BOX = { x: -15, y: -15, width: 130, height: 130 }

describe('clientToMm', () => {
  it('центр канваса — центр viewBox', () => {
    expect(clientToMm(180, 180, RECT, VIEW_BOX)).toEqual({ x: 50, y: 50 })
  })

  it('верхний левый угол канваса — верхний левый угол viewBox', () => {
    expect(clientToMm(0, 0, RECT, VIEW_BOX)).toEqual({ x: -15, y: -15 })
  })

  it('канвас со смещённым left/top (например, внутри модалки) учитывается', () => {
    const offsetRect = { left: 100, top: 50, width: 360, height: 360 }
    expect(clientToMm(100, 50, offsetRect, VIEW_BOX)).toEqual({ x: -15, y: -15 })
  })

  it('нулевой rect (элемент ещё не в DOM) не делится на ноль', () => {
    expect(clientToMm(10, 10, { left: 0, top: 0, width: 0, height: 0 }, VIEW_BOX)).toEqual({ x: -15, y: -15 })
  })
})
```

Add to `ShapeEditor.test.tsx` (new `describe` block, existing tests untouched):

```tsx
import { fireEvent } from '@testing-library/react'

// ...внутри файла, после существующих describe:

const mockCanvasRect = () => {
  vi.spyOn(SVGSVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 360,
    height: 360,
    right: 360,
    bottom: 360,
    x: 0,
    y: 0,
    toJSON: () => '',
  })
}

describe('ShapeEditor — рисование многоугольника тапами', () => {
  it('три клика + замыкание кнопкой — вызывает onChange с polygon', () => {
    mockCanvasRect()
    const onChange = vi.fn()
    render(<ShapeEditor value={null} onChange={onChange} />)
    const canvas = screen.getByTestId('shape-editor-canvas')

    // viewBox для пустого состояния — DEFAULT_BOUNDS с 15% отступом:
    // x=-30 y=-30 width=260 height=260 (200*1.3), 1px канваса = 260/360 мм
    fireEvent.click(canvas, { clientX: 30, clientY: 30 })
    fireEvent.click(canvas, { clientX: 200, clientY: 30 })
    fireEvent.click(canvas, { clientX: 200, clientY: 200 })

    expect(onChange).not.toHaveBeenCalled() // ещё не замкнут

    fireEvent.click(screen.getByTestId('shape-editor-close'))

    expect(onChange).toHaveBeenCalledTimes(1)
    const [geometry] = onChange.mock.calls[0]!
    expect(geometry.kind).toBe('polygon')
    expect(geometry.vertices).toHaveLength(3)
  })

  it('кнопка Назад убирает последнюю точку', () => {
    mockCanvasRect()
    render(<ShapeEditor value={null} onChange={vi.fn()} />)
    const canvas = screen.getByTestId('shape-editor-canvas')

    fireEvent.click(canvas, { clientX: 30, clientY: 30 })
    fireEvent.click(canvas, { clientX: 200, clientY: 30 })
    expect(screen.getAllByTestId(/shape-editor-vertex-/)).toHaveLength(2)

    fireEvent.click(screen.getByTestId('shape-editor-undo'))
    expect(screen.getAllByTestId(/shape-editor-vertex-/)).toHaveLength(1)
  })

  it('кнопка Очистить сбрасывает контур и вызывает onChange(null), если он был установлен', () => {
    mockCanvasRect()
    const onChange = vi.fn()
    render(<ShapeEditor value={{ kind: 'rect', width: 10, height: 10 }} onChange={onChange} />)

    fireEvent.click(screen.getByTestId('shape-editor-clear'))

    expect(screen.queryAllByTestId(/shape-editor-vertex-/)).toHaveLength(0)
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('кнопка Замкнуть задизейблена при <3 точках', () => {
    mockCanvasRect()
    render(<ShapeEditor value={null} onChange={vi.fn()} />)
    const canvas = screen.getByTestId('shape-editor-canvas')

    fireEvent.click(canvas, { clientX: 30, clientY: 30 })
    fireEvent.click(canvas, { clientX: 200, clientY: 30 })

    expect(screen.getByTestId('shape-editor-close')).toBeDisabled()
  })

  it('клик по канвасу, когда контур уже closed, ничего не добавляет', () => {
    mockCanvasRect()
    render(<ShapeEditor value={{ kind: 'rect', width: 10, height: 10 }} onChange={vi.fn()} />)
    const canvas = screen.getByTestId('shape-editor-canvas')

    fireEvent.click(canvas, { clientX: 300, clientY: 300 })

    expect(screen.getAllByTestId(/shape-editor-vertex-/)).toHaveLength(4)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/features/shape-editor`
Expected: FAIL — `clientToMm` module not found; canvas has no click handler, no toolbar buttons/testids yet.

- [ ] **Step 3: Write minimal implementation**

`src/features/shape-editor/lib/clientToMm.ts`:

```ts
import type { Point } from '@/shared/lib/geometry'
import type { ViewBox } from './fitScale'

export interface ClientRect {
  left: number
  top: number
  width: number
  height: number
}

export const clientToMm = (clientX: number, clientY: number, rect: ClientRect, viewBox: ViewBox): Point => {
  const xRatio = rect.width === 0 ? 0 : (clientX - rect.left) / rect.width
  const yRatio = rect.height === 0 ? 0 : (clientY - rect.top) / rect.height
  return { x: viewBox.x + xRatio * viewBox.width, y: viewBox.y + yRatio * viewBox.height }
}
```

`src/features/shape-editor/model/useShapeEditor.ts` — add a `svgRef`, the click handler, and `canClose` to the existing hook (full new file content):

```ts
import { useEffect, useMemo, useReducer, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Geometry } from '@/shared/lib/geometry'
import {
  editorReducer,
  geometryEquals,
  geometryFromState,
  initEditorState,
  type EditorState,
  type EditorAction,
} from '../lib/editorReducer'
import { fitScale, type ViewBox } from '../lib/fitScale'
import { boundsOfPoints } from '../lib/boundsOfPoints'
import { clientToMm } from '../lib/clientToMm'
import { snapToGrid } from '../lib/snapToGrid'

export interface UseShapeEditorResult {
  state: EditorState
  dispatch: (action: EditorAction) => void
  viewBox: ViewBox
  svgRef: React.RefObject<SVGSVGElement | null>
  canClose: boolean
  handleCanvasClick: (event: ReactPointerEvent<SVGSVGElement>) => void
}

export const useShapeEditor = (
  value: Geometry | null,
  onChange: (geometry: Geometry | null) => void,
): UseShapeEditorResult => {
  const [state, dispatch] = useReducer(editorReducer, value, initEditorState)
  const lastSyncedValueRef = useRef<Geometry | null>(value)
  const lastEmittedRef = useRef<Geometry | null>(geometryFromState(state))
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (value === lastSyncedValueRef.current) return
    lastSyncedValueRef.current = value
    dispatch({ type: 'value-synced', geometry: value })
  }, [value])

  const geometry = geometryFromState(state)
  useEffect(() => {
    if (lastSyncedValueRef.current !== value) return
    if (geometryEquals(geometry, lastEmittedRef.current)) return
    lastEmittedRef.current = geometry
    onChange(geometry)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry])

  const bounds = useMemo(() => boundsOfPoints(state.points), [state.points])
  const viewBox = useMemo(() => fitScale(bounds), [bounds])

  const handleCanvasClick = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (state.status === 'closed') return
    const svg = svgRef.current
    if (!svg) return
    const point = snapToGrid(clientToMm(event.clientX, event.clientY, svg.getBoundingClientRect(), viewBox))
    dispatch({ type: 'point-added', point })
  }

  return { state, dispatch, viewBox, svgRef, canClose: state.points.length >= 3, handleCanvasClick }
}
```

`src/features/shape-editor/ui/ShapeEditor.tsx` (full new file content):

```tsx
import clsx from 'clsx'
import type { Geometry } from '@/shared/lib/geometry'
import { useShapeEditor } from '../model/useShapeEditor'
import { formatReadout } from '../lib/formatReadout'
import { GRID_STEP_MM } from '../lib/snapToGrid'
import styles from './ShapeEditor.module.scss'

interface ShapeEditorProps {
  value: Geometry | null
  onChange: (geometry: Geometry | null) => void
}

const GRID_MAJOR_STEP_MM = GRID_STEP_MM * 10

export const ShapeEditor = ({ value, onChange }: ShapeEditorProps) => {
  const { state, dispatch, viewBox, svgRef, canClose, handleCanvasClick } = useShapeEditor(value, onChange)
  const readout = formatReadout(state)
  const contourPoints = state.status === 'closed' ? [...state.points, state.points[0]!] : state.points

  return (
    <div className={styles.root}>
      <svg
        ref={svgRef}
        className={styles.canvas}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        role="img"
        aria-label="Редактор геометрии куска"
        data-testid="shape-editor-canvas"
        onClick={handleCanvasClick}
      >
        <defs>
          <pattern id="grid-minor" width={GRID_STEP_MM} height={GRID_STEP_MM} patternUnits="userSpaceOnUse">
            <circle cx={0} cy={0} r={0.4} className={styles.gridMinorDot} />
          </pattern>
          <pattern id="grid-major" width={GRID_MAJOR_STEP_MM} height={GRID_MAJOR_STEP_MM} patternUnits="userSpaceOnUse">
            <path d={`M ${GRID_MAJOR_STEP_MM} 0 L 0 0 0 ${GRID_MAJOR_STEP_MM}`} className={styles.gridMajorLine} />
          </pattern>
        </defs>
        <rect x={viewBox.x} y={viewBox.y} width={viewBox.width} height={viewBox.height} fill="url(#grid-minor)" />
        <rect x={viewBox.x} y={viewBox.y} width={viewBox.width} height={viewBox.height} fill="url(#grid-major)" />
        {state.points.length >= 2 ? (
          <polyline
            className={clsx(styles.contour, state.intersecting && styles.contourInvalid)}
            points={contourPoints.map((point) => `${point.x},${point.y}`).join(' ')}
          />
        ) : null}
        {state.status === 'closed' ? (
          <polygon className={styles.fill} points={state.points.map((point) => `${point.x},${point.y}`).join(' ')} />
        ) : null}
        {state.points.map((point, index) => (
          <circle
            key={index}
            data-testid={`shape-editor-vertex-${index}`}
            className={styles.vertex}
            cx={point.x}
            cy={point.y}
            r={4}
          />
        ))}
      </svg>
      <p className={styles.readout}>{readout}</p>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.toolbarButton}
          data-testid="shape-editor-undo"
          disabled={state.points.length === 0}
          onClick={() => dispatch({ type: 'last-point-undone' })}
        >
          Назад
        </button>
        <button
          type="button"
          className={styles.toolbarButton}
          data-testid="shape-editor-clear"
          disabled={state.points.length === 0}
          onClick={() => dispatch({ type: 'cleared' })}
        >
          Очистить
        </button>
        <button
          type="button"
          className={styles.toolbarButton}
          data-testid="shape-editor-close"
          disabled={!canClose}
          onClick={() => dispatch({ type: 'closed-by-button' })}
        >
          Замкнуть
        </button>
      </div>
    </div>
  )
}
```

Add to `ShapeEditor.module.scss`:

```scss
.toolbar {
  display: flex;
  gap: $space-2;
  flex-wrap: wrap;
}

.toolbarButton {
  @include touch-target;
  @include tap-feedback;

  padding: 0 $space-3;
  border: 1px solid $color-border;
  border-radius: $radius-sm;
  background: $color-bg;
  color: $color-text;
  font-size: 0.875rem;

  &:disabled {
    color: $color-text-disabled;
    cursor: not-allowed;
  }

  &:focus-visible {
    @include focus-ring;
  }
}

@include reduced-motion {
  .toolbarButton {
    transition: none;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/features/shape-editor/ui/ShapeEditor`
Expected: PASS, all tests from Task 7 and Task 8 green.

- [ ] **Step 5: Commit**

```bash
git add src/features/shape-editor/ui
git commit -m "Add polygon click-to-place drawing and toolbar to ShapeEditor"
```

---

### Task 9: Rectangle drag-shortcut

**Files:**
- Modify: `src/features/shape-editor/model/useShapeEditor.ts`
- Modify: `src/features/shape-editor/ui/ShapeEditor.tsx`
- Modify: `src/features/shape-editor/ui/ShapeEditor.test.tsx`

**Interfaces:**
- Consumes: `GRID_STEP_MM` from `../lib/snapToGrid` (drag-vs-tap distance threshold, alongside the already-imported `snapToGrid`).
- Produces: `useShapeEditor` now returns `handlePointerDown`/`handlePointerUp` instead of `handleCanvasClick`, dispatching `rect-drawn` for a drag ≥1 grid step starting from 0 points, and falling back to the same `point-added` behavior as Task 8 for a short drag/tap. Task 10 (vertex drag) adds a second `onPointerDown` target (the vertex circles) that takes priority over this canvas-level handler. Task 11 adds pinch-zoom tracking that reuses these two handlers' pointer-count bookkeeping.

- [ ] **Step 1: Write the failing tests**

Add to `ShapeEditor.test.tsx`:

```tsx
describe('ShapeEditor — прямоугольник драгом', () => {
  it('драг из пустого состояния на пустом канвасе — сразу closed rect, один вызов onChange', () => {
    mockCanvasRect()
    const onChange = vi.fn()
    render(<ShapeEditor value={null} onChange={onChange} />)
    const canvas = screen.getByTestId('shape-editor-canvas')

    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 30 })
    fireEvent.pointerMove(canvas, { clientX: 200, clientY: 100 })
    fireEvent.pointerUp(canvas, { clientX: 200, clientY: 100 })

    expect(screen.getAllByTestId(/shape-editor-vertex-/)).toHaveLength(4)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0]![0].kind).toBe('rect')
  })

  it('короткий драг/тап (меньше шага сетки) — ведёт себя как обычный клик, ставит точку', () => {
    mockCanvasRect()
    render(<ShapeEditor value={null} onChange={vi.fn()} />)
    const canvas = screen.getByTestId('shape-editor-canvas')

    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 30 })
    fireEvent.pointerUp(canvas, { clientX: 31, clientY: 31 })

    expect(screen.getAllByTestId(/shape-editor-vertex-/)).toHaveLength(1)
  })

  it('драг-шорткат недоступен, если уже есть хотя бы одна точка контура', () => {
    mockCanvasRect()
    render(<ShapeEditor value={null} onChange={vi.fn()} />)
    const canvas = screen.getByTestId('shape-editor-canvas')

    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 30 })
    fireEvent.pointerUp(canvas, { clientX: 31, clientY: 31 }) // первая точка тапом

    fireEvent.pointerDown(canvas, { clientX: 100, clientY: 30 })
    fireEvent.pointerMove(canvas, { clientX: 250, clientY: 150 })
    fireEvent.pointerUp(canvas, { clientX: 250, clientY: 150 })

    // второй жест — тоже просто точка (не rect), контур продолжает строиться тапами
    expect(screen.getAllByTestId(/shape-editor-vertex-/)).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/features/shape-editor/ui/ShapeEditor`
Expected: FAIL — canvas has no pointerdown/move/up wiring yet (still plain `onClick`).

- [ ] **Step 3: Write minimal implementation**

In `useShapeEditor.ts`, change the `GRID_STEP_MM`/`snapToGrid` import to also bring in `GRID_STEP_MM`, add a drag-start ref, and replace `handleCanvasClick` with `handlePointerDown`/`handlePointerUp`:

Change the import line:

```ts
import { GRID_STEP_MM, snapToGrid } from '../lib/snapToGrid'
```

Replace the `handleCanvasClick` function and the hook's return statement with:

```ts
  const dragStartRef = useRef<Point | null>(null)

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (state.status === 'closed') return
    const svg = svgRef.current
    if (!svg) return
    dragStartRef.current = clientToMm(event.clientX, event.clientY, svg.getBoundingClientRect(), viewBox)
  }

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (state.status === 'closed') {
      dragStartRef.current = null
      return
    }
    const start = dragStartRef.current
    dragStartRef.current = null
    if (!start) return
    const svg = svgRef.current
    if (!svg) return

    const end = clientToMm(event.clientX, event.clientY, svg.getBoundingClientRect(), viewBox)
    const distanceMm = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y))
    const isDrag = distanceMm >= GRID_STEP_MM

    if (isDrag && state.points.length === 0) {
      dispatch({ type: 'rect-drawn', corner1: snapToGrid(start), corner2: snapToGrid(end) })
      return
    }
    dispatch({ type: 'point-added', point: snapToGrid(end) })
  }

  return { state, dispatch, viewBox, svgRef, canClose: state.points.length >= 3, handlePointerDown, handlePointerUp }
```

Add `Point` to the existing `import type { Geometry } from '@/shared/lib/geometry'` line, making it `import type { Geometry, Point } from '@/shared/lib/geometry'`. Add `handlePointerDown`/`handlePointerUp` to the `UseShapeEditorResult` interface in place of `handleCanvasClick`:

```ts
  handlePointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void
  handlePointerUp: (event: ReactPointerEvent<SVGSVGElement>) => void
```

In `ShapeEditor.tsx`: destructure `handlePointerDown, handlePointerUp` instead of `handleCanvasClick` from `useShapeEditor(...)`, and on the `<svg>` element replace `onClick={handleCanvasClick}` with `onPointerDown={handlePointerDown}` and `onPointerUp={handlePointerUp}`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/features/shape-editor`
Expected: PASS — all tests from Tasks 7, 8, and 9 green (Task 8's click-based tests must still pass since `fireEvent.click` in jsdom does not emit pointerdown/up on its own; update Task 8's tests that used `fireEvent.click(canvas, ...)` for point-placement to use `fireEvent.pointerDown` immediately followed by `fireEvent.pointerUp` at the same coordinates instead — edit those four call sites in the "рисование многоугольника тапами" describe block accordingly before re-running).

- [ ] **Step 5: Commit**

```bash
git add src/features/shape-editor/ui
git commit -m "Add rectangle drag shortcut to ShapeEditor"
```

---

### Task 10: Vertex drag-editing + self-intersection highlight

A separate small hook rather than folding into `useShapeEditor.ts` — vertex-dragging is a self-contained concern (its own ref, its own three handlers) that only needs `dispatch`, `svgRef`, and `viewBox` from the state hook, so it composes alongside it in `ShapeEditor.tsx` instead of growing the state hook further (keeps both hooks comfortably under the ~120-line guideline from `CLAUDE.md`).

**Files:**
- Create: `src/features/shape-editor/model/useVertexDrag.ts`
- Modify: `src/features/shape-editor/ui/ShapeEditor.tsx`
- Modify: `src/features/shape-editor/ui/ShapeEditor.module.scss`
- Modify: `src/features/shape-editor/ui/ShapeEditor.test.tsx`

**Interfaces:**
- Consumes: `clientToMm` (Task 8), `snapToGrid` (Task 2); `dispatch`, `svgRef`, `viewBox` from `useShapeEditor` (Tasks 7–9).
- Produces: `useVertexDrag({ dispatch, svgRef, viewBox })` returning `getVertexHandlers(index): { onPointerDown, onPointerMove, onPointerUp }`, spread onto each vertex `<circle>` to drag it via `vertex-moved`. `.contourInvalid` styling (already defined in Task 7) now actually activates via `state.intersecting`, and vertices get the matching `.vertexInvalid` fill.

- [ ] **Step 1: Write the failing tests**

Add to `ShapeEditor.test.tsx`:

```tsx
describe('ShapeEditor — редактирование вершины', () => {
  it('драг вершины двигает точку и вызывает onChange с пересчитанной геометрией', () => {
    mockCanvasRect()
    const onChange = vi.fn()
    render(<ShapeEditor value={{ kind: 'rect', width: 100, height: 100 }} onChange={onChange} />)

    const vertex1 = screen.getByTestId('shape-editor-vertex-1') // {x:100,y:0}

    fireEvent.pointerDown(vertex1, { clientX: 0, clientY: 0 })
    fireEvent.pointerMove(vertex1, { clientX: 50, clientY: 20 })
    fireEvent.pointerUp(vertex1, { clientX: 50, clientY: 20 })

    expect(onChange).toHaveBeenCalled()
    const [geometry] = onChange.mock.calls.at(-1)!
    expect(geometry.kind).toBe('polygon') // прямоугольник, сдвинутый не по оси, — уже не rect
  })

  it('драг вершины в самопересечение — не вызывает onChange, подсвечивает контур', () => {
    mockCanvasRect()
    const onChange = vi.fn()
    render(<ShapeEditor value={{ kind: 'rect', width: 100, height: 100 }} onChange={onChange} />)
    onChange.mockClear()

    const vertex0 = screen.getByTestId('shape-editor-vertex-0') // {x:0,y:0}
    // тащим в точку напротив ({x:100,y:100}) — превращает контур в бабочку
    fireEvent.pointerDown(vertex0, { clientX: 0, clientY: 0 })
    fireEvent.pointerUp(vertex0, { clientX: 300, clientY: 300 })

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByTestId('shape-editor-canvas').querySelector('polyline')).toHaveClass('contourInvalid')
  })
})
```

(`clientX/clientY` in these tests map through `clientToMm` using the same `mockCanvasRect` — `viewBox` for a 100×100 rect is `fitScale({0,0,100,100})` = `{x:-15,y:-15,width:130,height:130}`, so `clientX:300` at 360px-wide canvas → mm `x = -15 + (300/360)*130 ≈ 93.3`, close enough to `{x:100,y:100}` after snap to land the vertex there. Because exact pixel math is fiddly, this test only asserts the qualitative outcome — `onChange` not called and the invalid class present — not exact coordinates.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/features/shape-editor/ui/ShapeEditor`
Expected: FAIL — vertices have no pointer handlers yet.

- [ ] **Step 3: Write minimal implementation**

`src/features/shape-editor/model/useVertexDrag.ts`:

```ts
import { useRef } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { clientToMm } from '../lib/clientToMm'
import { snapToGrid } from '../lib/snapToGrid'
import type { EditorAction } from '../lib/editorReducer'
import type { ViewBox } from '../lib/fitScale'

interface UseVertexDragArgs {
  dispatch: (action: EditorAction) => void
  svgRef: RefObject<SVGSVGElement | null>
  viewBox: ViewBox
}

export const useVertexDrag = ({ dispatch, svgRef, viewBox }: UseVertexDragArgs) => {
  const draggedIndexRef = useRef<number | null>(null)

  const getVertexHandlers = (index: number) => ({
    onPointerDown: (event: ReactPointerEvent<SVGCircleElement>) => {
      event.stopPropagation() // не даём канвасу интерпретировать это как начало нового контура/rect-драга
      draggedIndexRef.current = index
    },
    onPointerMove: (event: ReactPointerEvent<SVGCircleElement>) => {
      event.stopPropagation()
      if (draggedIndexRef.current === null) return
      const svg = svgRef.current
      if (!svg) return
      const point = snapToGrid(clientToMm(event.clientX, event.clientY, svg.getBoundingClientRect(), viewBox))
      dispatch({ type: 'vertex-moved', index: draggedIndexRef.current, point })
    },
    onPointerUp: (event: ReactPointerEvent<SVGCircleElement>) => {
      event.stopPropagation()
      draggedIndexRef.current = null
    },
  })

  return { getVertexHandlers }
}
```

In `ShapeEditor.tsx`, import and call the new hook, and spread its handlers onto each vertex `<circle>`:

```tsx
import { useVertexDrag } from '../model/useVertexDrag'
```

```tsx
  const { getVertexHandlers } = useVertexDrag({ dispatch, svgRef, viewBox })
```

```tsx
        {state.points.map((point, index) => (
          <circle
            key={index}
            data-testid={`shape-editor-vertex-${index}`}
            className={clsx(styles.vertex, state.intersecting && styles.vertexInvalid)}
            cx={point.x}
            cy={point.y}
            r={4}
            {...getVertexHandlers(index)}
          />
        ))}
```

Add self-intersection color to `ShapeEditor.module.scss` (vertex should also redden while intersecting — extend the existing rule):

```scss
.vertexInvalid {
  fill: $color-red;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/features/shape-editor`
Expected: PASS, all tests from Tasks 7–10 green.

- [ ] **Step 5: Commit**

```bash
git add src/features/shape-editor/ui
git commit -m "Add vertex drag-editing and self-intersection highlight to ShapeEditor"
```

---

### Task 11: Zoom (buttons + wheel + pinch) and «По размеру»

This is the last change to `useShapeEditor.ts` — after this task it holds the full canvas-viewport/gesture concern (state sync, bounds/viewBox, click-or-drag-to-draw, pinch-and-wheel zoom). It lands noticeably over the codebase's usual ~120-line hook size (the largest existing hook, `useInsulationProgress.ts`, is 123 lines) because zoom, pinch, and single-pointer drawing all read and mutate the same pointer-tracking refs and can't be split across files without threading most of the hook's internals back and forth between two hooks. If the Task 11 reviewer calls this out, the documented fallback is extracting `applyZoom`/`handleWheel`/pinch tracking into a sibling `useZoomControls.ts` that takes `{ autoViewBox }` and returns `{ viewBox, manualViewBox, applyZoom, resetZoom }`, with `handlePointerDown`/`handlePointerUp` in `useShapeEditor.ts` calling its exported `applyZoom` instead of a local copy — raise this as an option during that task's fix round rather than pre-emptively splitting it here.

**Files:**
- Modify: `src/features/shape-editor/model/useShapeEditor.ts`
- Modify: `src/features/shape-editor/ui/ShapeEditor.tsx`
- Modify: `src/features/shape-editor/ui/ShapeEditor.module.scss`
- Modify: `src/features/shape-editor/ui/ShapeEditor.test.tsx`

**Interfaces:**
- Consumes: `plus.svg`/`minus.svg` from `@/shared/assets/icons` (already exist), `IconButton` from `@/shared/ui`.
- Produces: `useShapeEditor` now also returns `manualViewBox`, `zoomIn`, `zoomOut`, `resetZoom`, `handlePointerMove`, `handleWheel`; `ShapeEditor.tsx` wires `+`/`−` `IconButton`s (`data-testid` `shape-editor-zoom-in`/`shape-editor-zoom-out`), a `wheel` handler on the canvas, and a «По размеру» button (`data-testid="shape-editor-fit"`) that clears manual zoom. This is the last behavioral task — Task 12 only mounts the component in a real page and runs `pnpm check`.

- [ ] **Step 1: Write the failing tests**

Add to `ShapeEditor.test.tsx`:

```tsx
describe('ShapeEditor — zoom', () => {
  it('кнопка + уменьшает viewBox (приближает), кнопка По размеру возвращает авто-fit', () => {
    mockCanvasRect()
    render(<ShapeEditor value={{ kind: 'rect', width: 100, height: 100 }} onChange={vi.fn()} />)

    const initialViewBox = screen.getByTestId('shape-editor-canvas').getAttribute('viewBox')

    fireEvent.click(screen.getByTestId('shape-editor-zoom-in'))
    const zoomedViewBox = screen.getByTestId('shape-editor-canvas').getAttribute('viewBox')
    expect(zoomedViewBox).not.toBe(initialViewBox)

    const [, , zoomedWidth] = zoomedViewBox!.split(' ').map(Number)
    const [, , initialWidth] = initialViewBox!.split(' ').map(Number)
    expect(zoomedWidth!).toBeLessThan(initialWidth!) // приближение — меньший видимый мм-диапазон

    fireEvent.click(screen.getByTestId('shape-editor-fit'))
    expect(screen.getByTestId('shape-editor-canvas').getAttribute('viewBox')).toBe(initialViewBox)
  })

  it('ручной зум не сбрасывается новой точкой (авто-fit приостановлен)', () => {
    mockCanvasRect()
    render(<ShapeEditor value={null} onChange={vi.fn()} />)
    const canvas = screen.getByTestId('shape-editor-canvas')

    fireEvent.click(screen.getByTestId('shape-editor-zoom-in'))
    const zoomedViewBox = canvas.getAttribute('viewBox')

    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 30 })
    fireEvent.pointerUp(canvas, { clientX: 31, clientY: 31 })

    expect(canvas.getAttribute('viewBox')).toBe(zoomedViewBox)
  })

  it('колесо мыши на канвасе зумит', () => {
    mockCanvasRect()
    render(<ShapeEditor value={{ kind: 'rect', width: 100, height: 100 }} onChange={vi.fn()} />)
    const canvas = screen.getByTestId('shape-editor-canvas')
    const before = canvas.getAttribute('viewBox')

    fireEvent.wheel(canvas, { deltaY: -100 })

    expect(canvas.getAttribute('viewBox')).not.toBe(before)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/features/shape-editor/ui/ShapeEditor`
Expected: FAIL — no zoom buttons/wheel handler yet.

- [ ] **Step 3: Write minimal implementation**

`src/features/shape-editor/model/useShapeEditor.ts` — full new file content:

```ts
import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'
import type { Geometry, Point } from '@/shared/lib/geometry'
import {
  editorReducer,
  geometryEquals,
  geometryFromState,
  initEditorState,
  type EditorState,
  type EditorAction,
} from '../lib/editorReducer'
import { fitScale, type ViewBox } from '../lib/fitScale'
import { boundsOfPoints } from '../lib/boundsOfPoints'
import { clientToMm } from '../lib/clientToMm'
import { GRID_STEP_MM, snapToGrid } from '../lib/snapToGrid'

const ZOOM_STEP_FACTOR = 1.25
const MIN_VIEWBOX_SIZE_MM = 20
const MAX_VIEWBOX_SIZE_MM = 20_000

export interface UseShapeEditorResult {
  state: EditorState
  dispatch: (action: EditorAction) => void
  viewBox: ViewBox
  manualViewBox: ViewBox | null
  svgRef: React.RefObject<SVGSVGElement | null>
  canClose: boolean
  handlePointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void
  handlePointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void
  handlePointerUp: (event: ReactPointerEvent<SVGSVGElement>) => void
  handleWheel: (event: ReactWheelEvent<SVGSVGElement>) => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
}

export const useShapeEditor = (
  value: Geometry | null,
  onChange: (geometry: Geometry | null) => void,
): UseShapeEditorResult => {
  const [state, dispatch] = useReducer(editorReducer, value, initEditorState)
  const lastSyncedValueRef = useRef<Geometry | null>(value)
  const lastEmittedRef = useRef<Geometry | null>(geometryFromState(state))
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (value === lastSyncedValueRef.current) return
    lastSyncedValueRef.current = value
    dispatch({ type: 'value-synced', geometry: value })
  }, [value])

  const geometry = geometryFromState(state)
  useEffect(() => {
    if (lastSyncedValueRef.current !== value) return
    if (geometryEquals(geometry, lastEmittedRef.current)) return
    lastEmittedRef.current = geometry
    onChange(geometry)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry])

  const bounds = useMemo(() => boundsOfPoints(state.points), [state.points])
  const autoViewBox = useMemo(() => fitScale(bounds), [bounds])
  const [manualViewBox, setManualViewBox] = useState<ViewBox | null>(null)
  const viewBox = manualViewBox ?? autoViewBox

  const applyZoom = (factor: number) => {
    const base = manualViewBox ?? autoViewBox
    const centerX = base.x + base.width / 2
    const centerY = base.y + base.height / 2
    const width = Math.min(Math.max(base.width / factor, MIN_VIEWBOX_SIZE_MM), MAX_VIEWBOX_SIZE_MM)
    const height = Math.min(Math.max(base.height / factor, MIN_VIEWBOX_SIZE_MM), MAX_VIEWBOX_SIZE_MM)
    setManualViewBox({ x: centerX - width / 2, y: centerY - height / 2, width, height })
  }

  const handleWheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    applyZoom(event.deltaY < 0 ? ZOOM_STEP_FACTOR : 1 / ZOOM_STEP_FACTOR)
  }

  const dragStartRef = useRef<Point | null>(null)
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinchStartDistanceRef = useRef<number | null>(null)

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (activePointersRef.current.size === 2) {
      const [a, b] = [...activePointersRef.current.values()]
      pinchStartDistanceRef.current = Math.hypot(a!.x - b!.x, a!.y - b!.y)
      dragStartRef.current = null
      return
    }
    if (state.status === 'closed') return
    const svg = svgRef.current
    if (!svg) return
    dragStartRef.current = clientToMm(event.clientX, event.clientY, svg.getBoundingClientRect(), viewBox)
  }

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!activePointersRef.current.has(event.pointerId)) return
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (activePointersRef.current.size !== 2 || pinchStartDistanceRef.current === null) return
    const [a, b] = [...activePointersRef.current.values()]
    const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y)
    const factor = distance / pinchStartDistanceRef.current
    if (Math.abs(factor - 1) < 0.02) return // шум жеста — не зумим на дрожание пальцев
    applyZoom(factor)
    pinchStartDistanceRef.current = distance
  }

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    activePointersRef.current.delete(event.pointerId)
    if (activePointersRef.current.size < 2) pinchStartDistanceRef.current = null

    if (state.status === 'closed') {
      dragStartRef.current = null
      return
    }
    const start = dragStartRef.current
    dragStartRef.current = null
    if (!start) return
    const svg = svgRef.current
    if (!svg) return

    const end = clientToMm(event.clientX, event.clientY, svg.getBoundingClientRect(), viewBox)
    const distanceMm = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y))
    const isDrag = distanceMm >= GRID_STEP_MM

    if (isDrag && state.points.length === 0) {
      dispatch({ type: 'rect-drawn', corner1: snapToGrid(start), corner2: snapToGrid(end) })
      return
    }
    dispatch({ type: 'point-added', point: snapToGrid(end) })
  }

  return {
    state,
    dispatch,
    viewBox,
    manualViewBox,
    svgRef,
    canClose: state.points.length >= 3,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
    zoomIn: () => applyZoom(ZOOM_STEP_FACTOR),
    zoomOut: () => applyZoom(1 / ZOOM_STEP_FACTOR),
    resetZoom: () => setManualViewBox(null),
  }
}
```

This folds in Task 9's `handlePointerDown`/`handlePointerUp` bodies with pinch-tracking bookkeeping added at the top of each (pointer-count tracking and, for `handlePointerDown`, bailing out to pinch instead of drag once a second pointer is active), plus the new `handlePointerMove` (previously unused), `handleWheel`, `applyZoom`, and the `manualViewBox` state that makes `viewBox` a manual/auto merge instead of always-auto.

`src/features/shape-editor/ui/ShapeEditor.tsx` — full new file content:

```tsx
import clsx from 'clsx'
import type { Geometry } from '@/shared/lib/geometry'
import { useShapeEditor } from '../model/useShapeEditor'
import { useVertexDrag } from '../model/useVertexDrag'
import { formatReadout } from '../lib/formatReadout'
import { GRID_STEP_MM } from '../lib/snapToGrid'
import PlusIcon from '@/shared/assets/icons/plus.svg?react'
import MinusIcon from '@/shared/assets/icons/minus.svg?react'
import { IconButton } from '@/shared/ui'
import styles from './ShapeEditor.module.scss'

interface ShapeEditorProps {
  value: Geometry | null
  onChange: (geometry: Geometry | null) => void
}

const GRID_MAJOR_STEP_MM = GRID_STEP_MM * 10

export const ShapeEditor = ({ value, onChange }: ShapeEditorProps) => {
  const {
    state,
    dispatch,
    viewBox,
    manualViewBox,
    svgRef,
    canClose,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
    zoomIn,
    zoomOut,
    resetZoom,
  } = useShapeEditor(value, onChange)
  const { getVertexHandlers } = useVertexDrag({ dispatch, svgRef, viewBox })

  const readout = formatReadout(state)
  const contourPoints = state.status === 'closed' ? [...state.points, state.points[0]!] : state.points

  return (
    <div className={styles.root}>
      <svg
        ref={svgRef}
        className={styles.canvas}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        role="img"
        aria-label="Редактор геометрии куска"
        data-testid="shape-editor-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      >
        <defs>
          <pattern id="grid-minor" width={GRID_STEP_MM} height={GRID_STEP_MM} patternUnits="userSpaceOnUse">
            <circle cx={0} cy={0} r={0.4} className={styles.gridMinorDot} />
          </pattern>
          <pattern id="grid-major" width={GRID_MAJOR_STEP_MM} height={GRID_MAJOR_STEP_MM} patternUnits="userSpaceOnUse">
            <path d={`M ${GRID_MAJOR_STEP_MM} 0 L 0 0 0 ${GRID_MAJOR_STEP_MM}`} className={styles.gridMajorLine} />
          </pattern>
        </defs>
        <rect x={viewBox.x} y={viewBox.y} width={viewBox.width} height={viewBox.height} fill="url(#grid-minor)" />
        <rect x={viewBox.x} y={viewBox.y} width={viewBox.width} height={viewBox.height} fill="url(#grid-major)" />
        {state.points.length >= 2 ? (
          <polyline
            className={clsx(styles.contour, state.intersecting && styles.contourInvalid)}
            points={contourPoints.map((point) => `${point.x},${point.y}`).join(' ')}
          />
        ) : null}
        {state.status === 'closed' ? (
          <polygon className={styles.fill} points={state.points.map((point) => `${point.x},${point.y}`).join(' ')} />
        ) : null}
        {state.points.map((point, index) => (
          <circle
            key={index}
            data-testid={`shape-editor-vertex-${index}`}
            className={clsx(styles.vertex, state.intersecting && styles.vertexInvalid)}
            cx={point.x}
            cy={point.y}
            r={4}
            {...getVertexHandlers(index)}
          />
        ))}
      </svg>
      <p className={styles.readout}>{readout}</p>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.toolbarButton}
          data-testid="shape-editor-undo"
          disabled={state.points.length === 0}
          onClick={() => dispatch({ type: 'last-point-undone' })}
        >
          Назад
        </button>
        <button
          type="button"
          className={styles.toolbarButton}
          data-testid="shape-editor-clear"
          disabled={state.points.length === 0}
          onClick={() => dispatch({ type: 'cleared' })}
        >
          Очистить
        </button>
        <button
          type="button"
          className={styles.toolbarButton}
          data-testid="shape-editor-close"
          disabled={!canClose}
          onClick={() => dispatch({ type: 'closed-by-button' })}
        >
          Замкнуть
        </button>
        <IconButton
          icon={PlusIcon}
          label="Приблизить"
          data-testid="shape-editor-zoom-in"
          className={styles.toolbarButton}
          onClick={zoomIn}
        />
        <IconButton
          icon={MinusIcon}
          label="Отдалить"
          data-testid="shape-editor-zoom-out"
          className={styles.toolbarButton}
          onClick={zoomOut}
        />
        <button
          type="button"
          className={styles.toolbarButton}
          data-testid="shape-editor-fit"
          disabled={manualViewBox === null}
          onClick={resetZoom}
        >
          По размеру
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/features/shape-editor`
Expected: PASS, all tests from Tasks 7–11 green.

- [ ] **Step 5: Commit**

```bash
git add src/features/shape-editor/ui
git commit -m "Add zoom controls (buttons, wheel, pinch) to ShapeEditor"
```

---

### Task 12: Final integration check

**Files:**
- No new files. Verifies the whole feature end-to-end.

**Interfaces:**
- Consumes: everything from Tasks 1–11.
- Produces: nothing new — this is a verification-only task.

- [ ] **Step 1: Run the full project check**

Run: `pnpm check`
Expected: typecheck, lint, and all tests (existing suite + this plan's new tests) pass with no errors.

- [ ] **Step 2: Manual verification in browser**

Start `pnpm pb` and `pnpm dev`. `ShapeEditor` has no page wired up yet (that's the next spec — piece/group CRUD forms), so mount it temporarily for a manual smoke test: in `src/pages/insulation/ui/InsulationPage.tsx`, temporarily render `<ShapeEditor value={null} onChange={console.log} />` above the existing content, check in the browser (mouse + Chrome device-toolbar touch emulation):

- Click 3+ points on the canvas, confirm they snap visibly to the grid.
- Click «Замкнуть» — contour fills, live readout shows `polygon · X м²`.
- Draw a 4-point contour by clicking 4 axis-aligned corners in order, close it — live readout shows `rect W×H мм · X м²`.
- Drag from empty state — get an instant filled rectangle.
- Drag a vertex of a closed rect off-axis — readout flips to `polygon`.
- Drag a vertex to force a self-intersecting bow-tie — contour turns red, readout shows the intersection message, `console.log` (from `onChange`) does not fire again while invalid.
- `+`/`−` buttons zoom in/out; mouse wheel over the canvas zooms; «По размеру» returns to auto-fit; adding a new point after a manual zoom does not un-zoom.
- Tab through the toolbar buttons — visible focus-ring on each; `Назад`/`Очистить`/`Замкнуть` are keyboard-activatable with Enter/Space (native `<button>` behavior).
- Revert the temporary `InsulationPage.tsx` change (`git checkout -- src/pages/insulation/ui/InsulationPage.tsx`) once verified — it must not be committed.

- [ ] **Step 3: Confirm no leftover temporary changes**

Run: `git status`
Expected: clean working tree relative to the last commit (Task 11) — the temporary `InsulationPage.tsx` edit from Step 2 was reverted, not committed.

No commit for this task — it only verifies work already committed in Tasks 1–11.
