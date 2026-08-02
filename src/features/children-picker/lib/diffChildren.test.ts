import { describe, expect, it } from 'vitest'
import { diffChildren, type ChildLink } from './diffChildren'

const existing = (linkId: string, id: string, quantity: number): ChildLink => ({ linkId, id, quantity })
const added = (id: string, quantity: number): ChildLink => ({ linkId: null, id, quantity })

describe('diffChildren', () => {
  it('новый элемент без linkId идёт в toCreate', () => {
    const result = diffChildren([], [added('assembly-a', 1)])
    expect(result).toEqual({
      toCreate: [{ id: 'assembly-a', quantity: 1 }],
      toUpdate: [],
      toDelete: [],
    })
  })

  it('элемент, убранный из текущего состава, идёт в toDelete', () => {
    const original = [existing('link-1', 'assembly-a', 1)]
    const result = diffChildren(original, [])
    expect(result).toEqual({ toCreate: [], toUpdate: [], toDelete: ['link-1'] })
  })

  it('изменённое количество у существующей связи идёт в toUpdate', () => {
    const original = [existing('link-1', 'assembly-a', 1)]
    const current = [existing('link-1', 'assembly-a', 3)]
    const result = diffChildren(original, current)
    expect(result).toEqual({ toCreate: [], toUpdate: [{ linkId: 'link-1', quantity: 3 }], toDelete: [] })
  })

  it('неизменившаяся связь не попадает никуда', () => {
    const original = [existing('link-1', 'assembly-a', 2)]
    const current = [existing('link-1', 'assembly-a', 2)]
    const result = diffChildren(original, current)
    expect(result).toEqual({ toCreate: [], toUpdate: [], toDelete: [] })
  })

  it('комбинация: одно добавлено, одно удалено, одно с изменённым количеством, одно без изменений', () => {
    const original = [
      existing('link-1', 'assembly-a', 1),
      existing('link-2', 'assembly-b', 2),
      existing('link-3', 'assembly-c', 5),
    ]
    const current = [
      existing('link-1', 'assembly-a', 1),
      existing('link-2', 'assembly-b', 4),
      added('assembly-d', 1),
    ]
    const result = diffChildren(original, current)
    expect(result).toEqual({
      toCreate: [{ id: 'assembly-d', quantity: 1 }],
      toUpdate: [{ linkId: 'link-2', quantity: 4 }],
      toDelete: ['link-3'],
    })
  })
})
