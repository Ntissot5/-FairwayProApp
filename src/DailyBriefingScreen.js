import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'

const G = '#1B5E35'

export default function DailyBriefingScreen() {
  const { t } = useTranslation()
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <Ionicons name="sunny-outline" size={48} color={G} />
        <Text style={s.title}>{t('briefing.title')}</Text>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f8f8' },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  title: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
})
