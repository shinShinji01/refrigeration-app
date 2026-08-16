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
