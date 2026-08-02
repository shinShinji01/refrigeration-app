import type { AssemblyId } from '@/entities/assembly'
import type { PartId } from '@/entities/part'
import type { UnitId } from '@/entities/refrigeration-unit'
import type { ComponentListItem } from '@/features/cascade-filter'

export interface DescendantFetchers {
  fetchAssembliesForUnit: (unitId: UnitId) => Promise<{ id: AssemblyId }[]>
  fetchPartsForAssembly: (assemblyId: AssemblyId) => Promise<{ id: PartId }[]>
  fetchPartChildren: (partId: PartId) => Promise<{ id: PartId }[]>
}

export interface DeletionDescendants {
  assemblyIds: AssemblyId[]
  partIds: PartId[]
}

const collectPartDescendants = async (
  partId: PartId,
  fetchPartChildren: DescendantFetchers['fetchPartChildren'],
  seen: Set<PartId>,
): Promise<void> => {
  const children = await fetchPartChildren(partId)
  for (const child of children) {
    if (seen.has(child.id)) continue
    seen.add(child.id)
    await collectPartDescendants(child.id, fetchPartChildren, seen)
  }
}

const collectAssemblyPartDescendants = async (
  assemblyId: AssemblyId,
  fetchers: Pick<DescendantFetchers, 'fetchPartsForAssembly' | 'fetchPartChildren'>,
  seen: Set<PartId>,
): Promise<void> => {
  const parts = await fetchers.fetchPartsForAssembly(assemblyId)
  for (const part of parts) {
    if (seen.has(part.id)) continue
    seen.add(part.id)
    await collectPartDescendants(part.id, fetchers.fetchPartChildren, seen)
  }
}

// Состав, который "утянет" за собой удаление выбранных установок/узлов/деталей
// (unit_assemblies → assembly_parts → part_parts) — без id самих выбранных
// элементов. Нужен, чтобы явно спросить пользователя про каскадное удаление
// (docs/decisions.md: cascadeDelete в схеме не включён — сироты в join-таблицах
// иначе останутся молча).
export const collectDeletionDescendants = async (
  items: ComponentListItem[],
  fetchers: DescendantFetchers,
): Promise<DeletionDescendants> => {
  const assemblyIds = new Set<AssemblyId>()
  const partIds = new Set<PartId>()

  for (const item of items) {
    if (item.kind === 'unit') {
      const assemblies = await fetchers.fetchAssembliesForUnit(item.unit.id)
      for (const assembly of assemblies) {
        if (assemblyIds.has(assembly.id)) continue
        assemblyIds.add(assembly.id)
        await collectAssemblyPartDescendants(assembly.id, fetchers, partIds)
      }
    } else if (item.kind === 'assembly') {
      await collectAssemblyPartDescendants(item.assembly.id, fetchers, partIds)
    } else {
      await collectPartDescendants(item.part.id, fetchers.fetchPartChildren, partIds)
    }
  }

  return { assemblyIds: [...assemblyIds], partIds: [...partIds] }
}
