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
