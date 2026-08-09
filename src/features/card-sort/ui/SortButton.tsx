import { useRef, useState } from 'react'
import clsx from 'clsx'
import { useOnClickOutside } from '@/shared/lib/hooks'
import SortIcon from '@/shared/assets/icons/sort.svg?react'
import { useCardSort } from '../model/useCardSort'
import type { SortBy } from '../model/cardSortSlice'
import styles from './SortButton.module.scss'

const OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'name', label: 'По названию' },
  { value: 'type', label: 'По типу' },
  { value: 'date', label: 'По дате' },
]

// Кнопка сортировки списка карточек (docs/spec.md → "Список карточек").
export const SortButton = () => {
  const { sortBy, setSortBy } = useCardSort()
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useOnClickOutside(rootRef, () => setIsOpen(false), isOpen)

  const current = OPTIONS.find((option) => option.value === sortBy) ?? OPTIONS[0]!

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <SortIcon className={styles.icon} aria-hidden="true" />
        <span>{current.label}</span>
      </button>
      {isOpen ? (
        <ul className={styles.menu} role="menu">
          {OPTIONS.map((option) => (
            <li key={option.value} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={option.value === sortBy}
                className={clsx(styles.item, option.value === sortBy && styles.active)}
                onClick={() => {
                  setSortBy(option.value)
                  setIsOpen(false)
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
