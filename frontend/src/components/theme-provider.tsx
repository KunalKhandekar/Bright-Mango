import { useEffect } from 'react'
import { resolveTheme, useThemeStore } from '@/stores/theme.store'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement
    const apply = () => root.classList.toggle('dark', resolveTheme(theme) === 'dark')
    apply()
    if (theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  return <>{children}</>
}
