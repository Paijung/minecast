// src/components/pages/HomePage.tsx

import { useAppStore } from '../../store/appStore'
import { Page } from '../../types'
import { CloudRain, Database, BarChart2, Settings, Pickaxe, MapPin, Clock } from 'lucide-react'
import styles from './HomePage.module.css'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'

interface MenuCard {
  page: Page
  icon: React.ReactNode
  title: string
  desc: string
  color: string
  accent: string
}

const MENU_CARDS: MenuCard[] = [
  {
    page: 'monitoring',
    icon: <CloudRain size={32} />,
    title: 'Monitoring Harian',
    desc: 'Pantau kondisi cuaca 24 jam ke depan beserta status operasi pertambangan secara real-time.',
    color: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
    accent: '#0ea5e9',
  },
  {
    page: 'history',
    icon: <Database size={32} />,
    title: 'Database Histori',
    desc: 'Telusuri dan analisis data historis cuaca dan forecast yang tersimpan di database lokal.',
    color: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    accent: '#8b5cf6',
  },
  {
    page: 'statistics',
    icon: <BarChart2 size={32} />,
    title: 'Statistik & Akurasi',
    desc: 'Lihat tingkat akurasi forecast BMKG/Open-Meteo dan statistik curah hujan secara detail.',
    color: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    accent: '#f59e0b',
  },
  {
    page: 'settings',
    icon: <Settings size={32} />,
    title: 'Pengaturan',
    desc: 'Konfigurasi lokasi, tema, backup database, export data, dan preferensi aplikasi lainnya.',
    color: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    accent: '#10b981',
  },
]

export default function HomePage() {
  const { setCurrentPage, activeLocation } = useAppStore()
  const now = new Date()

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.brandIcon}>
            <Pickaxe size={28} />
          </div>
          <div>
            <h1 className={styles.title}>MineCast</h1>
            <p className={styles.subtitle}>Sistem Monitoring Cuaca Operasional Pertambangan Batu Bara</p>
          </div>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.timeBox}>
            <Clock size={14} />
            <span>{format(now, 'EEEE, dd MMMM yyyy', { locale: id })}</span>
          </div>
          {activeLocation && (
            <div className={styles.locationBox}>
              <MapPin size={14} />
              <span>{activeLocation.name}{activeLocation.province ? `, ${activeLocation.province}` : ''}</span>
            </div>
          )}
        </div>
      </div>

      {/* Location Warning */}
      {!activeLocation && (
        <div className={styles.locationWarning}>
          <span className={styles.warningIcon}>⚠️</span>
          <div>
            <strong>Lokasi belum diatur.</strong> Pergi ke Pengaturan untuk mencari dan menyimpan lokasi pertambangan Anda.
          </div>
          <button className='btn btn-accent btn-sm' onClick={() => setCurrentPage('settings')}>
            Atur Sekarang
          </button>
        </div>
      )}

      {/* Menu Grid */}
      <div className={styles.menuGrid}>
        {MENU_CARDS.map(card => (
          <button
            key={card.page}
            className={styles.menuCard}
            onClick={() => setCurrentPage(card.page)}
            style={{ '--accent': card.accent } as React.CSSProperties}
          >
            <div className={styles.cardIcon} style={{ background: card.color }}>
              {card.icon}
            </div>
            <div className={styles.cardBody}>
              <h2 className={styles.cardTitle}>{card.title}</h2>
              <p className={styles.cardDesc}>{card.desc}</p>
            </div>
            <div className={styles.cardArrow}>→</div>
          </button>
        ))}
      </div>

      {/* Footer Info */}
      <div className={styles.footer}>
        <div className={styles.footerItem}>
          <span className={styles.footerDot} style={{ background: '#22c55e' }} />
          <span>BMKG (Utama)</span>
        </div>
        <div className={styles.footerItem}>
          <span className={styles.footerDot} style={{ background: '#0ea5e9' }} />
          <span>Open-Meteo (Fallback)</span>
        </div>
        <div className={styles.footerSep} />
        <span className={styles.footerVersion}>MineCast v1.0.0</span>
      </div>
    </div>
  )
}
