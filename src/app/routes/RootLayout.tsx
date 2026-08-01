import { Outlet } from 'react-router'
import { Sidebar } from '@/widgets/sidebar'
import styles from './RootLayout.module.scss'

export const RootLayout = () => (
  <div className={styles.root}>
    <Sidebar />
    <main className={styles.content}>
      <Outlet />
    </main>
  </div>
)
