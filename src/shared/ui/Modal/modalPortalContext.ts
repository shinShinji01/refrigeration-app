import { createContext } from 'react'

// undefined — компонент не внутри модалки (портал по умолчанию — document.body).
// null — внутри модалки, но DOM-узел Dialog.Content ещё не примонтирован.
// HTMLElement — узел готов, есть куда порталить.
// Нужен, чтобы плавающие списки (@floating-ui/react FloatingPortal) — например,
// поиск в children-picker — рендерились внутри Dialog.Content, а не в document.body:
// иначе Radix Dialog считает клики по ним кликом "вне" модалки (DismissableLayer)
// и не даёт им сработать, а скролл не подхватывается как часть модалки.
export const ModalPortalContext = createContext<HTMLElement | null | undefined>(undefined)
