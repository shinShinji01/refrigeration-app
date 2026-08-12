import { describe, expect, it } from 'vitest'
import { resolveDoneCount } from './resolveDoneCount'

describe('resolveDoneCount', () => {
  it('возвращает число как есть', () => {
    expect(resolveDoneCount(2, 5)).toBe(2)
  })

  it('true (легаси-запись) трактует как «полностью готово»', () => {
    expect(resolveDoneCount(true, 5)).toBe(5)
  })

  it('undefined (ключа нет в donePieces) — 0', () => {
    expect(resolveDoneCount(undefined, 5)).toBe(0)
  })

  it('0 остаётся 0', () => {
    expect(resolveDoneCount(0, 5)).toBe(0)
  })
})
