import type { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import CloseIcon from '@/shared/assets/icons/close.svg?react'
import { IconButton } from '../IconButton'
import styles from './Modal.module.scss'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
}

// Escape / клик вне / кнопка закрытия — всё даёт Radix Dialog из коробки
// (docs/decisions.md №7). Компонент существует в дереве, только пока модалка
// открыта (см. ModalProvider) — Dialog.Root поэтому всегда open.
export const Modal = ({ title, onClose, children }: ModalProps) => (
  <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
    <Dialog.Portal>
      <Dialog.Overlay className={styles.overlay} />
      <Dialog.Content className={styles.content}>
        <div className={styles.header}>
          <Dialog.Title className={styles.title}>{title}</Dialog.Title>
          <Dialog.Close asChild>
            <IconButton icon={CloseIcon} label="Закрыть" />
          </Dialog.Close>
        </div>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
)
