import type { ComponentType } from 'react'
import { MODAL_REGISTRY, type ModalProps } from '@/app/providers'
import { ComponentEditModal } from './ui/ComponentEditModal'

// Импорт этого модуля где угодно (см. ComponentListCard) гарантированно
// регистрирует модалку до первого open() (docs/structure.md → "Модалки").
export const EDIT_COMPONENT_MODAL = 'editComponent'

// Реестр типизирован под общий ModalProps — конкретная форма пропсов каждой
// модалки известна только по соглашению (какое имя → какие props передаются
// в open()), TS этого не проверяет.
MODAL_REGISTRY[EDIT_COMPONENT_MODAL] = ComponentEditModal as ComponentType<ModalProps>
