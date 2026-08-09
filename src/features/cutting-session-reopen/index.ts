import type { ComponentType } from 'react'
import { MODAL_REGISTRY, type ModalProps } from '@/app/providers'
import { ReopenSessionDialog } from './ui/ReopenSessionDialog'

// Импорт этого модуля где угодно (см. InsulationFilterBar) гарантированно
// регистрирует модалку до первого open() (docs/structure.md → "Модалки").
export const REOPEN_CUTTING_SESSION_MODAL = 'reopenCuttingSession'

MODAL_REGISTRY[REOPEN_CUTTING_SESSION_MODAL] = ReopenSessionDialog as unknown as ComponentType<ModalProps>
