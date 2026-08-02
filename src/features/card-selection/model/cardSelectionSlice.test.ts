import { describe, expect, it } from 'vitest'
import {
  cardSelectionReducer,
  selectionToggled,
  selectionCleared,
  type CardSelectionState,
} from './cardSelectionSlice'

const filledState: CardSelectionState = {
  selectedKeys: ['unit-a', 'assembly-a'],
}

describe('cardSelectionSlice', () => {
  it('добавляет ключ в выделение, если его там не было', () => {
    const state = cardSelectionReducer(filledState, selectionToggled('part-a'))
    expect(state).toEqual({ selectedKeys: ['unit-a', 'assembly-a', 'part-a'] })
  })

  it('убирает ключ из выделения, если он уже был выбран', () => {
    const state = cardSelectionReducer(filledState, selectionToggled('assembly-a'))
    expect(state).toEqual({ selectedKeys: ['unit-a'] })
  })

  it('сбрасывает выделение целиком', () => {
    const state = cardSelectionReducer(filledState, selectionCleared())
    expect(state).toEqual({ selectedKeys: [] })
  })
})
