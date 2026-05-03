import { useRef, useCallback } from 'react'
import { Animated, TouchableOpacity } from 'react-native'
import * as Haptics from 'expo-haptics'

const HAPTIC_MAP = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
}

export default function AnimatedPressable({
  children,
  onPress,
  haptic = true,
  hapticStyle = 'light',
  style,
  activeOpacity = 1,
  ...props
}) {
  const scale = useRef(new Animated.Value(1)).current

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 4 }).start()
  }, [])

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start()
  }, [])

  const handlePress = useCallback((...args) => {
    if (haptic) Haptics.impactAsync(HAPTIC_MAP[hapticStyle] || HAPTIC_MAP.light)
    onPress?.(...args)
  }, [onPress, haptic, hapticStyle])

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={activeOpacity}
        style={style}
        {...props}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  )
}
