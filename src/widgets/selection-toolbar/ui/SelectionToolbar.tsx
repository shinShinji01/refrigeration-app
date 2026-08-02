import { IconButton } from '@/shared/ui'
import ArchiveIcon from '@/shared/assets/icons/archive.svg?react'
import UnarchiveIcon from '@/shared/assets/icons/unarchive.svg?react'
import DeleteIcon from '@/shared/assets/icons/delete.svg?react'
import styles from './SelectionToolbar.module.scss'

interface SelectionToolbarProps {
  count: number
  isBusy: boolean
  onArchive: () => void
  onUnarchive: () => void
  onDelete: () => void
}

// Появляется, когда выделена хоть одна карточка (docs/spec.md → "Список карточек").
export const SelectionToolbar = ({ count, isBusy, onArchive, onUnarchive, onDelete }: SelectionToolbarProps) => {
  if (count === 0) {
    return null
  }

  return (
    <div className={styles.root} role="toolbar" aria-label="Действия с выбранными элементами">
      <span className={styles.count}>Выбрано: {count}</span>
      <div className={styles.actions}>
        <IconButton
          icon={ArchiveIcon}
          label="В архив"
          className={styles.archive}
          onClick={onArchive}
          disabled={isBusy}
        />
        <IconButton
          icon={UnarchiveIcon}
          label="Из архива"
          className={styles.archive}
          onClick={onUnarchive}
          disabled={isBusy}
        />
        <IconButton icon={DeleteIcon} label="Удалить" className={styles.delete} onClick={onDelete} disabled={isBusy} />
      </div>
    </div>
  )
}
