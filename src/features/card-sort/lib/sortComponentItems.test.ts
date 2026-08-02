import { describe, expect, it } from 'vitest'
import { sortComponentItems, splitByArchived } from './sortComponentItems'
import type { ComponentListItem } from '@/features/cascade-filter'
import type { RefrigerationUnit, UnitId } from '@/entities/refrigeration-unit'
import type { Assembly, AssemblyId } from '@/entities/assembly'
import type { Part, PartId } from '@/entities/part'

interface ItemOptions {
  commissionedAt?: string | null
  isArchived?: boolean
}

const unit = (name: string, { commissionedAt = null, isArchived = false }: ItemOptions = {}): ComponentListItem => ({
  kind: 'unit',
  unit: { id: name as UnitId, name, commissionedAt, isArchived } as RefrigerationUnit,
})

const assembly = (
  name: string,
  { commissionedAt = null, isArchived = false }: ItemOptions = {},
): ComponentListItem => ({
  kind: 'assembly',
  assembly: { id: name as AssemblyId, name, commissionedAt, isArchived } as Assembly,
})

const part = (name: string, { commissionedAt = null, isArchived = false }: ItemOptions = {}): ComponentListItem => ({
  kind: 'part',
  part: { id: name as PartId, name, commissionedAt, isArchived } as Part,
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
      [
        unit('Б'),
        unit('А', { commissionedAt: '2024-03-01' }),
        unit('В', { commissionedAt: '2024-01-01' }),
        unit('Г', { commissionedAt: '' }),
      ],
      'date',
    )
    expect(names(result)).toEqual(['В', 'А', 'Б', 'Г'])
  })

  it('архивные — всегда в конце, независимо от критерия', () => {
    const result = sortComponentItems(
      [unit('Я', { isArchived: true }), unit('А'), unit('Б', { isArchived: true }), unit('В')],
      'name',
    )
    expect(names(result)).toEqual(['А', 'В', 'Б', 'Я'])
  })
})

describe('splitByArchived', () => {
  it('делит на активные и архивные, сохраняя порядок внутри групп', () => {
    const items = [unit('А'), unit('Б', { isArchived: true }), unit('В'), unit('Г', { isArchived: true })]
    const result = splitByArchived(items)
    expect(names(result.active)).toEqual(['А', 'В'])
    expect(names(result.archived)).toEqual(['Б', 'Г'])
  })

  it('пустой archived, если архивных нет', () => {
    const result = splitByArchived([unit('А'), unit('Б')])
    expect(result.archived).toEqual([])
  })
})
