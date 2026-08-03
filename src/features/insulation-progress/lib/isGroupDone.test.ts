import { describe, expect, it } from 'vitest'
import { isGroupDone } from './isGroupDone'

const isPieceDone = (done: Set<string>) => (linkId: string) => done.has(linkId)

describe('isGroupDone', () => {
  it('false для пустой группы', () => {
    expect(isGroupDone([], isPieceDone(new Set()))).toBe(false)
  })

  it('false, если хотя бы один кусок не отмечен', () => {
    expect(isGroupDone(['gp-1', 'gp-2'], isPieceDone(new Set(['gp-1'])))).toBe(false)
  })

  it('true, если все куски отмечены', () => {
    expect(isGroupDone(['gp-1', 'gp-2'], isPieceDone(new Set(['gp-1', 'gp-2'])))).toBe(true)
  })

  it('не зависит от лишних отметок вне группы', () => {
    expect(isGroupDone(['gp-1'], isPieceDone(new Set(['gp-1', 'gp-99'])))).toBe(true)
  })
})
