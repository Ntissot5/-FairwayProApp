import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, Alert, Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from './supabase'
import { useTranslation } from 'react-i18next'
import AnimatedPressable from './components/AnimatedPressable'

export default function CreateScreen({ navigation }) {
  const { t } = useTranslation()
  const [players, setPlayers] = useState([])
  const [coachId, setCoachId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fadeAnim = useState(new Animated.Value(0))[0]

  useEffect(() => {
    fetchPlayers()
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start()
  }, [])

  const fetchPlayers = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCoachId(user.id)
    const { data } = await supabase.from('players').select('*').eq('coach_id', user.id)
    setPlayers(data || [])
  }

  const close = () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      navigation.goBack()
    })
  }

  const pickPlayer = (callback) => {
    if (players.length === 0) { Alert.alert(t('create.noPlayers'), t('create.noPlayersMsg')); return }
    if (players.length === 1) { callback(players[0]); return }
    const buttons = players.map(p => ({ text: p.full_name, onPress: () => callback(p) }))
    buttons.push({ text: t('common.cancel'), style: 'cancel' })
    Alert.alert(t('create.selectPlayer'), t('create.selectPlayerMsg'), buttons)
  }

  const takeVideo = () => {
    pickPlayer(async (player) => {
      close()
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') { Alert.alert(t('common.permissionNeeded')); return }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], videoMaxDuration: 60 })
      if (result.canceled) return
      try {
        const uri = result.assets[0].uri
        const fileName = 'swing_' + player.id + '_' + Date.now() + '.mp4'
        const response = await fetch(uri)
        const blob = await response.blob()
        const { error } = await supabase.storage.from('swing-videos').upload(fileName, blob, { contentType: 'video/mp4' })
        if (error) throw error
        const { data: { publicUrl } } = supabase.storage.from('swing-videos').getPublicUrl(fileName)
        await supabase.from('swing_videos').insert({ player_id: player.id, coach_id: coachId, video_url: publicUrl, title: 'Swing ' + new Date().toLocaleDateString('fr-FR') })
        Alert.alert(t('create.videoSent', { name: player.full_name }))
      } catch (e) { Alert.alert(t('common.error'), e.message) }
    })
  }

  const takePhoto = () => {
    pickPlayer(async (player) => {
      close()
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') { Alert.alert(t('common.permissionNeeded')); return }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'] })
      if (result.canceled) return
      try {
        const uri = result.assets[0].uri
        const fileName = 'photo_' + player.id + '_' + Date.now() + '.jpg'
        const response = await fetch(uri)
        const blob = await response.blob()
        const { error } = await supabase.storage.from('swing-videos').upload(fileName, blob, { contentType: 'image/jpeg' })
        if (error) throw error
        const { data: { publicUrl } } = supabase.storage.from('swing-videos').getPublicUrl(fileName)
        await supabase.from('swing_videos').insert({ player_id: player.id, coach_id: coachId, video_url: publicUrl, title: 'Photo ' + new Date().toLocaleDateString('fr-FR') })
        Alert.alert(t('create.photoSent', { name: player.full_name }))
      } catch (e) { Alert.alert(t('common.error'), e.message) }
    })
  }

  const fromLibrary = () => {
    pickPlayer(async (player) => {
      close()
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos', 'images'] })
      if (result.canceled) return
      try {
        const asset = result.assets[0]
        const isVideo = asset.type === 'video'
        const ext = isVideo ? '.mp4' : '.jpg'
        const fileName = (isVideo ? 'swing_' : 'photo_') + player.id + '_' + Date.now() + ext
        const response = await fetch(asset.uri)
        const blob = await response.blob()
        const { error } = await supabase.storage.from('swing-videos').upload(fileName, blob, { contentType: isVideo ? 'video/mp4' : 'image/jpeg' })
        if (error) throw error
        const { data: { publicUrl } } = supabase.storage.from('swing-videos').getPublicUrl(fileName)
        await supabase.from('swing_videos').insert({ player_id: player.id, coach_id: coachId, video_url: publicUrl, title: (isVideo ? 'Video' : 'Photo') + ' ' + new Date().toLocaleDateString('fr-FR') })
        Alert.alert(t('create.sent', { name: player.full_name }))
      } catch (e) { Alert.alert(t('common.error'), e.message) }
    })
  }

  const sendNote = () => {
    pickPlayer((player) => { close(); navigation.navigate('Space', { player }) })
  }

  const aiPlan = () => {
    pickPlayer(async (player) => {
      try {
        const response = await fetch('https://aqdifzgqfemfdcigxsgw.supabase.co/functions/v1/claude-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 500, messages: [{ role: 'user', content: 'Generate 3 golf training exercises. Return ONLY a JSON array: [{"title":"...","description":"..."}] Player: ' + player.full_name + ', HCP: ' + player.current_handicap }] })
        })
        const data = await response.json()
        const text = data.content?.[0]?.text || '[]'
        const clean = text.replace(/```json|```/g, '').trim()
        const exercises = JSON.parse(clean)
        for (const ex of exercises) {
          await supabase.from('exercises').insert({ player_id: player.id, coach_id: coachId, title: ex.title, description: ex.description, completed: false })
        }
        Alert.alert(t('create.planSent', { name: player.full_name }), t('create.exercisesGenerated'))
        close()
      } catch (e) { Alert.alert(t('common.error'), e.message) }
    })
  }

  const openAICoach = () => {
    close()
    setTimeout(() => navigation.navigate('AICoach'), 250)
  }

  const actions = [
    { icon: 'videocam-outline', label: t('create.takeVideo'), sub: t('create.takeVideoSub'), onPress: takeVideo },
    { icon: 'camera-outline', label: t('create.takePhoto'), sub: t('create.takePhotoSub'), onPress: takePhoto },
    { icon: 'images-outline', label: t('create.library'), sub: t('create.librarySub'), onPress: fromLibrary },
    { icon: 'chatbubble-outline', label: t('create.note'), sub: t('create.noteSub'), onPress: sendNote },
    { icon: 'sparkles-outline', label: t('create.aiPlan'), sub: t('create.aiPlanSub'), onPress: aiPlan },
    { icon: 'hardware-chip-outline', label: t('create.aiCoach'), sub: t('create.aiCoachSub'), onPress: openAICoach },
  ]

  return (
    <Animated.View style={[s.container, { opacity: fadeAnim }]}>
      <SafeAreaView style={s.safe}>
        <View style={s.content}>
          <View style={s.grid}>
            {actions.map((a, i) => (
              <AnimatedPressable key={i} style={s.action} onPress={a.onPress} hapticStyle="medium">
                <View style={s.iconWrap}>
                  <Ionicons name={a.icon} size={26} color="#fff" />
                </View>
                <Text style={s.label}>{a.label}</Text>
                <Text style={s.sub}>{a.sub}</Text>
              </AnimatedPressable>
            ))}
          </View>
        </View>

        <AnimatedPressable style={s.closeBtn} onPress={close} hapticStyle="medium">
          <View style={s.closeBtnInner}>
            <Ionicons name="close" size={24} color="#fff" />
          </View>
        </AnimatedPressable>
      </SafeAreaView>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'rgba(10,10,10,0.96)' },
  safe: { flex: 1, justifyContent: 'space-between' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 24 },
  action: { width: 90, alignItems: 'center', gap: 6 },
  iconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: '#fff', textAlign: 'center' },
  sub: { fontSize: 10, color: 'rgba(255,255,255,0.5)', textAlign: 'center' },
  closeBtn: { alignItems: 'center', paddingBottom: 20 },
  closeBtnInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1B5E35', alignItems: 'center', justifyContent: 'center' },
})
