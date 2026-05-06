import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const G = '#1B5E35'

export default function SessionSummaryScreen({ route }) {
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <ActivityIndicator size="large" color={G} />
        <Text style={s.text}>Generating summary...</Text>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f8f8' },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  text: { fontSize: 16, color: '#6B7280', fontWeight: '500' },
})
