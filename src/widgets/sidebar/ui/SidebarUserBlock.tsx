import clsx from 'clsx'
import styles from './Sidebar.module.scss'

interface SidebarUserBlockProps {
  name: string
  avatarUrl: string | null
}

export const SidebarUserBlock = ({ name, avatarUrl }: SidebarUserBlockProps) => {
  const initial = name.trim().charAt(0).toUpperCase() || '?'

  return (
    <div className={styles.userBlock}>
      <div className={styles.avatar}>
        {avatarUrl ? <img src={avatarUrl} alt="" className={styles.avatarImage} /> : initial}
      </div>
      <span className={clsx(styles.label, styles.userName)}>{name}</span>
    </div>
  )
}
