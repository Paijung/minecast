// src/components/layout/TitleBar.tsx

import { useAppStore } from '../../store/appStore'
import { Pickaxe } from 'lucide-react'
import styles from './TitleBar.module.css'

export default function TitleBar() {
  const { activeLocation } = useAppStore()

  return (
    <div className={styles.titleBar} data-tauri-drag-region>
      <div className={styles.left}>
        <div className={styles.logo}>
          <Pickaxe size={16} />
        </div>
        <span className={styles.appName}>MineCast</span>
        {activeLocation && (
          <span className={styles.locationBadge}>
            📍 {activeLocation.name}
          </span>
        )}
      </div>
      <div className={styles.right}>
        <span className={styles.version}>v1.0.0</span>
      </div>
    </div>
  )
}
