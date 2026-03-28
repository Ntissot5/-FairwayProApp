import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from './supabase'

const G = '#1B5E35'

export default function SubscribeScreen({ navigation }) {
  const () => navigation.replace('Welcome') = async () => {
    await supabase.auth.() => navigation.replace('Welcome')()
    navigation.replace('Welcome')
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <Text style={s.logo}>FairwayPro</Text>
        <Text style={s.title}>Abonne-toi pour accéder à ton academy.</Text>
        <Text style={s.sub}>Gère tes élèves, tes revenus et ton planning depuis ton iPhone.</Text>

        <TouchableOpacity style={s.btnPrimary} onPress={() => Linking.openURL('https://fairwaypro.io/?login=true')}>
          <Text style={s.btnPrimaryTxt}>Voir les offres →</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.btnGhost} onPress={() => navigation.replace('Welcome')}>
          <Text style={s.btnGhostTxt}>Se connecter avec un autre compte</Text>
        </TouchableOpacity>

        <Text style={s.note}>Tu as déjà un abonnement ? Connecte-toi sur fairwaypro.io pour vérifier ton compte.</Text>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f8f8' },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  logo: { fontSize: 28, fontWeight: '900', color: G, marginBottom: 32, letterSpacing: -1 },
  title: { fontSize: 26, fontWeight: '800', color: '#111', textAlign: 'center', letterSpacing: -0.5, marginBottom: 12 },
  sub: { fontSize: 16, color: '#6B7280', textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  btnPrimary: { backgroundColor: G, borderRadius: 14, padding: 16, width: '100%', alignItems: 'center', marginBottom: 12 },
  btnPrimaryTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnGhost: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 16, width: '100%', alignItems: 'center', marginBottom: 32 },
  btnGhostTxt: { color: '#6B7280', fontSize: 15, fontWeight: '500' },
  note: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', lineHeight: 18 },
})
