import type { ComponentType } from 'react'
import { createContext, useContext } from 'react'

// Реестр модалок по имени — не useState в каждом виджете. Фичи добавляют сюда
// свою запись, когда заводят модалку (см. docs/structure.md → "Модалки").
export type ModalProps = Record<string, unknown>

export const MODAL_REGISTRY: Record<string, ComponentType<ModalProps>> = {}

export interface ModalEntry {
  name: string
  props: ModalProps
}

export interface ModalContextValue {
  open: (name: string, props?: ModalProps) => void
  close: () => void
}

export const ModalContext = createContext<ModalContextValue | null>(null)

export const useModal = (): ModalContextValue => {
  const context = useContext(ModalContext)
  if (!context) {
    throw new Error('useModal должен использоваться внутри ModalProvider')
  }
  return context
}
