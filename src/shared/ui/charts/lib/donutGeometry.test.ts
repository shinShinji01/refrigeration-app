import { describe, expect, it } from 'vitest'
import { computeDonutGeometry } from './donutGeometry'

describe('computeDonutGeometry', () => {
  it('делит окружность пропорционально значениям, с зазором между сегментами', () => {
    const result = computeDonutGeometry(
      [
        { id: 'a', value: 1 },
        { id: 'b', value: 1 },
        { id: 'c', value: 2 },
      ],
      400,
    )
    expect(result).toEqual([
      { id: 'a', dasharray: '97 303', dashoffset: 0 },
      { id: 'b', dasharray: '97 303', dashoffset: -100 },
      { id: 'c', dasharray: '197 203', dashoffset: -200 },
    ])
  })

  it('единственный сегмент — без зазора, занимает всю окружность', () => {
    const result = computeDonutGeometry([{ id: 'a', value: 5 }], 400)
    expect(result).toEqual([{ id: 'a', dasharray: '400 0', dashoffset: 0 }])
  })

  it('пустой список — пустой результат', () => {
    expect(computeDonutGeometry([], 400)).toEqual([])
  })

  it('нулевая сумма значений — пустой результат, без деления на ноль', () => {
    expect(computeDonutGeometry([{ id: 'a', value: 0 }], 400)).toEqual([])
  })
})
