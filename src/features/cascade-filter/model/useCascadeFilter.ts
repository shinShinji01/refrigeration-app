import { useAppDispatch, useAppSelector } from '@/app/store'
import type { UnitId } from '@/entities/refrigeration-unit'
import type { AssemblyId } from '@/entities/assembly'
import type { PartId } from '@/entities/part'
import { unitSelected, assemblySelected, partSelected } from './cascadeFilterSlice'

export const useCascadeFilter = () => {
  const dispatch = useAppDispatch()
  const { unitId, assemblyId, partId } = useAppSelector((state) => state.cascadeFilter)

  return {
    unitId,
    assemblyId,
    partId,
    selectUnit: (id: UnitId | null) => dispatch(unitSelected(id)),
    selectAssembly: (id: AssemblyId | null) => dispatch(assemblySelected(id)),
    selectPart: (id: PartId | null) => dispatch(partSelected(id)),
  }
}
