// src/components/layout/Sidebar.tsx

import { useAppStore } from '../../store/appStore'
import { Page } from '../../types'
import {
  LayoutDashboard, BarChart2, Database, Settings,
  ChevronLeft, ChevronRight, Pickaxe, CloudRain
} from 'lucide-react'
import styles from './Sidebar.module.css'

interface NavItem {
  id: Page
  label: string
  icon: React.ReactNode
  description: string
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'home',
    label: 'Beranda',
    icon: <LayoutDashboard size={18} />,
    description: 'Menu utama aplikasi',
  },
  {
    id: 'monitoring',
    label: 'Monitoring Harian',
    icon: <CloudRain size={18} />,
    description: 'Forecast cuaca 24 jam',
  },
  {
    id: 'history',
    label: 'Database Histori',
    icon: <Database size={18} />,
    description: 'Riwayat data cuaca',
  },
  {
    id: 'statistics',
    label: 'Statistik & Akurasi',
    icon: <BarChart2 size={18} />,
    description: 'Analisis akurasi forecast',
  },
  {
    id: 'settings',
    label: 'Pengaturan',
    icon: <Settings size={18} />,
    description: 'Konfigurasi aplikasi',
  },
]

export default function Sidebar() {
  const { currentPage, setCurrentPage, sidebarCollapsed, toggleSidebar } = useAppStore()

  return (
    <aside className={`${styles.sidebar} ${sidebarCollapsed ? styles.collapsed : ''}`}>
      {/* Logo Area */}
      <div className={styles.logoArea}>
        <div className={styles.logoIcon}>
          <Pickaxe size={20} />
        </div>
        {!sidebarCollapsed && (
          <div className={styles.logoText}>
            <span className={styles.logoTitle}>MineCast</span>
            <span className={styles.logoSub}>Cuaca Pertambangan</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className={styles.nav}>
        {!sidebarCollapsed && (
          <span className={styles.navLabel}>MENU</span>
        )}
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`${styles.navItem} ${currentPage === item.id ? styles.active : ''}`}
            onClick={() => setCurrentPage(item.id)}
            title={sidebarCollapsed ? item.label : undefined}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            {!sidebarCollapsed && (
              <span className={styles.navItemText}>{item.label}</span>
            )}
            {currentPage === item.id && <span className={styles.activeIndicator} />}
          </button>
        ))}
      </nav>

      {/* Collapse Toggle */}
      <button className={styles.collapseBtn} onClick={toggleSidebar}>
        {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        {!sidebarCollapsed && <span>Sembunyikan</span>}
      </button>
    </aside>
  )
}
