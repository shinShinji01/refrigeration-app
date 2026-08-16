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
