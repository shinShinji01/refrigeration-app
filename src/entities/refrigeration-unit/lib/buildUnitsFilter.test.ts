import { describe, expect, it } from 'vitest'
import { buildUnitsFilter } from './buildUnitsFilter'

describe('buildUnitsFilter', () => {
  it('возвращает пустой фильтр без поиска и с показом архива', () => {
    expect(buildUnitsFilter({ search: '', includeArchived: true })).toBe('')
  })

  it('добавляет условие на isArchived, если архив скрыт', () => {
    expect(buildUnitsFilter({ search: '', includeArchived: false })).toBe('isArchived = false')
  })

  it('обрезает пробелы и не добавляет поиск для пустой строки', () => {
    expect(buildUnitsFilter({ search: '   ', includeArchived: true })).toBe('')
  })

  it('ищет и по названию, и по номеру чертежа (?~ — хотя бы один элемент массива)', () => {
    const result = buildUnitsFilter({ search: 'КАТ', includeArchived: true })
    expect(result).toContain('name ~')
    expect(result).toContain('drawingNumbers ?~')
  })

  it('комбинирует поиск и фильтр архива через &&', () => {
    const result = buildUnitsFilter({ search: 'КАТ', includeArchived: false })
    expect(result.endsWith('&& isArchived = false')).toBe(true)
  })
})
