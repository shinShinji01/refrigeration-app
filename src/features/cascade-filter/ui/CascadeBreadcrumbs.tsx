import { skipToken } from '@reduxjs/toolkit/query/react'
import { useGetUnitsQuery } from '@/entities/refrigeration-unit'
import { useGetAssembliesForUnitQuery } from '@/entities/assembly'
import { useGetPartsForAssemblyQuery } from '@/entities/part'
import { useCascadeFilter } from '../model/useCascadeFilter'
import { filterChildren } from '../lib/filterChildren'
import styles from './CascadeBreadcrumbs.module.scss'

interface CascadeBreadcrumbsProps {
  includeArchived: boolean
}

// Хлебные крошки над сеткой карточек — видны только когда есть выбор
// (docs/superpowers/specs/2026-08-14-units-card-navigation-design.md).
// includeArchived совпадает с тем, что получает CascadeFilter — общий кэш
// RTK Query, без лишних запросов.
export const CascadeBreadcrumbs = ({ includeArchived }: CascadeBreadcrumbsProps) => {
  const { unitId, assemblyId, partId, selectUnit, selectAssembly, selectPart } = useCascadeFilter()

  const { data: units = [] } = useGetUnitsQuery({ includeArchived })
  const { data: unitAssemblies = [] } = useGetAssembliesForUnitQuery(unitId ?? skipToken)
  const { data: assemblyParts = [] } = useGetPartsForAssemblyQuery(assemblyId ?? skipToken)

  const assemblies = filterChildren(unitAssemblies, '', includeArchived)
  const parts = filterChildren(assemblyParts, '', includeArchived)

  if (!unitId) return null

  const unit = units.find((candidate) => candidate.id === unitId)
  const assembly = assemblyId ? assemblies.find((candidate) => candidate.id === assemblyId) : undefined
  const part = partId ? parts.find((candidate) => candidate.id === partId) : undefined

  if (!unit) return null

  return (
    <nav className={styles.root} aria-label="Хлебные крошки">
      <ol className={styles.list}>
        <li>
          <button type="button" className={styles.crumb} onClick={() => selectUnit(null)}>
            Установки
          </button>
        </li>
        <li>
          {assembly || part ? (
            <button type="button" className={styles.crumb} onClick={() => selectAssembly(null)}>
              {unit.name}
            </button>
          ) : (
            <span className={styles.current} aria-current="page">
              {unit.name}
            </span>
          )}
        </li>
        {assembly ? (
          <li>
            {part ? (
              <button type="button" className={styles.crumb} onClick={() => selectPart(null)}>
                {assembly.name}
              </button>
            ) : (
              <span className={styles.current} aria-current="page">
                {assembly.name}
              </span>
            )}
          </li>
        ) : null}
        {part ? (
          <li>
            <span className={styles.current} aria-current="page">
              {part.name}
            </span>
          </li>
        ) : null}
      </ol>
    </nav>
  )
}
