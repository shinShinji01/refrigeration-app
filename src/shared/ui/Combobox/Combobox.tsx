import { useCallback, useId, useState } from 'react'
import { useCombobox } from 'downshift'
import { useFloating, autoUpdate, offset, flip, size, FloatingPortal } from '@floating-ui/react'
import clsx from 'clsx'
import { FloatingLabelField } from '../FloatingLabelField'
import styles from './Combobox.module.scss'

interface ComboboxProps<T> {
  id?: string
  items: T[]
  value: T | null
  onChange: (item: T | null) => void
  getItemLabel: (item: T) => string
  getItemKey: (item: T) => string
  label: string
  disabled?: boolean
  'aria-label'?: string
}

// Универсальный однозначный searchable-дропдаун (установка/узел/деталь в
// каскадном фильтре и подобные сценарии). Фильтрация ввода — клиентская
// substring по getItemLabel, без обращений к серверу.
export const Combobox = <T,>({
  id,
  items,
  value,
  onChange,
  getItemLabel,
  getItemKey,
  label,
  disabled,
  'aria-label': ariaLabel,
}: ComboboxProps<T>) => {
  const [searchValue, setSearchValue] = useState('')
  const query = searchValue.trim().toLowerCase()
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

  const { isOpen, getMenuProps, getInputProps, getToggleButtonProps, highlightedIndex, getItemProps, selectItem } =
    useCombobox({
      items: filteredItems,
      selectedItem: value,
      itemToString: (item) => (item ? getItemLabel(item) : ''),
      // Фильтруем список только по тому, что пользователь реально печатает.
      // Downshift сам проставляет в inputValue label выбранного пункта — если
      // отслеживать любые изменения подряд, список после выбора фильтровался
      // бы до одного этого пункта, и при повторном открытии остальные не видны.
      onInputValueChange: ({ inputValue: nextInputValue, type }) => {
        if (type === useCombobox.stateChangeTypes.InputChange) {
          setSearchValue(nextInputValue ?? '')
        }
      },
      onSelectedItemChange: ({ selectedItem }) => {
        onChange(selectedItem ?? null)
        setSearchValue('')
      },
    })

  const generatedId = useId()
  const resolvedId = id ?? generatedId

  // Меню всегда смонтировано (скрывается через display:none на обёртке, не
  // условным рендером) — так и должно быть по докам downshift, но сам ref
  // указывает на элемент внутри @floating-ui/react-портала, и внутренняя
  // проверка downshift об этом не знает — подавляем её ложный warning.
  const menuProps = getMenuProps({}, { suppressRefError: true })
  const setReferenceRef = useCallback((node: HTMLDivElement | null) => refs.setReference(node), [refs])
  const setFloatingRef = useCallback((node: HTMLDivElement | null) => refs.setFloating(node), [refs])

  return (
    <FloatingLabelField htmlFor={resolvedId} label={label} className={styles.root}>
      <div className={styles.control} ref={setReferenceRef}>
        <input
          {...getInputProps({ id: resolvedId, disabled, placeholder: ' ', 'aria-label': ariaLabel })}
          className={styles.input}
        />
        {value ? (
          <button
            type="button"
            className={styles.clear}
            aria-label="Очистить"
            onClick={() => selectItem(null)}
          >
            ×
          </button>
        ) : null}
        <button
          type="button"
          className={styles.toggle}
          aria-label="Открыть список"
          disabled={disabled}
          {...getToggleButtonProps()}
        >
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
    </FloatingLabelField>
  )
}
