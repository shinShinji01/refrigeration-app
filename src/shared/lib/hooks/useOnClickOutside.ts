import { useEffect } from 'react'
import type { RefObject } from 'react'

export const useOnClickOutside = <T extends HTMLElement>(
  ref: RefObject<T | null>,
  handler: () => void,
  enabled = true,
): void => {
  useEffect(() => {
    if (!enabled) return

    const listener = (event: PointerEvent) => {
      const element = ref.current
      if (!element || element.contains(event.target as Node)) {
        return
      }
      handler()
    }

    document.addEventListener('pointerdown', listener)
    return () => document.removeEventListener('pointerdown', listener)
  }, [ref, handler, enabled])
}
