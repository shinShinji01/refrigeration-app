import styles from './ChildrenSummaryList.module.scss'

export interface ChildrenSummaryItem {
  id: string
  label: string
  quantity: number
}

interface ChildrenSummaryListProps {
  items: ChildrenSummaryItem[]
}

// Компактная сводка дочерних элементов внутри карточки (узлы установки,
// детали узла, вложенные детали) — «Название × N» построчно.
export const ChildrenSummaryList = ({ items }: ChildrenSummaryListProps) => {
  if (items.length === 0) {
    return null
  }

  return (
    <ul className={styles.root}>
      {items.map((item) => (
        <li key={item.id} className={styles.item}>
          <span className={styles.label}>{item.label}</span>
          <span className={styles.quantity}>× {item.quantity}</span>
        </li>
      ))}
    </ul>
  )
}
