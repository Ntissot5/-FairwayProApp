import { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { VideoView, useVideoPlayer } from 'expo-video'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import * as FileSystem from 'expo-file-system/legacy'
import { decode } from 'base64-arraybuffer'
import { supabase } from './supabase'
import { colors } from './theme'

function VideoPlayer({ url, onClose }) {
  const player = useVideoPlayer(url, p => { p.play() })
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <TouchableOpacity onPress={onClose} style={{ position: 'absolute', top: 56, right: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.textInverse, fontSize: 18 }}>✕</Text>
        </TouchableOpacity>
        <VideoView player={player} style={{ flex: 1 }} contentFit="contain" allowsFullscreen />
      </View>
    </Modal>
  )
}

export default function PlayerVideosScreen() {
  const { t } = useTranslation()
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [playingVideo, setPlayingVideo] = useState(null)
  const [playerId, setPlayerId] = useState(null)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: player } = await supabase.from('players').select('id').eq('player_user_id', user.id).single()
    if (player) {
      setPlayerId(player.id)
      const { data: v } = await supabase.from('swing_videos').select('*').eq('player_id', player.id).order('created_at', { ascending: false })
      setVideos(v || [])
    }
    setLoading(false)
  }

  const recordVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') { Alert.alert('Permission needed'); return }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], videoMaxDuration: 60 })
    if (result.canceled) return
    setUploading(true)
    try {
      const uri = result.assets[0].uri
      const fileName = 'swing_player_' + playerId + '_' + Date.now() + '.mp4'
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' })
      const arrayBuffer = decode(base64)
      const { error } = await supabase.storage.from('swing-videos').upload(fileName, arrayBuffer, { contentType: 'video/mp4', upsert: false })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('swing-videos').getPublicUrl(fileName)
      await supabase.from('swing_videos').insert({ player_id: playerId, video_url: publicUrl, title: 'Swing ' + new Date().toLocaleDateString('fr-FR') })
      Alert.alert(t('player_videos.uploaded'))
      fetchAll()
    } catch(e) { Alert.alert('Error', e.message) }
    setUploading(false)
  }

  const deleteVideo = async (id) => {
    Alert.alert('Supprimer ?', 'Cette vidéo sera supprimée.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await supabase.from('swing_videos').delete().eq('id', id)
        fetchAll()
      }}
    ])
  }

  if (loading) return <View style={s.loading}><ActivityIndicator color={colors.primary} size="large" /></View>

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>Swing Videos</Text>
          <Text style={s.sub}>Your recordings</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={recordVideo} disabled={uploading}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="videocam-outline" size={14} color="#fff" /><Text style={s.addBtnTxt}>{uploading ? '...' : t('player_videos.film')}</Text></View>
        </TouchableOpacity>
      </View>

      {playingVideo && <VideoPlayer url={playingVideo} onClose={() => setPlayingVideo(null)} />}

      <ScrollView style={s.scroll}>
        {videos.length === 0 ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Ionicons name="videocam-outline" size={40} color={colors.primary} style={{ marginBottom: 16 }} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 }}>No videos yet</Text>
            <Text style={{ fontSize: 13, color: colors.textTertiary, textAlign: 'center', marginBottom: 24 }}>{t('player_videos.empty_sub')}</Text>
            <TouchableOpacity style={s.addBtn} onPress={recordVideo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Ionicons name="videocam-outline" size={16} color="#fff" /><Text style={s.addBtnTxt}>{t('player_videos.film_swing')}</Text></View>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.section}>
            {videos.map(v => (
              <View key={v.id} style={s.videoRow}>
                <TouchableOpacity style={s.videoThumb} onPress={() => setPlayingVideo(v.video_url)}>
                  <Ionicons name="play-circle-outline" size={28} color="#fff" />
                </TouchableOpacity>
                <View style={s.videoInfo}>
                  <Text style={s.videoTitle}>{v.title || 'Swing video'}</Text>
                  <Text style={s.videoDate}>{new Date(v.created_at).toLocaleDateString('fr-FR')}</Text>
                  <TouchableOpacity onPress={() => setPlayingVideo(v.video_url)} style={s.watchBtn}>
                    <Text style={s.watchBtnTxt}>▶ {t('player_videos.watch')}</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => deleteVideo(v.id)} style={s.deleteBtn}>
                  <Text style={{ color: colors.error, fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceElevated },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: colors.surface, padding: 16, paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 0.5, borderBottomColor: colors.borderStrong },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  sub: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  scroll: { flex: 1 },
  addBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  addBtnTxt: { color: colors.textInverse, fontSize: 13, fontWeight: '700' },
  section: { backgroundColor: colors.surface, borderRadius: 16, margin: 16, borderWidth: 0.5, borderColor: colors.borderStrong, overflow: 'hidden' },
  videoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 0.5, borderBottomColor: colors.surfaceElevated },
  videoThumb: { width: 60, height: 60, borderRadius: 10, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  videoInfo: { flex: 1 },
  videoTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  videoDate: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  watchBtn: { marginTop: 6, backgroundColor: colors.primaryLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  watchBtnTxt: { fontSize: 12, fontWeight: '600', color: colors.primary },
  deleteBtn: { padding: 8 },
})
