import { NavLink } from 'react-router'
import clsx from 'clsx'
import type { MenuItem } from '@/shared/config'
import styles from './Sidebar.module.scss'

interface SidebarNavItemProps {
  item: MenuItem
}

export const SidebarNavItem = ({ item }: SidebarNavItemProps) => {
  const Icon = item.icon

  if (item.isDisabled || !item.path) {
    return (
      <span className={clsx(styles.navItem, styles.navItemDisabled)} aria-disabled="true">
        <Icon className={styles.navIcon} aria-hidden="true" />
        <span className={styles.label}>{item.label}</span>
      </span>
    )
  }

  return (
    <NavLink
      to={item.path}
      className={({ isActive }) => clsx(styles.navItem, isActive && styles.navItemActive)}
    >
      <Icon className={styles.navIcon} aria-hidden="true" />
      <span className={styles.label}>{item.label}</span>
    </NavLink>
  )
}
