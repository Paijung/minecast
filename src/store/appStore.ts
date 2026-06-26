// src/store/appStore.ts
// MineCast Global State with Zustand

import { create } from 'zustand'
import { Location, ForecastHour, ActualRecord, Page, Theme } from '../types'

interface AppStore {
  // Page Navigation
  currentPage: Page
  setCurrentPage: (page: Page) => void

  // Sidebar
  sidebarCollapsed: boolean
  setSidebarCollapsed: (v: boolean) => void
  toggleSidebar: () => void

  // Location
  activeLocation: Location | null
  setActiveLocation: (loc: Location | null) => void

  // Weather Data
  forecastData: ForecastHour[]
  setForecastData: (data: ForecastHour[]) => void
  lastRefreshed: Date | null
  setLastRefreshed: (d: Date) => void
  isLoading: boolean
  setIsLoading: (v: boolean) => void
  loadError: string | null
  setLoadError: (e: string | null) => void

  // Actuals
  actuals: Record<number, boolean> // hour -> isRaining
  setActual: (hour: number, isRaining: boolean) => void
  loadActuals: (records: ActualRecord[]) => void

  // Theme
  theme: Theme
  effectiveTheme: 'light' | 'dark'
  setTheme: (t: Theme) => void
  setEffectiveTheme: (t: 'light' | 'dark') => void

  // Notifications / Toast
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void

  // App Paths
  paths: { app_dir: string; backup_dir: string; export_dir: string; log_dir: string } | null
  setPaths: (p: AppStore['paths']) => void
}

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  duration?: number
}

export const useAppStore = create<AppStore>((set, get) => ({
  currentPage: 'home',
  setCurrentPage: (page) => set({ currentPage: page }),

  sidebarCollapsed: false,
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  activeLocation: null,
  setActiveLocation: (loc) => set({ activeLocation: loc }),

  forecastData: [],
  setForecastData: (data) => set({ forecastData: data }),
  lastRefreshed: null,
  setLastRefreshed: (d) => set({ lastRefreshed: d }),
  isLoading: false,
  setIsLoading: (v) => set({ isLoading: v }),
  loadError: null,
  setLoadError: (e) => set({ loadError: e }),

  actuals: {},
  setActual: (hour, isRaining) => set((s) => ({
    actuals: { ...s.actuals, [hour]: isRaining }
  })),
  loadActuals: (records) => {
    const actuals: Record<number, boolean> = {}
    records.forEach(r => { actuals[r.record_hour] = r.is_raining })
    set({ actuals })
  },

  theme: 'system',
  effectiveTheme: 'dark',
  setTheme: (t) => set({ theme: t }),
  setEffectiveTheme: (t) => set({ effectiveTheme: t }),

  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).slice(2)
    const newToast: Toast = { ...toast, id }
    set((s) => ({ toasts: [...s.toasts, newToast] }))
    const duration = toast.duration ?? 4000
    if (duration > 0) {
      setTimeout(() => get().removeToast(id), duration)
    }
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) })),

  paths: null,
  setPaths: (p) => set({ paths: p }),
}))
