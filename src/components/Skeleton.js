import { useEffect, useRef } from 'react'
import { Animated, View } from 'react-native'
import { useTheme } from '../ThemeContext'

export default function Skeleton({ width, height, borderRadius = 8, style }) {
  const opacity = useRef(new Animated.Value(0.3)).current
  const { isDark } = useTheme()

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [])

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: isDark ? '#3A3A3C' : '#E5E7EB',
          opacity,
        },
        style,
      ]}
    />
  )
}

// Pre-built skeleton layouts
export function DashboardSkeleton() {
  return (
    <View style={{ padding: 16, gap: 16 }}>
      <Skeleton width="60%" height={28} borderRadius={6} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Skeleton width="100%" height={100} borderRadius={14} style={{ flex: 2 }} />
        <View style={{ flex: 1, gap: 12 }}>
          <Skeleton height={44} borderRadius={14} />
          <Skeleton height={44} borderRadius={14} />
        </View>
      </View>
      <Skeleton width="100%" height={180} borderRadius={14} />
      <View style={{ gap: 12 }}>
        {[0, 1, 2].map(i => (
          <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Skeleton width={40} height={40} borderRadius={20} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="70%" height={14} borderRadius={4} />
              <Skeleton width="40%" height={12} borderRadius={4} />
            </View>
            <Skeleton width={50} height={14} borderRadius={4} />
          </View>
        ))}
      </View>
    </View>
  )
}

export function PlayerListSkeleton() {
  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Skeleton width="40%" height={28} borderRadius={6} />
      <Skeleton width="100%" height={40} borderRadius={10} />
      {[0, 1, 2, 3, 4].map(i => (
        <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 8 }}>
          <Skeleton width={44} height={44} borderRadius={22} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="60%" height={16} borderRadius={4} />
            <Skeleton width="35%" height={12} borderRadius={4} />
          </View>
        </View>
      ))}
    </View>
  )
}

export function CardListSkeleton() {
  return (
    <View style={{ padding: 16, gap: 12 }}>
      {[0, 1, 2].map(i => (
        <Skeleton key={i} width="100%" height={120} borderRadius={14} />
      ))}
    </View>
  )
}
