import { useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { sortByChanged, type SortBy } from './cardSortSlice'

export const useCardSort = () => {
  const dispatch = useAppDispatch()
  const sortBy = useAppSelector((state) => state.cardSort.sortBy)

  const setSortBy = useCallback((value: SortBy) => dispatch(sortByChanged(value)), [dispatch])

  return { sortBy, setSortBy }
}
