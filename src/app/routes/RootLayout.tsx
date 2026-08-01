import { Outlet } from 'react-router'

// Пока без сайдбара — просто прокладка для children. В этап 2 сюда переедет
// разметка с сайдбаром (см. docs/structure.md → widgets/sidebar).
export const RootLayout = () => <Outlet />
