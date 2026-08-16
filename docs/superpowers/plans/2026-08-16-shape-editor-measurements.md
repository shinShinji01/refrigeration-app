# Замеры и постоянный размер маркеров в `features/shape-editor` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vertex markers get a constant on-screen size (with a separate ≥44px touch
hit-area), every side of the contour shows its length in mm, and a mouse-only
rubber-band preview line with live length appears while placing points.

**Architecture:** All new geometry math (segment midpoint/angle/length, offset for
label placement) is a pure function in `lib/`. Screen-constant sizing is a
px→mm conversion computed once in `useShapeEditor.ts` from a `ResizeObserver`-tracked
canvas width, exposed as plain mm numbers so `ShapeEditor.tsx` never does unit
conversion itself. Two new small presentational components
(`ShapeEditorVertex.tsx`, `SideLengthLabel.tsx`) keep `ShapeEditor.tsx` under the
~120-line guideline as it gains more to render.

**Design doc:** `docs/superpowers/specs/2026-08-16-shape-editor-measurements-design.md`
— read it before starting; this plan implements it exactly.

**Tech Stack:** React 19 + TypeScript (strict), plain SVG, SASS modules, Vitest +
React Testing Library.

## Global Constraints

- No `any` — unknown types get `unknown` + narrowing (`CLAUDE.md`).
- Named exports only, one component per file.
- Component in `ui/` doesn't know about domain/store — only props/callbacks; all
  logic lives in `lib/`/`model/`.
- Files over ~120 lines get decomposed.
- All colors/spacing/radii through SCSS tokens in `src/app/styles/_tokens.scss` —
  no hardcoded hex.
- Touch targets ≥44px (`CLAUDE.md`) — this plan's whole reason for the invisible
  hit-circle around each vertex.
- Visible focus-ring, `prefers-reduced-motion` respected for any new
  transition/highlight (none of this plan's additions animate, so nothing new to
  guard here beyond what already exists).
- `pnpm check` (typecheck + lint + test) must pass after every task before
  committing.
- Commit messages in English, imperative mood (established convention for this
  project, overrides `CLAUDE.md`'s Russian-commits default).
- Do not push to git or open a PR — stop after the local commits.

---

### Task 1: `lib/segmentLabel.ts` — pure segment geometry for labels

**Files:**
- Create: `src/features/shape-editor/lib/segmentLabel.ts`
- Create: `src/features/shape-editor/lib/segmentLabel.test.ts`

**Interfaces:**
- Consumes: `Point` from `@/shared/lib/geometry`.
- Produces: `SegmentLabel { labelPosition: Point; angleDeg: number; lengthMm: number }`,
  `segmentLabel(a: Point, b: Point, offsetMm: number): SegmentLabel | null`. Used by
  `SideLengthLabel.tsx` (Task 3) and the preview line (Task 4).

- [ ] **Step 1: Write the failing tests**

`src/features/shape-editor/lib/segmentLabel.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { segmentLabel } from './segmentLabel'

describe('segmentLabel', () => {
  it('горизонтальный отрезок слева направо — угол 0, midpoint по центру', () => {
    const result = segmentLabel({ x: 0, y: 0 }, { x: 100, y: 0 }, 0)
    expect(result).toEqual({ labelPosition: { x: 50, y: 0 }, angleDeg: 0, lengthMm: 100 })
  })

  it('тот же отрезок справа налево — угол нормализуется обратно к 0, не 180', () => {
    const result = segmentLabel({ x: 100, y: 0 }, { x: 0, y: 0 }, 0)
    expect(result).toEqual({ labelPosition: { x: 50, y: 0 }, angleDeg: 0, lengthMm: 100 })
  })

  it('вертикальный отрезок — угол 90, midpoint по центру', () => {
    const result = segmentLabel({ x: 0, y: 0 }, { x: 0, y: 100 }, 0)
    expect(result).toEqual({ labelPosition: { x: 0, y: 50 }, angleDeg: 90, lengthMm: 100 })
  })

  it('диагональ 3-4-5 (в сотнях мм) — длина и угол по формуле', () => {
    const result = segmentLabel({ x: 0, y: 0 }, { x: 300, y: 400 }, 0)
    expect(result!.lengthMm).toBe(500)
    expect(result!.angleDeg).toBeCloseTo(53.13, 1)
    expect(result!.labelPosition).toEqual({ x: 150, y: 200 })
  })

  it('наклонная сторона, направленная «справа налево и вверх» — угол в диапазоне [-90, 90]', () => {
    const result = segmentLabel({ x: 100, y: 100 }, { x: 0, y: 0 }, 0)
    expect(result!.angleDeg).toBeCloseTo(45, 1)
    expect(result!.angleDeg).toBeGreaterThanOrEqual(-90)
    expect(result!.angleDeg).toBeLessThanOrEqual(90)
  })

  it('ненулевой отступ — смещает labelPosition по нормали к отрезку', () => {
    const result = segmentLabel({ x: 0, y: 0 }, { x: 100, y: 0 }, 10)
    expect(result).toEqual({ labelPosition: { x: 50, y: 10 }, angleDeg: 0, lengthMm: 100 })
  })

  it('вырожденный отрезок (совпадающие точки) — null', () => {
    expect(segmentLabel({ x: 5, y: 5 }, { x: 5, y: 5 }, 0)).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/features/shape-editor/lib/segmentLabel`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

`src/features/shape-editor/lib/segmentLabel.ts`:

```ts
import type { Point } from '@/shared/lib/geometry'

export interface SegmentLabel {
  labelPosition: Point
  angleDeg: number
  lengthMm: number
}

// Нормаль — поворот направляющего вектора на 90° (-dy, dx), одна и та же
// сторона для любого отрезка. Для невыпуклых контуров это не гарантирует
// «снаружи фигуры» в общем случае — сознательный компромисс, см.
// docs/superpowers/specs/2026-08-16-shape-editor-measurements-design.md.
export const segmentLabel = (a: Point, b: Point, offsetMm: number): SegmentLabel | null => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthMm = Math.hypot(dx, dy)
  if (lengthMm === 0) return null

  const midX = (a.x + b.x) / 2
  const midY = (a.y + b.y) / 2
  const nx = -dy / lengthMm
  const ny = dx / lengthMm

  let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI
  if (angleDeg > 90) angleDeg -= 180
  if (angleDeg < -90) angleDeg += 180

  return {
    labelPosition: { x: midX + nx * offsetMm, y: midY + ny * offsetMm },
    angleDeg,
    lengthMm,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/features/shape-editor/lib/segmentLabel`
Expected: PASS, all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/features/shape-editor/lib/segmentLabel.ts src/features/shape-editor/lib/segmentLabel.test.ts
git commit -m "Add segmentLabel for shape-editor side-length labels"
```

---

### Task 2: Constant on-screen vertex markers + separate touch hit-area

**Files:**
- Modify: `src/features/shape-editor/model/useShapeEditor.ts`
- Create: `src/features/shape-editor/ui/ShapeEditorVertex.tsx`
- Modify: `src/features/shape-editor/ui/ShapeEditor.tsx`
- Modify: `src/features/shape-editor/ui/ShapeEditor.module.scss`
- Modify: `tests/setup.ts`
- Modify: `src/features/shape-editor/ui/ShapeEditor.test.tsx`

**Interfaces:**
- Consumes: nothing new from other tasks.
- Produces: `useShapeEditor` gains `vertexRadiusMm: number` and
  `vertexHitRadiusMm: number` in `UseShapeEditorResult`. `ShapeEditorVertex`
  component: `{ point: Point; index: number; radiusMm: number; hitRadiusMm: number;
  invalid: boolean; onHandlePointerDown/Move/Up: (event: ReactPointerEvent<SVGCircleElement>) => void }`.
  New vertex test-ids: visible circle keeps `shape-editor-vertex-{index}` (unchanged),
  new invisible drag target is `shape-editor-handle-{index}` — used by Task 3/4's
  tests and by anything driving the editor via drag in the future.

- [ ] **Step 1: Add the `ResizeObserver` mock jsdom doesn't provide**

jsdom has no `ResizeObserver`; after this task, mounting `ShapeEditor` constructs
one unconditionally, so every existing and new test needs the global mock in place
first.

Modify `tests/setup.ts` — add after the existing `afterEach` block:

```ts
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// Первый в кодовой базе тестовый файл, использующий RTL render() — без
// глобальной регистрации cleanup DOM накапливается между тестами внутри
// одного файла (нет `test.globals: true`, поэтому автодетект RTL не
// находит глобальный `afterEach`).
afterEach(() => {
  cleanup()
})

// jsdom не реализует ResizeObserver — features/shape-editor использует его
// для постоянного на экране размера маркеров вершин (см.
// docs/superpowers/specs/2026-08-16-shape-editor-measurements-design.md).
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!('ResizeObserver' in globalThis)) {
  // @ts-expect-error — минимальный мок, не полная реализация DOM-интерфейса
  globalThis.ResizeObserver = ResizeObserverMock
}
```

- [ ] **Step 2: Write the failing tests**

These rely on `mockCanvasRect()` already defined in the test file (returns
`width: 360`), and on the existing `-30 -30 260 260` empty-state viewBox comment
already present in the file. Add a new `describe` block at the end of
`src/features/shape-editor/ui/ShapeEditor.test.tsx`:

```ts
describe('ShapeEditor — постоянный размер маркеров вершин', () => {
  it('видимый кружок и невидимая тач-зона имеют разный радиус, посчитанный из viewBox', () => {
    mockCanvasRect()
    render(<ShapeEditor value={{ kind: 'rect', width: 100, height: 100 }} onChange={vi.fn()} />)

    // bounds 0..100 -> content зажат в MIN_CONTENT_SIZE_MM(20) не нужен (100>20),
    // size = 100*1.3 = 130, viewBox.width = 130, canvasPixelSize = 360 (мок)
    // mmPerPx = 130/360 = 0.3611...
    const visible = screen.getByTestId('shape-editor-vertex-0')
    const handle = screen.getByTestId('shape-editor-handle-0')

    expect(Number(visible.getAttribute('r'))).toBeCloseTo(6 * (130 / 360), 1)
    expect(Number(handle.getAttribute('r'))).toBeCloseTo(22 * (130 / 360), 1)
    expect(Number(handle.getAttribute('r'))).toBeGreaterThan(Number(visible.getAttribute('r')))
  })

  it('видимый кружок не перехватывает pointer-события (pointer-events: none)', () => {
    mockCanvasRect()
    render(<ShapeEditor value={{ kind: 'rect', width: 100, height: 100 }} onChange={vi.fn()} />)

    const visible = screen.getByTestId('shape-editor-vertex-0')
    expect(getComputedStyle(visible).pointerEvents).toBe('none')
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run src/features/shape-editor/ui/ShapeEditor`
Expected: FAIL — `shape-editor-handle-0` test-id doesn't exist yet, `r` attributes
still fixed at `4`.

- [ ] **Step 4: Add px→mm sizing to `useShapeEditor.ts`**

In `src/features/shape-editor/model/useShapeEditor.ts`, change the react import at
the top of the file:

```ts
import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
```

Add new constants right after the existing `MAX_VIEWBOX_SIZE_MM` constant:

```ts
const MAX_VIEWBOX_SIZE_MM = 20_000

// Реальная ширина канваса в px — CSS даёт только max-width:360px, на телефоне
// контейнер часто уже. Нужна, чтобы маркеры вершин имели постоянный размер на
// экране при любом зуме/размере фигуры, а не фиксированный размер в мм чертежа
// (см. docs/superpowers/specs/2026-08-16-shape-editor-measurements-design.md).
const DEFAULT_CANVAS_PIXEL_SIZE = 360
const VERTEX_VISIBLE_RADIUS_PX = 6
const VERTEX_HIT_RADIUS_PX = 22 // диаметр 44px — тач-таргет, CLAUDE.md
```

Add `vertexRadiusMm: number` and `vertexHitRadiusMm: number` to
`UseShapeEditorResult`, right after `canClose: boolean`:

```ts
  canClose: boolean
  vertexRadiusMm: number
  vertexHitRadiusMm: number
```

Inside the hook body, add the `ResizeObserver` effect right after the `svgRef`
declaration (`const svgRef = useRef<SVGSVGElement>(null)`), before the existing
`value`-sync `useEffect`:

```ts
  const svgRef = useRef<SVGSVGElement>(null)

  const [canvasPixelSize, setCanvasPixelSize] = useState(DEFAULT_CANVAS_PIXEL_SIZE)
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width) setCanvasPixelSize(width)
    })
    observer.observe(svg)
    return () => observer.disconnect()
  }, [])
```

Right after the existing `const viewBox = manualViewBox ?? autoViewBox` line, add:

```ts
  const mmPerPx = viewBox.width / canvasPixelSize
  const vertexRadiusMm = VERTEX_VISIBLE_RADIUS_PX * mmPerPx
  const vertexHitRadiusMm = VERTEX_HIT_RADIUS_PX * mmPerPx
```

Add the two new fields to the returned object, right after `canClose: state.points.length >= 3,`:

```ts
    canClose: state.points.length >= 3,
    vertexRadiusMm,
    vertexHitRadiusMm,
```

- [ ] **Step 5: Create `ShapeEditorVertex.tsx`**

`src/features/shape-editor/ui/ShapeEditorVertex.tsx`:

```tsx
import clsx from 'clsx'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Point } from '@/shared/lib/geometry'
import styles from './ShapeEditor.module.scss'

interface ShapeEditorVertexProps {
  point: Point
  index: number
  radiusMm: number
  hitRadiusMm: number
  invalid: boolean
  onHandlePointerDown: (event: ReactPointerEvent<SVGCircleElement>) => void
  onHandlePointerMove: (event: ReactPointerEvent<SVGCircleElement>) => void
  onHandlePointerUp: (event: ReactPointerEvent<SVGCircleElement>) => void
}

// Два круга в одной точке: невидимый несёт весь drag и держит тач-таргет
// ≥44px (CLAUDE.md) независимо от того, насколько компактно рисуется видимый —
// см. docs/superpowers/specs/2026-08-16-shape-editor-measurements-design.md.
export const ShapeEditorVertex = ({
  point,
  index,
  radiusMm,
  hitRadiusMm,
  invalid,
  onHandlePointerDown,
  onHandlePointerMove,
  onHandlePointerUp,
}: ShapeEditorVertexProps) => (
  <g>
    <circle
      data-testid={`shape-editor-handle-${index}`}
      className={styles.vertexHandle}
      cx={point.x}
      cy={point.y}
      r={hitRadiusMm}
      onPointerDown={onHandlePointerDown}
      onPointerMove={onHandlePointerMove}
      onPointerUp={onHandlePointerUp}
    />
    <circle
      data-testid={`shape-editor-vertex-${index}`}
      className={clsx(styles.vertex, invalid && styles.vertexInvalid)}
      cx={point.x}
      cy={point.y}
      r={radiusMm}
    />
  </g>
)
```

- [ ] **Step 6: Wire `ShapeEditorVertex` into `ShapeEditor.tsx`**

In `src/features/shape-editor/ui/ShapeEditor.tsx`, add the import:

```ts
import { ShapeEditorVertex } from './ShapeEditorVertex'
```

Add `vertexRadiusMm, vertexHitRadiusMm` to the destructuring of `useShapeEditor(...)`:

```ts
  const {
    state,
    dispatch,
    viewBox,
    manualViewBox,
    svgRef,
    canClose,
    vertexRadiusMm,
    vertexHitRadiusMm,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
    zoomIn,
    zoomOut,
    resetZoom,
  } = useShapeEditor(value, onChange)
```

Replace the existing vertex-rendering block:

```tsx
        {state.points.map((point, index) => (
          <circle
            key={index}
            data-testid={`shape-editor-vertex-${index}`}
            className={clsx(styles.vertex, state.intersecting && styles.vertexInvalid)}
            cx={point.x}
            cy={point.y}
            // r={4}мм ≈ 11-22px на экране — меньше гайдлайна CLAUDE.md в 44px тач-таргета.
            // Оставлено как есть: pointer capture (см. useVertexDrag.ts) снимает риск потери
            // драга при промахе мимо кружка. Увеличение самой зоны попадания — известная
            // отложенная доработка (не привязана к конкретной задаче плана): она завязана на
            // мм→px пересчёт, который меняется с зумом (см. applyZoom в useShapeEditor.ts).
            r={4}
            {...getVertexHandlers(index)}
          />
        ))}
```

with:

```tsx
        {state.points.map((point, index) => {
          const handlers = getVertexHandlers(index)
          return (
            <ShapeEditorVertex
              key={index}
              point={point}
              index={index}
              radiusMm={vertexRadiusMm}
              hitRadiusMm={vertexHitRadiusMm}
              invalid={state.intersecting}
              onHandlePointerDown={handlers.onPointerDown}
              onHandlePointerMove={handlers.onPointerMove}
              onHandlePointerUp={handlers.onPointerUp}
            />
          )
        })}
```

The `clsx` import in `ShapeEditor.tsx` stays — it's still used for the `.contour`
class further up.

- [ ] **Step 7: Move `.vertex`/`.vertexInvalid` to non-interactive, add `.vertexHandle`**

In `src/features/shape-editor/ui/ShapeEditor.module.scss`, replace:

```scss
.vertex {
  fill: $color-accent-cyan;
  stroke: $color-white;
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.vertexInvalid {
  fill: $color-red;
}
```

with:

```scss
.vertex {
  fill: $color-accent-cyan;
  stroke: $color-white;
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
  pointer-events: none; // весь drag — на .vertexHandle под ним
}

.vertexInvalid {
  fill: $color-red;
}

.vertexHandle {
  fill: transparent;
}
```

- [ ] **Step 8: Update existing vertex-drag tests to target the new handle test-id**

The existing "ShapeEditor — редактирование вершины" tests in
`src/features/shape-editor/ui/ShapeEditor.test.tsx` fire pointer events on
`shape-editor-vertex-{index}`, which no longer carries any handlers. Replace both
occurrences:

```ts
    const vertex1 = screen.getByTestId('shape-editor-vertex-1') // {x:100,y:0}
```

with:

```ts
    const vertex1 = screen.getByTestId('shape-editor-handle-1') // {x:100,y:0}
```

and:

```ts
    const vertex0 = screen.getByTestId('shape-editor-vertex-0') // {x:0,y:0}
```

with:

```ts
    const vertex0 = screen.getByTestId('shape-editor-handle-0') // {x:0,y:0}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `pnpm vitest run src/features/shape-editor`
Expected: PASS — all existing tests still green (vertex-drag tests now target the
handle), plus the two new tests from Step 2.

- [ ] **Step 10: Run full check**

Run: `pnpm check`
Expected: typecheck, lint, and full test suite all pass.

- [ ] **Step 11: Commit**

```bash
git add src/features/shape-editor/model/useShapeEditor.ts src/features/shape-editor/ui/ShapeEditorVertex.tsx src/features/shape-editor/ui/ShapeEditor.tsx src/features/shape-editor/ui/ShapeEditor.module.scss tests/setup.ts src/features/shape-editor/ui/ShapeEditor.test.tsx
git commit -m "Give shape-editor vertex markers a constant on-screen size with a separate touch hit-area"
```

---

### Task 3: Side-length labels on every side of the contour

**Files:**
- Create: `src/features/shape-editor/ui/SideLengthLabel.tsx`
- Modify: `src/features/shape-editor/model/useShapeEditor.ts`
- Modify: `src/features/shape-editor/ui/ShapeEditor.tsx`
- Modify: `src/features/shape-editor/ui/ShapeEditor.module.scss`
- Modify: `src/features/shape-editor/ui/ShapeEditor.test.tsx`

**Interfaces:**
- Consumes: `SegmentLabel`, `segmentLabel` from `../lib/segmentLabel` (Task 1).
- Produces: `useShapeEditor` gains `labelFontSizeMm: number` and
  `labelOffsetMm: number` in `UseShapeEditorResult`. `SideLengthLabel` component:
  `{ label: SegmentLabel; fontSizeMm: number; testId: string }`. Reused by the
  preview line in Task 4.

- [ ] **Step 1: Write the failing tests**

Add to `src/features/shape-editor/ui/ShapeEditor.test.tsx`:

```ts
describe('ShapeEditor — подписи длины сторон', () => {
  it('замкнутый прямоугольник — 4 подписи по 100мм', () => {
    mockCanvasRect()
    render(<ShapeEditor value={{ kind: 'rect', width: 100, height: 100 }} onChange={vi.fn()} />)

    const labels = screen.getAllByTestId(/shape-editor-side-label-/)
    expect(labels).toHaveLength(4)
    labels.forEach((label) => expect(label).toHaveTextContent('100мм'))
  })

  it('во время рисования — подписи только у уже поставленных сторон, не у замыкающей', () => {
    mockCanvasRect()
    render(<ShapeEditor value={null} onChange={vi.fn()} />)
    const canvas = screen.getByTestId('shape-editor-canvas')

    // те же клики, что и в "три клика + замыкание кнопкой" выше — 3 точки, ещё не замкнуто
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 30 })
    fireEvent.pointerUp(canvas, { clientX: 30, clientY: 30 })
    fireEvent.pointerDown(canvas, { clientX: 200, clientY: 30 })
    fireEvent.pointerUp(canvas, { clientX: 200, clientY: 30 })
    fireEvent.pointerDown(canvas, { clientX: 200, clientY: 200 })
    fireEvent.pointerUp(canvas, { clientX: 200, clientY: 200 })

    // 3 точки, не замкнуто -> 2 стороны (между 1-2 и 2-3), не 3
    expect(screen.getAllByTestId(/shape-editor-side-label-/)).toHaveLength(2)
  })

  it('пустой канвас — подписей нет', () => {
    mockCanvasRect()
    render(<ShapeEditor value={null} onChange={vi.fn()} />)
    expect(screen.queryAllByTestId(/shape-editor-side-label-/)).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/features/shape-editor/ui/ShapeEditor`
Expected: FAIL — no `shape-editor-side-label-` elements exist yet.

- [ ] **Step 3: Add label sizing to `useShapeEditor.ts`**

Add two new constants right after `VERTEX_HIT_RADIUS_PX` (added in Task 2):

```ts
const VERTEX_HIT_RADIUS_PX = 22 // диаметр 44px — тач-таргет, CLAUDE.md
const LABEL_FONT_SIZE_PX = 11
const LABEL_OFFSET_PX = 14
```

Add `labelFontSizeMm: number` and `labelOffsetMm: number` to
`UseShapeEditorResult`, right after `vertexHitRadiusMm: number`:

```ts
  vertexHitRadiusMm: number
  labelFontSizeMm: number
  labelOffsetMm: number
```

Right after the `vertexHitRadiusMm` computation added in Task 2, add:

```ts
  const vertexHitRadiusMm = VERTEX_HIT_RADIUS_PX * mmPerPx
  const labelFontSizeMm = LABEL_FONT_SIZE_PX * mmPerPx
  const labelOffsetMm = LABEL_OFFSET_PX * mmPerPx
```

Add the two new fields to the returned object, right after `vertexHitRadiusMm,`:

```ts
    vertexHitRadiusMm,
    labelFontSizeMm,
    labelOffsetMm,
```

- [ ] **Step 4: Create `SideLengthLabel.tsx`**

`src/features/shape-editor/ui/SideLengthLabel.tsx`:

```tsx
import type { SegmentLabel } from '../lib/segmentLabel'
import styles from './ShapeEditor.module.scss'

interface SideLengthLabelProps {
  label: SegmentLabel
  fontSizeMm: number
  testId: string
}

export const SideLengthLabel = ({ label, fontSizeMm, testId }: SideLengthLabelProps) => (
  <text
    data-testid={testId}
    className={styles.sideLabel}
    x={label.labelPosition.x}
    y={label.labelPosition.y}
    transform={`rotate(${label.angleDeg} ${label.labelPosition.x} ${label.labelPosition.y})`}
    fontSize={fontSizeMm}
  >
    {Math.round(label.lengthMm)}мм
  </text>
)
```

- [ ] **Step 5: Render side labels in `ShapeEditor.tsx`**

Add the imports:

```ts
import { segmentLabel } from '../lib/segmentLabel'
import { SideLengthLabel } from './SideLengthLabel'
```

Add `labelFontSizeMm, labelOffsetMm` to the destructuring of `useShapeEditor(...)`
(same block edited in Task 2 Step 6):

```ts
    vertexRadiusMm,
    vertexHitRadiusMm,
    labelFontSizeMm,
    labelOffsetMm,
```

Right after the existing vertex-rendering block (the `{state.points.map(...)}`
block from Task 2 Step 6), add:

```tsx
        {contourPoints.slice(0, -1).map((point, index) => {
          const next = contourPoints[index + 1]!
          const label = segmentLabel(point, next, labelOffsetMm)
          if (!label) return null
          return (
            <SideLengthLabel
              key={index}
              label={label}
              fontSizeMm={labelFontSizeMm}
              testId={`shape-editor-side-label-${index}`}
            />
          )
        })}
```

`contourPoints` already exists earlier in the file (`const contourPoints = state.status === 'closed' ? [...state.points, state.points[0]!] : state.points`)
and already correctly includes the closing segment only when `status === 'closed'`
— no new branching needed for the drawing-vs-closed distinction.

- [ ] **Step 6: Add `.sideLabel` style**

In `src/features/shape-editor/ui/ShapeEditor.module.scss`, add after `.vertexHandle`:

```scss
.sideLabel {
  fill: $color-text-muted;
  font-family: $font-family-mono;
  text-anchor: middle;
  dominant-baseline: middle;
  user-select: none;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm vitest run src/features/shape-editor`
Expected: PASS — all tests green, including the 3 new ones from Step 1.

- [ ] **Step 8: Run full check**

Run: `pnpm check`
Expected: typecheck, lint, and full test suite all pass.

- [ ] **Step 9: Commit**

```bash
git add src/features/shape-editor/ui/SideLengthLabel.tsx src/features/shape-editor/model/useShapeEditor.ts src/features/shape-editor/ui/ShapeEditor.tsx src/features/shape-editor/ui/ShapeEditor.module.scss src/features/shape-editor/ui/ShapeEditor.test.tsx
git commit -m "Show side length labels on the shape-editor contour"
```

---

### Task 4: Live mouse-only preview line while drawing

**Files:**
- Modify: `src/features/shape-editor/model/useShapeEditor.ts`
- Modify: `src/features/shape-editor/ui/ShapeEditor.tsx`
- Modify: `src/features/shape-editor/ui/ShapeEditor.module.scss`
- Modify: `src/features/shape-editor/ui/ShapeEditor.test.tsx`

**Interfaces:**
- Consumes: `segmentLabel` (Task 1), `SideLengthLabel` (Task 3).
- Produces: `useShapeEditor` gains `hoverPointMm: Point | null` and
  `handlePointerLeave: () => void` in `UseShapeEditorResult`.

- [ ] **Step 1: Write the failing tests**

Add to `src/features/shape-editor/ui/ShapeEditor.test.tsx`:

```ts
describe('ShapeEditor — превью-линия при рисовании (мышь)', () => {
  it('движение мыши после первой точки рисует превью-линию и подпись длины', () => {
    mockCanvasRect()
    render(<ShapeEditor value={null} onChange={vi.fn()} />)
    const canvas = screen.getByTestId('shape-editor-canvas')

    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 30 })
    fireEvent.pointerUp(canvas, { clientX: 30, clientY: 30 })
    expect(screen.queryByTestId('shape-editor-preview-line')).not.toBeInTheDocument()

    fireEvent.pointerMove(canvas, { clientX: 200, clientY: 30, pointerType: 'mouse' })

    expect(screen.getByTestId('shape-editor-preview-line')).toBeInTheDocument()
    expect(screen.getByTestId('shape-editor-preview-label')).toHaveTextContent(/^\d+мм$/)
  })

  it('превью-линия реагирует на новое положение мыши', () => {
    mockCanvasRect()
    render(<ShapeEditor value={null} onChange={vi.fn()} />)
    const canvas = screen.getByTestId('shape-editor-canvas')

    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 30 })
    fireEvent.pointerUp(canvas, { clientX: 30, clientY: 30 })

    fireEvent.pointerMove(canvas, { clientX: 150, clientY: 30, pointerType: 'mouse' })
    const firstX2 = screen.getByTestId('shape-editor-preview-line').getAttribute('x2')

    fireEvent.pointerMove(canvas, { clientX: 250, clientY: 30, pointerType: 'mouse' })
    const secondX2 = screen.getByTestId('shape-editor-preview-line').getAttribute('x2')

    expect(secondX2).not.toBe(firstX2)
  })

  it('на touch превью-линия не рисуется', () => {
    mockCanvasRect()
    render(<ShapeEditor value={null} onChange={vi.fn()} />)
    const canvas = screen.getByTestId('shape-editor-canvas')

    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 30 })
    fireEvent.pointerUp(canvas, { clientX: 30, clientY: 30 })
    fireEvent.pointerMove(canvas, { clientX: 200, clientY: 30, pointerType: 'touch' })

    expect(screen.queryByTestId('shape-editor-preview-line')).not.toBeInTheDocument()
  })

  it('уход курсора с канваса убирает превью-линию', () => {
    mockCanvasRect()
    render(<ShapeEditor value={null} onChange={vi.fn()} />)
    const canvas = screen.getByTestId('shape-editor-canvas')

    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 30 })
    fireEvent.pointerUp(canvas, { clientX: 30, clientY: 30 })
    fireEvent.pointerMove(canvas, { clientX: 200, clientY: 30, pointerType: 'mouse' })
    expect(screen.getByTestId('shape-editor-preview-line')).toBeInTheDocument()

    fireEvent.pointerLeave(canvas)
    expect(screen.queryByTestId('shape-editor-preview-line')).not.toBeInTheDocument()
  })

  it('на замкнутом контуре превью-линия не рисуется, даже если мышь двигалась раньше', () => {
    mockCanvasRect()
    render(<ShapeEditor value={{ kind: 'rect', width: 100, height: 100 }} onChange={vi.fn()} />)
    const canvas = screen.getByTestId('shape-editor-canvas')

    fireEvent.pointerMove(canvas, { clientX: 200, clientY: 30, pointerType: 'mouse' })

    expect(screen.queryByTestId('shape-editor-preview-line')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/features/shape-editor/ui/ShapeEditor`
Expected: FAIL — no `shape-editor-preview-line`/`shape-editor-preview-label`
elements, `handlePointerMove` doesn't track hover yet.

- [ ] **Step 3: Add hover tracking to `useShapeEditor.ts`**

Add `hoverPointMm: Point | null` and `handlePointerLeave: () => void` to
`UseShapeEditorResult`, right after `handlePointerUp`:

```ts
  handlePointerUp: (event: ReactPointerEvent<SVGSVGElement>) => void
  handlePointerLeave: () => void
```

and add `hoverPointMm: Point | null` right after `labelOffsetMm: number`:

```ts
  labelOffsetMm: number
  hoverPointMm: Point | null
```

Declare the state right after the existing `pinchStartDistanceRef` declaration:

```ts
  const pinchStartDistanceRef = useRef<number | null>(null)
  const [hoverPointMm, setHoverPointMm] = useState<Point | null>(null)
```

Replace the existing `handlePointerMove`:

```ts
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
```

with:

```ts
  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    // Живая линия-превью — только мышь: на touch нет hover до касания, и
    // отдельный touch-жест «драг перед отпусканием» сознательно не делаем
    // (docs/superpowers/specs/2026-08-16-shape-editor-measurements-design.md).
    // Не завязана на activePointersRef — обычный hover-move без
    // предшествующего pointerdown тоже должен обновлять превью.
    if (event.pointerType === 'mouse' && state.status !== 'closed' && activePointersRef.current.size < 2) {
      const svg = svgRef.current
      if (svg) {
        setHoverPointMm(snapToGrid(clientToMm(event.clientX, event.clientY, svg.getBoundingClientRect(), viewBox)))
      }
    }

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
```

Add `handlePointerLeave` right after the existing `handlePointerUp` function body
(before the `return` statement):

```ts
  const handlePointerLeave = () => setHoverPointMm(null)
```

Add `hoverPointMm` and `handlePointerLeave` to the returned object, right after
`labelOffsetMm,` and right after `handlePointerUp,` respectively:

```ts
    labelOffsetMm,
    hoverPointMm,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
```

- [ ] **Step 4: Wire the preview line into `ShapeEditor.tsx`**

Add `hoverPointMm, handlePointerLeave` to the destructuring of
`useShapeEditor(...)`:

```ts
    labelFontSizeMm,
    labelOffsetMm,
    hoverPointMm,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
    handleWheel,
```

Add `onPointerLeave={handlePointerLeave}` to the `<svg>` element, next to the
existing `onWheel={handleWheel}`:

```tsx
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onWheel={handleWheel}
```

Right after the side-labels block added in Task 3 Step 5, add:

```tsx
        {state.status === 'drawing' && state.points.length > 0 && hoverPointMm ? (
          (() => {
            const lastPoint = state.points[state.points.length - 1]!
            const preview = segmentLabel(lastPoint, hoverPointMm, labelOffsetMm)
            return (
              <>
                <line
                  data-testid="shape-editor-preview-line"
                  className={styles.previewLine}
                  x1={lastPoint.x}
                  y1={lastPoint.y}
                  x2={hoverPointMm.x}
                  y2={hoverPointMm.y}
                />
                {preview ? (
                  <SideLengthLabel
                    label={preview}
                    fontSizeMm={labelFontSizeMm}
                    testId="shape-editor-preview-label"
                  />
                ) : null}
              </>
            )
          })()
        ) : null}
```

- [ ] **Step 5: Add `.previewLine` style**

In `src/features/shape-editor/ui/ShapeEditor.module.scss`, add after `.sideLabel`:

```scss
.previewLine {
  fill: none;
  stroke: $color-accent-cyan;
  stroke-width: 2;
  stroke-dasharray: 4 3;
  opacity: 0.6;
  vector-effect: non-scaling-stroke;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm vitest run src/features/shape-editor`
Expected: PASS — all tests green, including the 5 new ones from Step 1.

- [ ] **Step 7: Run full check**

Run: `pnpm check`
Expected: typecheck, lint, and full test suite all pass.

- [ ] **Step 8: Commit**

```bash
git add src/features/shape-editor/model/useShapeEditor.ts src/features/shape-editor/ui/ShapeEditor.tsx src/features/shape-editor/ui/ShapeEditor.module.scss src/features/shape-editor/ui/ShapeEditor.test.tsx
git commit -m "Add mouse-only rubber-band preview line with live length to shape-editor"
```

---

### Task 5: Final integration check

**Files:**
- No new files. Verifies the whole increment end-to-end.

**Interfaces:**
- Consumes: everything from Tasks 1-4.
- Produces: nothing new — verification only.

- [ ] **Step 1: Run the full project check**

Run: `pnpm check`
Expected: typecheck, lint, and all tests (existing suite + this plan's new tests)
pass with no errors.

- [ ] **Step 2: Manual verification in browser**

Start `pnpm pb` (from the main repo checkout, which has real data — the worktree
has no local PocketBase binary/data) and `pnpm dev` from this worktree. If
`src/pages/insulation/ui/InsulationPage.tsx` doesn't already have the temporary
`<ShapeEditor value={null} onChange={(g) => console.log('onChange', g)} />` mount
from the previous plan's Task 12 (check with `git status` — it's intentionally
never committed), add it back the same way: import `ShapeEditor` from
`@/features/shape-editor` and render it above `<InsulationFilterBar />`, wrapped in
a `<div style={{ width: 400, border: '1px solid red' }}>`.

In the browser (mouse + Chrome device-toolbar touch emulation), check:

- Vertex markers are visibly smaller/more precise than before, at the default
  zoom, after zooming in with `+`, and after zooming out with `−` — the visible
  dot stays roughly the same size on screen at every zoom level.
- On touch emulation, dragging a vertex still works reliably even when the tap
  isn't pixel-perfect on the small visible dot (the invisible ≥44px hit-area is
  doing its job).
- Every side of a closed rectangle shows a length label (`100мм` etc.), rotated to
  match the side, not overlapping the contour line.
- While drawing a polygon by clicking points, each already-placed side shows its
  length; the segment from the last point to the current mouse position shows a
  dashed preview line with a live length label that updates as the mouse moves.
- Switching to touch emulation and tapping to place points: no preview line
  appears at any point (mouse-only, as designed) — only the labels on already
  placed sides.
- Moving the mouse off the canvas clears the preview line; moving it back over an
  open contour brings it back.
- `console.log` (from `onChange`) still fires the same way it did before this
  plan — this increment doesn't touch the reducer/`onChange` contract.
- Revert the temporary `InsulationPage.tsx` change (`git checkout -- src/pages/insulation/ui/InsulationPage.tsx`)
  once verified — it must not be committed.

- [ ] **Step 3: Confirm no leftover temporary changes**

Run: `git status`
Expected: clean working tree relative to the last commit (Task 4) — the temporary
`InsulationPage.tsx` edit from Step 2 was reverted, not committed.

No commit for this task — it only verifies work already committed in Tasks 1-4.
