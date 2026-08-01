import { createBrowserRouter, Navigate } from 'react-router'
import { paths } from '@/shared/config'
import { RootLayout } from './RootLayout'

export const router = createBrowserRouter([
  {
    Component: RootLayout,
    HydrateFallback: () => null,
    children: [
      { path: paths.home, element: <Navigate to={paths.units} replace /> },
      {
        path: paths.units,
        lazy: async () => {
          const { UnitsPage: Component } = await import('@/pages/units')
          return { Component }
        },
      },
      {
        path: paths.stock,
        lazy: async () => {
          const { StockPage: Component } = await import('@/pages/stock')
          return { Component }
        },
      },
      {
        path: paths.insulation,
        lazy: async () => {
          const { InsulationPage: Component } = await import('@/pages/insulation')
          return { Component }
        },
      },
      {
        path: '*',
        lazy: async () => {
          const { NotFoundPage: Component } = await import('@/pages/not-found')
          return { Component }
        },
      },
    ],
  },
])
