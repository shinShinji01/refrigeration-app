import { describe, expect, it } from 'vitest'
import { applySetCount } from './applySetCount'

describe('applySetCount', () => {
  it('пишет count, если count > 0', () => {
    expect(applySetCount({}, 'gp-1', 2)).toEqual({ 'gp-1': 2 })
  })

  it('перезаписывает существующее значение', () => {
    expect(applySetCount({ 'gp-1': 2 }, 'gp-1', 5)).toEqual({ 'gp-1': 5 })
  })

  it('перезаписывает легаси true новым числом', () => {
    expect(applySetCount({ 'gp-1': true }, 'gp-1', 3)).toEqual({ 'gp-1': 3 })
  })

  it('удаляет ключ при count === 0', () => {
    expect(applySetCount({ 'gp-1': 3, 'gp-2': 1 }, 'gp-1', 0)).toEqual({ 'gp-2': 1 })
  })

  it('удаляет ключ при count < 0 (защита от некорректного вызова)', () => {
    expect(applySetCount({ 'gp-1': 3 }, 'gp-1', -1)).toEqual({})
  })

  it('не трогает остальные ключи', () => {
    expect(applySetCount({ 'gp-2': 4 }, 'gp-1', 1)).toEqual({ 'gp-1': 1, 'gp-2': 4 })
  })
})
