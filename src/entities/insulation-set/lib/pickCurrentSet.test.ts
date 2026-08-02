import { describe, expect, it } from 'vitest'
import { pickCurrentSet } from './pickCurrentSet'
import type { InsulationSet, InsulationSetId } from '../model/types'
import type { UnitId } from '@/entities/refrigeration-unit'

const set = (id: string, effectiveFrom: string, isArchived = false): InsulationSet => ({
  id: id as InsulationSetId,
  unit: 'unit-a' as UnitId,
  name: null,
  effectiveFrom,
  isArchived,
  created: '',
  updated: '',
})

describe('pickCurrentSet', () => {
  it('выбирает набор с максимальной effectiveFrom среди неархивных', () => {
    const result = pickCurrentSet([set('a', '2024-01-01'), set('b', '2024-06-01'), set('c', '2024-03-01')])
    expect(result?.id).toBe('b')
  })

  it('пропускает архивные, даже если они новее', () => {
    const result = pickCurrentSet([set('a', '2024-01-01'), set('b', '2024-06-01', true)])
    expect(result?.id).toBe('a')
  })

  it('возвращает null, если подходящих наборов нет', () => {
    expect(pickCurrentSet([])).toBeNull()
    expect(pickCurrentSet([set('a', '2024-01-01', true)])).toBeNull()
  })
})
