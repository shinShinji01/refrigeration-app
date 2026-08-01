import type { ReactNode } from 'react'
import { useCallback, useMemo, useState } from 'react'
import {
  MODAL_REGISTRY,
  ModalContext,
  type ModalContextValue,
  type ModalEntry,
  type ModalProps,
} from './modalContext'

interface ModalProviderProps {
  children: ReactNode
}

export const ModalProvider = ({ children }: ModalProviderProps) => {
  const [modal, setModal] = useState<ModalEntry | null>(null)

  const open = useCallback((name: string, props: ModalProps = {}) => {
    setModal({ name, props })
  }, [])

  const close = useCallback(() => setModal(null), [])

  const value = useMemo<ModalContextValue>(() => ({ open, close }), [open, close])

  const ActiveModal = modal ? MODAL_REGISTRY[modal.name] : undefined

  return (
    <ModalContext.Provider value={value}>
      {children}
      {ActiveModal ? <ActiveModal {...modal?.props} /> : null}
    </ModalContext.Provider>
  )
}
