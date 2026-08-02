import { useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { selectionToggled, selectionCleared } from './cardSelectionSlice'

export const useCardSelection = () => {
  const dispatch = useAppDispatch()
  const selectedKeys = useAppSelector((state) => state.cardSelection.selectedKeys)

  const isSelected = useCallback((key: string) => selectedKeys.includes(key), [selectedKeys])
  const toggleSelected = useCallback((key: string) => dispatch(selectionToggled(key)), [dispatch])
  const clearSelection = useCallback(() => dispatch(selectionCleared()), [dispatch])

  return {
    selectedKeys,
    selectedCount: selectedKeys.length,
    isSelected,
    toggleSelected,
    clearSelection,
  }
}
