import type { InsulationSet } from '../model/types'

// Актуальная версия = максимальный effectiveFrom среди неархивных
// (docs/data-model.md → "insulation_sets"). Единственное место, где решается
// это правило — дропдаун версии и авто-выбор при смене установки берут отсюда.
export const pickCurrentSet = (sets: InsulationSet[]): InsulationSet | null =>
  sets
    .filter((set) => !set.isArchived)
    .reduce<InsulationSet | null>((current, candidate) => {
      if (!current) return candidate
      return candidate.effectiveFrom > current.effectiveFrom ? candidate : current
    }, null)
