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

  const moveVertexTo = (event: ReactPointerEvent<SVGCircleElement>) => {
    if (draggedIndexRef.current === null) return
    const svg = svgRef.current
    if (!svg) return
    const point = snapToGrid(clientToMm(event.clientX, event.clientY, svg.getBoundingClientRect(), viewBox))
    dispatch({ type: 'vertex-moved', index: draggedIndexRef.current, point })
  }

  const getVertexHandlers = (index: number) => ({
    onPointerDown: (event: ReactPointerEvent<SVGCircleElement>) => {
      event.stopPropagation() // не даём канвасу интерпретировать это как начало нового контура/rect-драга
      draggedIndexRef.current = index
    },
    onPointerMove: (event: ReactPointerEvent<SVGCircleElement>) => {
      event.stopPropagation()
      moveVertexTo(event)
    },
    onPointerUp: (event: ReactPointerEvent<SVGCircleElement>) => {
      event.stopPropagation()
      // Коммитим финальную позицию и на pointerup, а не только на pointermove:
      // короткий tap-and-drop (down сразу за up, без промежуточных move) — валидный
      // жест, и последняя позиция должна применяться, даже если move ни разу не летел.
      moveVertexTo(event)
      draggedIndexRef.current = null
    },
  })

  return { getVertexHandlers }
}
