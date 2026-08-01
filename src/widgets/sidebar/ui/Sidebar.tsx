import { useGetFirstUserQuery, getUserAvatarUrl } from '@/entities/user'
import { IconButton } from '@/shared/ui'
import { MENU_ITEMS } from '@/shared/config'
import ToggleIcon from '@/shared/assets/icons/sidebar-toggle.svg?react'
import { useSidebar } from '../model/useSidebar'
import { SidebarNavItem } from './SidebarNavItem'
import { SidebarUserBlock } from './SidebarUserBlock'
import styles from './Sidebar.module.scss'

export const Sidebar = () => {
  const { isExpanded, toggle, containerRef } = useSidebar()
  const { data: user } = useGetFirstUserQuery()

  return (
    <nav ref={containerRef} className={styles.root} data-expanded={isExpanded}>
      <div className={styles.bar}>
        <IconButton
          icon={ToggleIcon}
          label={isExpanded ? 'Свернуть меню' : 'Развернуть меню'}
          aria-expanded={isExpanded}
          onClick={toggle}
        />
      </div>
      <div className={styles.panel}>
        <ul className={styles.navList}>
          {MENU_ITEMS.map((item) => (
            <li key={item.id}>
              <SidebarNavItem item={item} />
            </li>
          ))}
        </ul>
        {user ? (
          <SidebarUserBlock name={user.name || user.email} avatarUrl={getUserAvatarUrl(user)} />
        ) : null}
      </div>
    </nav>
  )
}
