import { describe, expect, it } from 'vitest'
import { sortComponentItems } from './sortComponentItems'
import type { ComponentListItem } from '@/features/cascade-filter'
import type { RefrigerationUnit, UnitId } from '@/entities/refrigeration-unit'
import type { Assembly, AssemblyId } from '@/entities/assembly'
import type { Part, PartId } from '@/entities/part'

const unit = (name: string, commissionedAt: string | null = null): ComponentListItem => ({
  kind: 'unit',
  unit: { id: name as UnitId, name, commissionedAt } as RefrigerationUnit,
})

const assembly = (name: string, commissionedAt: string | null = null): ComponentListItem => ({
  kind: 'assembly',
  assembly: { id: name as AssemblyId, name, commissionedAt } as Assembly,
})

const part = (name: string, commissionedAt: string | null = null): ComponentListItem => ({
  kind: 'part',
  part: { id: name as PartId, name, commissionedAt } as Part,
})

const names = (items: ComponentListItem[]) =>
  items.map((item) => (item.kind === 'unit' ? item.unit.name : item.kind === 'assembly' ? item.assembly.name : item.part.name))

describe('sortComponentItems', () => {
  it('сортирует по названию (ru locale)', () => {
    const result = sortComponentItems([unit('Юнит'), unit('Аппарат'), unit('Ёж')], 'name')
    expect(names(result)).toEqual(['Аппарат', 'Ёж', 'Юнит'])
  })

  it('сортирует по типу: установка → узел → деталь, внутри типа — по названию', () => {
    const result = sortComponentItems([part('Б'), unit('А'), assembly('В'), unit('Я'), part('А')], 'type')
    expect(result.map((item) => item.kind)).toEqual(['unit', 'unit', 'assembly', 'part', 'part'])
    expect(names(result)).toEqual(['А', 'Я', 'В', 'А', 'Б'])
  })

  it('сортирует по дате, элементы без даты — в конце, тай-брейк по названию', () => {
    const result = sortComponentItems(
      [unit('Б', null), unit('А', '2024-03-01'), unit('В', '2024-01-01'), unit('Г', '')],
      'date',
    )
    expect(names(result)).toEqual(['В', 'А', 'Б', 'Г'])
  })
})
