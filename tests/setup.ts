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
