import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// Первый в кодовой базе тестовый файл, использующий RTL render() — без
// глобальной регистрации cleanup DOM накапливается между тестами внутри
// одного файла (нет `test.globals: true`, поэтому автодетект RTL не
// находит глобальный `afterEach`).
afterEach(() => {
  cleanup()
})

// jsdom не реализует ResizeObserver — features/shape-editor использует его
// для постоянного на экране размера маркеров вершин (см.
// docs/superpowers/specs/2026-08-16-shape-editor-measurements-design.md).
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = ResizeObserverMock
}
