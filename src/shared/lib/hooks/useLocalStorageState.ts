import { useState } from 'react'

// Настройки отображения списка изоляции (widgets/insulation-group-list),
// которые должны переживать перезагрузку страницы (docs/superpowers/specs/
// 2026-08-10-insulation-view-controls-design.md). Обычный useState +
// синхронизация с Web Storage API — без Redux, масштаб не тот (пара
// примитивных полей, не серверные и не доменные данные).
export const useLocalStorageState = <T,>(key: string, initial: T): [T, (value: T) => void] => {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key)
      return stored === null ? initial : (JSON.parse(stored) as T)
    } catch {
      return initial
    }
  })

  const setPersisted = (next: T) => {
    setValue(next)
    try {
      window.localStorage.setItem(key, JSON.stringify(next))
    } catch {
      // localStorage недоступен (приватный режим, квота) — в памяти всё равно обновилось
    }
  }

  return [value, setPersisted]
}
