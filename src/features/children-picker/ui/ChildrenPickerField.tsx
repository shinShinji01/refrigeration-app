import { IconButton } from '@/shared/ui'
import DeleteIcon from '@/shared/assets/icons/delete.svg?react'
import { AddItemCombobox } from './AddItemCombobox'
import styles from './ChildrenPickerField.module.scss'

export interface ChildPickerItem {
  // linkId существующей связи или `new-${id}` для ещё не сохранённой —
  // стабильный React-ключ, не участвует в сохранении напрямую.
  key: string
  id: string
  name: string
  quantity: number
}

export interface ChildPickerCandidate {
  id: string
  name: string
}

interface ChildrenPickerFieldProps {
  label: string
  addedItems: ChildPickerItem[]
  candidates: ChildPickerCandidate[]
  onAdd: (candidate: ChildPickerCandidate) => void
  onRemove: (key: string) => void
  onQuantityChange: (key: string, quantity: number) => void
  searchPlaceholder: string
}

const getCandidateLabel = (candidate: ChildPickerCandidate) => candidate.name
const getCandidateKey = (candidate: ChildPickerCandidate) => candidate.id

// Блок добавления дочерних элементов в модалке редактирования (docs/spec.md →
// "Список сборочных единиц"): установке — узлы, узлу — детали. Сама логика
// не знает про домен, работает с {id, name, quantity}.
export const ChildrenPickerField = ({
  label,
  addedItems,
  candidates,
  onAdd,
  onRemove,
  onQuantityChange,
  searchPlaceholder,
}: ChildrenPickerFieldProps) => (
  <div className={styles.root}>
    <span className={styles.label}>{label}</span>

    {addedItems.length > 0 ? (
      <ul className={styles.list}>
        {addedItems.map((item) => (
          <li className={styles.row} key={item.key}>
            <span className={styles.name}>{item.name}</span>
            <div className={styles.stepper}>
              <button
                type="button"
                className={styles.stepperButton}
                aria-label={`Уменьшить количество: ${item.name}`}
                disabled={item.quantity <= 1}
                onClick={() => onQuantityChange(item.key, item.quantity - 1)}
              >
                −
              </button>
              <span className={styles.quantity}>{item.quantity}</span>
              <button
                type="button"
                className={styles.stepperButton}
                aria-label={`Увеличить количество: ${item.name}`}
                onClick={() => onQuantityChange(item.key, item.quantity + 1)}
              >
                +
              </button>
            </div>
            <IconButton icon={DeleteIcon} label={`Убрать: ${item.name}`} onClick={() => onRemove(item.key)} />
          </li>
        ))}
      </ul>
    ) : null}

    <AddItemCombobox
      items={candidates}
      onAdd={onAdd}
      getItemLabel={getCandidateLabel}
      getItemKey={getCandidateKey}
      placeholder={searchPlaceholder}
      aria-label={searchPlaceholder}
    />
  </div>
)
