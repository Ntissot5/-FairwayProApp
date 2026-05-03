import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { lightColors, darkColors, typography, spacing, radius } from './theme'

const STORAGE_KEY = '@fairwaypro_theme'
const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme()
  const [mode, setMode] = useState('system') // 'light' | 'dark' | 'system'

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(v => { if (v) setMode(v) })
  }, [])

  const setThemeMode = (m) => {
    setMode(m)
    AsyncStorage.setItem(STORAGE_KEY, m)
  }

  const isDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark'
  const colors = isDark ? darkColors : lightColors

  const value = useMemo(() => ({
    colors,
    isDark,
    mode,
    setThemeMode,
    typography,
    spacing,
    radius,
  }), [isDark, mode])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
