import { describe, expect, it } from 'vitest'
import { applyBulk } from './applyBulk'

describe('applyBulk', () => {
  it('добавляет все переданные ключи при done=true', () => {
    expect(applyBulk({}, ['gp-1', 'gp-2'], true)).toEqual({ 'gp-1': true, 'gp-2': true })
  })

  it('убирает все переданные ключи при done=false', () => {
    expect(applyBulk({ 'gp-1': true, 'gp-2': true, 'gp-3': true }, ['gp-1', 'gp-2'], false)).toEqual({
      'gp-3': true,
    })
  })

  it('не трогает ключи, не входящие в groupPieceIds', () => {
    expect(applyBulk({ 'gp-9': true }, ['gp-1'], true)).toEqual({ 'gp-9': true, 'gp-1': true })
  })

  it('пустой groupPieceIds не меняет содержимое', () => {
    expect(applyBulk({ 'gp-1': true }, [], true)).toEqual({ 'gp-1': true })
    expect(applyBulk({ 'gp-1': true }, [], false)).toEqual({ 'gp-1': true })
  })

  it('идемпотентна: повторный вызов с тем же done ничего не меняет', () => {
    const once = applyBulk({}, ['gp-1', 'gp-2'], true)
    const twice = applyBulk(once, ['gp-1', 'gp-2'], true)
    expect(twice).toEqual(once)

    const cleared = applyBulk(twice, ['gp-1', 'gp-2'], false)
    const clearedAgain = applyBulk(cleared, ['gp-1', 'gp-2'], false)
    expect(clearedAgain).toEqual(cleared)
  })

  it('всегда возвращает новый объект', () => {
    const original = { 'gp-1': true } as const
    expect(applyBulk(original, ['gp-1'], true)).not.toBe(original)
    expect(applyBulk(original, ['gp-1'], false)).not.toBe(original)
  })
})
