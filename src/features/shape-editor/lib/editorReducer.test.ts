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
