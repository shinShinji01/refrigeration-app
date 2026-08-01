export const paths = {
  home: '/',
  units: '/units',
  stock: '/stock',
  insulation: '/insulation',
} as const

export type AppPath = (typeof paths)[keyof typeof paths]
