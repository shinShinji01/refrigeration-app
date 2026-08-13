import type { ReactNode } from 'react'
import clsx from 'clsx'
import styles from './FloatingLabelField.module.scss'

interface FloatingLabelFieldProps {
  htmlFor: string
  label: string
  children: ReactNode
  className?: string
}

// Плавающий лейбл поля: чистый CSS через :has()/:placeholder-shown, без
// отслеживания фокуса/значения в React. Обёрнутый <input> обязан иметь
// id === htmlFor и placeholder=" " (один пробел) — без него :placeholder-shown
// не переключается по наличию значения.
export const FloatingLabelField = ({ htmlFor, label, children, className }: FloatingLabelFieldProps) => (
  <div className={clsx(styles.root, className)}>
    <label htmlFor={htmlFor} className={styles.label}>
      {label}
    </label>
    {children}
  </div>
)
