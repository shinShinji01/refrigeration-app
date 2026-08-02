import { useCallback, useState } from 'react'
import { useCombobox } from 'downshift'
import { useFloating, autoUpdate, offset, flip, size, FloatingPortal } from '@floating-ui/react'
import clsx from 'clsx'
import styles from './AddItemCombobox.module.scss'

interface AddItemComboboxProps<T> {
  items: T[]
  onAdd: (item: T) => void
  getItemLabel: (item: T) => string
  getItemKey: (item: T) => string
  placeholder?: string
  'aria-label'?: string
}

// В отличие от shared/ui/Combobox (выбор одного значения), здесь выбор
// добавляет элемент в список снаружи и сразу освобождает поле — под следующий
// поиск. Поэтому selectedItem у downshift всегда null, а не текущий выбор
// (см. пример "multiple selection" в доках downshift).
export const AddItemCombobox = <T,>({
  items,
  onAdd,
  getItemLabel,
  getItemKey,
  placeholder,
  'aria-label': ariaLabel,
}: AddItemComboboxProps<T>) => {
  const [inputValue, setInputValue] = useState('')
  const query = inputValue.trim().toLowerCase()
  const filteredItems = query ? items.filter((item) => getItemLabel(item).toLowerCase().includes(query)) : items

  const { refs, floatingStyles } = useFloating({
    placement: 'bottom-start',
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(4),
      flip(),
      size({
        apply({ rects, elements }) {
          elements.floating.style.width = `${rects.reference.width}px`
        },
      }),
    ],
  })

  const { isOpen, getMenuProps, getInputProps, getToggleButtonProps, highlightedIndex, getItemProps } = useCombobox({
    items: filteredItems,
    inputValue,
    selectedItem: null,
    itemToString: (item) => (item ? getItemLabel(item) : ''),
    // Меню остаётся открытым после выбора — добавление обычно происходит
    // подряд по несколько элементов.
    stateReducer: (state, { changes, type }) => {
      switch (type) {
        case useCombobox.stateChangeTypes.ItemClick:
        case useCombobox.stateChangeTypes.InputKeyDownEnter:
          return { ...changes, isOpen: true, highlightedIndex: state.highlightedIndex }
        default:
          return changes
      }
    },
    onStateChange: ({ type, inputValue: nextInputValue, selectedItem }) => {
      switch (type) {
        case useCombobox.stateChangeTypes.InputChange:
          setInputValue(nextInputValue ?? '')
          break
        case useCombobox.stateChangeTypes.ItemClick:
        case useCombobox.stateChangeTypes.InputKeyDownEnter:
          if (selectedItem) {
            onAdd(selectedItem)
            setInputValue('')
          }
          break
        default:
          break
      }
    },
  })

  const menuProps = getMenuProps({}, { suppressRefError: true })
  const setReferenceRef = useCallback((node: HTMLDivElement | null) => refs.setReference(node), [refs])
  const setFloatingRef = useCallback((node: HTMLDivElement | null) => refs.setFloating(node), [refs])

  return (
    <div className={styles.root}>
      <div className={styles.control} ref={setReferenceRef}>
        <input {...getInputProps({ placeholder, 'aria-label': ariaLabel })} className={styles.input} />
        <button type="button" className={styles.toggle} aria-label="Открыть список" {...getToggleButtonProps()}>
          ▾
        </button>
      </div>
      <FloatingPortal>
        <div
          ref={setFloatingRef}
          className={styles.menu}
          style={isOpen && filteredItems.length > 0 ? floatingStyles : { ...floatingStyles, display: 'none' }}
        >
          <ul {...menuProps} className={styles.list}>
            {isOpen &&
              filteredItems.map((item, index) => (
                <li
                  key={getItemKey(item)}
                  className={clsx(styles.item, highlightedIndex === index && styles.highlighted)}
                  {...getItemProps({ item, index })}
                >
                  {getItemLabel(item)}
                </li>
              ))}
          </ul>
        </div>
      </FloatingPortal>
    </div>
  )
}
