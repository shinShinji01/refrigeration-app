import { describe, expect, it } from 'vitest'
import { applyBulk } from './applyBulk'

const piece = (linkId: string, quantity: number) => ({ linkId, quantity })

describe('applyBulk', () => {
  it('пишет quantity каждому куску при done=true', () => {
    expect(applyBulk({}, [piece('gp-1', 2), piece('gp-2', 5)], true)).toEqual({ 'gp-1': 2, 'gp-2': 5 })
  })

  it('удаляет ключи всех переданных кусков при done=false', () => {
    expect(applyBulk({ 'gp-1': 2, 'gp-2': 5, 'gp-3': 1 }, [piece('gp-1', 2), piece('gp-2', 5)], false)).toEqual({
      'gp-3': 1,
    })
  })

  it('не трогает куски, не входящие в переданный список', () => {
    expect(applyBulk({ 'gp-9': 3 }, [piece('gp-1', 1)], true)).toEqual({ 'gp-9': 3, 'gp-1': 1 })
  })

  it('пустой список кусков не меняет содержимое', () => {
    expect(applyBulk({ 'gp-1': 1 }, [], true)).toEqual({ 'gp-1': 1 })
    expect(applyBulk({ 'gp-1': 1 }, [], false)).toEqual({ 'gp-1': 1 })
  })

  it('идемпотентна: повторный вызов с тем же done ничего не меняет', () => {
    const once = applyBulk({}, [piece('gp-1', 2), piece('gp-2', 3)], true)
    const twice = applyBulk(once, [piece('gp-1', 2), piece('gp-2', 3)], true)
    expect(twice).toEqual(once)

    const cleared = applyBulk(twice, [piece('gp-1', 2), piece('gp-2', 3)], false)
    const clearedAgain = applyBulk(cleared, [piece('gp-1', 2), piece('gp-2', 3)], false)
    expect(clearedAgain).toEqual(cleared)
  })

  it('всегда возвращает новый объект', () => {
    const original = { 'gp-1': 1 }
    expect(applyBulk(original, [piece('gp-1', 1)], true)).not.toBe(original)
    expect(applyBulk(original, [piece('gp-1', 1)], false)).not.toBe(original)
  })

  it('перезаписывает легаси true новым числом при done=true', () => {
    expect(applyBulk({ 'gp-1': true }, [piece('gp-1', 4)], true)).toEqual({ 'gp-1': 4 })
  })
})
