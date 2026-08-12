import { describe, expect, it } from 'vitest'
import { isGroupFullyDone } from './isGroupFullyDone'

const piece = (linkId: string, quantity: number) => ({ linkId, quantity })
const getDoneCount = (counts: Record<string, number>) => (linkId: string) => counts[linkId] ?? 0

describe('isGroupFullyDone', () => {
  it('false для пустой группы', () => {
    expect(isGroupFullyDone([], getDoneCount({}))).toBe(false)
  })

  it('false, если хотя бы один кусок не полностью готов', () => {
    expect(isGroupFullyDone([piece('gp-1', 2), piece('gp-2', 1)], getDoneCount({ 'gp-1': 1, 'gp-2': 1 }))).toBe(
      false,
    )
  })

  it('true, если у каждого куска count достиг quantity', () => {
    expect(isGroupFullyDone([piece('gp-1', 2), piece('gp-2', 1)], getDoneCount({ 'gp-1': 2, 'gp-2': 1 }))).toBe(
      true,
    )
  })

  it('не зависит от лишних отметок вне группы', () => {
    expect(isGroupFullyDone([piece('gp-1', 1)], getDoneCount({ 'gp-1': 1, 'gp-99': 1 }))).toBe(true)
  })
})
