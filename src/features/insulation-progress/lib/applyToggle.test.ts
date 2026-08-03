import { describe, expect, it } from 'vitest'
import { applyToggle } from './applyToggle'

describe('applyToggle', () => {
  it('добавляет кусок в donePieces, если его там не было', () => {
    expect(applyToggle({}, 'gp-1')).toEqual({ 'gp-1': true })
  })

  it('убирает кусок из donePieces, если он уже был отмечен', () => {
    expect(applyToggle({ 'gp-1': true, 'gp-2': true }, 'gp-1')).toEqual({ 'gp-2': true })
  })

  it('не трогает остальные ключи', () => {
    expect(applyToggle({ 'gp-2': true }, 'gp-1')).toEqual({ 'gp-1': true, 'gp-2': true })
  })
})
