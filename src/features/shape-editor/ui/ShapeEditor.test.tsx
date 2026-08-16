import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
