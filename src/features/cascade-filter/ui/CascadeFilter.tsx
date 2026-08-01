import { skipToken } from '@reduxjs/toolkit/query/react'
import { Combobox } from '@/shared/ui'
import { useGetUnitsQuery } from '@/entities/refrigeration-unit'
import type { RefrigerationUnit } from '@/entities/refrigeration-unit'
import { useGetAssembliesForUnitQuery } from '@/entities/assembly'
import type { Assembly } from '@/entities/assembly'
import { useGetPartsForAssemblyQuery } from '@/entities/part'
import type { Part } from '@/entities/part'
import { useCascadeFilter } from '../model/useCascadeFilter'
import { filterChildren } from '../lib/filterChildren'
import styles from './CascadeFilter.module.scss'

interface CascadeFilterProps {
  includeArchived: boolean
}

const getName = <T extends { name: string }>(item: T): string => item.name
const getId = <T extends { id: string }>(item: T): string => item.id

// Установка → узел → деталь: следующий дропдаун активен только если выбран
// предыдущий (docs/spec.md → "Список сборочных единиц").
export const CascadeFilter = ({ includeArchived }: CascadeFilterProps) => {
  const { unitId, assemblyId, partId, selectUnit, selectAssembly, selectPart } = useCascadeFilter()

  const { data: units = [] } = useGetUnitsQuery({ includeArchived })
  const { data: unitAssemblies = [] } = useGetAssembliesForUnitQuery(unitId ?? skipToken)
  const { data: assemblyParts = [] } = useGetPartsForAssemblyQuery(assemblyId ?? skipToken)

  const assemblies = filterChildren(unitAssemblies, '', includeArchived)
  const parts = filterChildren(assemblyParts, '', includeArchived)

  const selectedUnit = units.find((unit) => unit.id === unitId) ?? null
  const selectedAssembly = assemblies.find((assembly) => assembly.id === assemblyId) ?? null
  const selectedPart = parts.find((part) => part.id === partId) ?? null

  return (
    <div className={styles.root}>
      <Combobox<RefrigerationUnit>
        items={units}
        value={selectedUnit}
        onChange={(unit) => selectUnit(unit?.id ?? null)}
        getItemLabel={getName}
        getItemKey={getId}
        placeholder="Установка"
        aria-label="Выбор холодильной установки"
      />
      <Combobox<Assembly>
        items={assemblies}
        value={selectedAssembly}
        onChange={(assembly) => selectAssembly(assembly?.id ?? null)}
        getItemLabel={getName}
        getItemKey={getId}
        placeholder="Узел"
        disabled={!unitId}
        aria-label="Выбор сборочного узла"
      />
      <Combobox<Part>
        items={parts}
        value={selectedPart}
        onChange={(part) => selectPart(part?.id ?? null)}
        getItemLabel={getName}
        getItemKey={getId}
        placeholder="Деталь"
        disabled={!assemblyId}
        aria-label="Выбор детали"
      />
    </div>
  )
}
