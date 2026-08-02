import { describe, expect, it } from 'vitest'
import { formatArea } from './formatArea'

describe('formatArea', () => {
  it('маленькую площадь показывает в см²', () => {
    expect(formatArea(2640)).toBe('26.4 см²')
  })

  it('площадь от 1м² показывает в м²', () => {
    expect(formatArea(1_500_000)).toBe('1.50 м²')
  })

  it('ровно 1м² — граница переключения единиц', () => {
    expect(formatArea(1_000_000)).toBe('1.00 м²')
  })
})
