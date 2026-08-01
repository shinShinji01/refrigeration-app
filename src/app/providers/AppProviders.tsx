import type { ReactNode } from 'react'
import { StoreProvider } from './StoreProvider'
import { ModalProvider } from './ModalProvider'

interface AppProvidersProps {
  children: ReactNode
}

export const AppProviders = ({ children }: AppProvidersProps) => {
  return (
    <StoreProvider>
      <ModalProvider>{children}</ModalProvider>
    </StoreProvider>
  )
}
