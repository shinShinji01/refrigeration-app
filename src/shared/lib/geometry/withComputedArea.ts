import type { Geometry } from './types'
import { computeArea } from './computeArea'

// Единственная точка записи areaMm2 (docs/decisions.md №6) — все мутации
// куска изоляции обязаны проходить через эту функцию.
export const withComputedArea = <T extends { geometry: Geometry }>(piece: T) =>
  ({ ...piece, areaMm2: computeArea(piece.geometry) }) as T & { areaMm2: number }
