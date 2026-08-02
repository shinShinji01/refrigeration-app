import { describe, expect, it } from 'vitest'
import { cardSortReducer, sortByChanged, type CardSortState } from './cardSortSlice'

describe('cardSortSlice', () => {
  it('по умолчанию сортирует по названию', () => {
    const state = cardSortReducer(undefined, { type: '@@INIT' })
    expect(state).toEqual({ sortBy: 'name' })
  })

  it('меняет критерий сортировки', () => {
    const filledState: CardSortState = { sortBy: 'name' }
    const state = cardSortReducer(filledState, sortByChanged('date'))
    expect(state).toEqual({ sortBy: 'date' })
  })
})
