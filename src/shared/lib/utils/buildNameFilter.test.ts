import { describe, expect, it } from 'vitest'
import { buildNameFilter } from './buildNameFilter'

describe('buildNameFilter', () => {
  it('возвращает пустой фильтр без поиска и с показом архива', () => {
    expect(buildNameFilter({ search: '', includeArchived: true })).toBe('')
  })

  it('добавляет условие на isArchived, если архив скрыт', () => {
    expect(buildNameFilter({ search: '', includeArchived: false })).toBe('isArchived = false')
  })

  it('обрезает пробелы и не добавляет поиск для пустой строки', () => {
    expect(buildNameFilter({ search: '   ', includeArchived: true })).toBe('')
  })

  it('ищет и по названию, и по номеру чертежа (?~ — хотя бы один элемент массива)', () => {
    const result = buildNameFilter({ search: 'КАТ', includeArchived: true })
    expect(result).toContain('name ~')
    expect(result).toContain('drawingNumbers ?~')
  })

  it('комбинирует поиск и фильтр архива через &&', () => {
    const result = buildNameFilter({ search: 'КАТ', includeArchived: false })
    expect(result.endsWith('&& isArchived = false')).toBe(true)
  })
})
