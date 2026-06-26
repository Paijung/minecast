// src/components/ui/ToastContainer.tsx

import { useAppStore, Toast } from '../../store/appStore'
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react'
import styles from './ToastContainer.module.css'

const ICONS = {
  success: <CheckCircle size={15} />,
  error: <XCircle size={15} />,
  info: <Info size={15} />,
  warning: <AlertTriangle size={15} />,
}

const COLORS = {
  success: '#22c55e',
  error: '#ef4444',
  info: '#0ea5e9',
  warning: '#f59e0b',
}

export default function ToastContainer() {
  const { toasts, removeToast } = useAppStore()

  return (
    <div className={styles.container}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`${styles.toast} ${styles[toast.type]} animate-slide-in`}
          style={{ borderLeftColor: COLORS[toast.type] }}
        >
          <span className={styles.icon} style={{ color: COLORS[toast.type] }}>
            {ICONS[toast.type]}
          </span>
          <span className={styles.message}>{toast.message}</span>
          <button className={styles.close} onClick={() => removeToast(toast.id)}>
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}
