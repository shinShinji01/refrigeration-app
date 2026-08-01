import * as RadixCheckbox from '@radix-ui/react-checkbox'
import CheckIcon from '@/shared/assets/icons/check.svg?react'
import styles from './Checkbox.module.scss'

interface CheckboxProps {
  id?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
}

export const Checkbox = ({ id, checked, onCheckedChange, label }: CheckboxProps) => (
  <label className={styles.root} htmlFor={id}>
    <RadixCheckbox.Root
      id={id}
      className={styles.box}
      checked={checked}
      onCheckedChange={(value) => onCheckedChange(value === true)}
    >
      <RadixCheckbox.Indicator className={styles.indicator}>
        <CheckIcon className={styles.icon} aria-hidden="true" />
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
    <span className={styles.label}>{label}</span>
  </label>
)
