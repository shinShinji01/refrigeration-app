import type { RefObject } from 'react'
import { useCallback, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { useOnClickOutside } from '@/shared/lib/hooks'

interface UseSidebarResult {
  isExpanded: boolean
  toggle: () => void
  containerRef: RefObject<HTMLElement | null>
}

// Одно состояние на оба форм-фактора: на десктопе разворачивает узкую полосу
// в панель с подписями, на мобильном раскрывает полную панель под верхней
// полосой. Разница — только в CSS (respond-to), см. Sidebar.module.scss.
export const useSidebar = (): UseSidebarResult => {
  const [isExpanded, setIsExpanded] = useState(false)
  const containerRef = useRef<HTMLElement | null>(null)

  // Переход по ссылке в меню — тоже закрытие, иначе на мобильном разворот
  // остаётся поверх открывшейся страницы. Сравнение с предыдущим значением
  // прямо во время рендера — не useEffect, см. react.dev "adjusting state
  // when a prop changes".
  const { pathname } = useLocation()
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setIsExpanded(false)
  }

  const toggle = useCallback(() => setIsExpanded((value) => !value), [])
  const close = useCallback(() => setIsExpanded(false), [])

  useOnClickOutside(containerRef, close, isExpanded)

  return { isExpanded, toggle, containerRef }
}
