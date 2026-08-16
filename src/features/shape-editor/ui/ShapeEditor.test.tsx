import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ShapeEditor } from './ShapeEditor'
import styles from './ShapeEditor.module.scss'

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
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 30 })
    fireEvent.pointerUp(canvas, { clientX: 30, clientY: 30 })
    fireEvent.pointerDown(canvas, { clientX: 200, clientY: 30 })
    fireEvent.pointerUp(canvas, { clientX: 200, clientY: 30 })
    fireEvent.pointerDown(canvas, { clientX: 200, clientY: 200 })
    fireEvent.pointerUp(canvas, { clientX: 200, clientY: 200 })

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

    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 30 })
    fireEvent.pointerUp(canvas, { clientX: 30, clientY: 30 })
    fireEvent.pointerDown(canvas, { clientX: 200, clientY: 30 })
    fireEvent.pointerUp(canvas, { clientX: 200, clientY: 30 })
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

    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 30 })
    fireEvent.pointerUp(canvas, { clientX: 30, clientY: 30 })
    fireEvent.pointerDown(canvas, { clientX: 200, clientY: 30 })
    fireEvent.pointerUp(canvas, { clientX: 200, clientY: 30 })

    expect(screen.getByTestId('shape-editor-close')).toBeDisabled()
  })

  it('клик по канвасу, когда контур уже closed, ничего не добавляет', () => {
    mockCanvasRect()
    render(<ShapeEditor value={{ kind: 'rect', width: 10, height: 10 }} onChange={vi.fn()} />)
    const canvas = screen.getByTestId('shape-editor-canvas')

    fireEvent.pointerDown(canvas, { clientX: 300, clientY: 300 })
    fireEvent.pointerUp(canvas, { clientX: 300, clientY: 300 })

    expect(screen.getAllByTestId(/shape-editor-vertex-/)).toHaveLength(4)
  })
})

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
    // Брифовые clientX:300,clientY:300 маппятся через clientToMm в mm (95,95) —
    // это НЕ самопересекающийся контур (точка (95,95) не выходит за пределы старого
    // прямоугольника настолько, чтобы рёбра пересеклись). Подобранные ниже координаты
    // маппятся в mm (50,200) — ребро (v0,v1) пересекает ребро (v2,v3), настоящая «бабочка».
    fireEvent.pointerDown(vertex0, { clientX: 0, clientY: 0 })
    fireEvent.pointerUp(vertex0, { clientX: 180, clientY: 595 })

    expect(onChange).not.toHaveBeenCalled()
    // CSS-модуль скопирует имя класса (напр. `_contourInvalid_99a37c`) — сравнение с
    // литералом 'contourInvalid' никогда не совпадёт, сверяемся со styles.contourInvalid,
    // как это делает сам компонент.
    expect(screen.getByTestId('shape-editor-canvas').querySelector('polyline')).toHaveClass(styles.contourInvalid!)
  })
})

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
