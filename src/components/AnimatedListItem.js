import { useEffect, useRef } from 'react'
import { Animated } from 'react-native'

export default function AnimatedListItem({ children, index = 0, delay = 60, style }) {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(12)).current

  useEffect(() => {
    const stagger = Math.min(index * delay, 300) // cap at 300ms
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start()
    }, stagger)
    return () => clearTimeout(timer)
  }, [])

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  )
}
