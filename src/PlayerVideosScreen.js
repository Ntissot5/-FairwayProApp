import { useState, useEffect, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { VideoView, useVideoPlayer } from 'expo-video'
import { supabase } from './supabase'
import { useTheme } from './ThemeContext'
import { useTranslation } from 'react-i18next'
import AnimatedPressable from './components/AnimatedPressable'
import AnimatedListItem from './components/AnimatedListItem'
import { CardListSkeleton } from './components/Skeleton'

function VideoPlayer({ url, onClose }) {
  const player = useVideoPlayer(url, p => { p.play() })
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <AnimatedPressable onPress={onClose} style={{ position: 'absolute', top: 56, right: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="close" size={20} color="#fff" />
        </AnimatedPressable>
        <VideoView player={player} style={{ flex: 1 }} contentFit="contain" allowsFullscreen />
      </View>
    </Modal>
  )
}

export default function PlayerVideosScreen() {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const s = useMemo(() => makeStyles(colors), [colors])
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
    if (status !== 'granted') { Alert.alert(t('common.permissionNeeded')); return }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], videoMaxDuration: 60 })
    if (result.canceled) return
    setUploading(true)
    try {
      const uri = result.assets[0].uri
      const fileName = 'swing_player_' + playerId + '_' + Date.now() + '.mp4'
      const response = await fetch(uri)
      const blob = await response.blob()
      const { error } = await supabase.storage.from('swing-videos').upload(fileName, blob, { contentType: 'video/mp4' })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('swing-videos').getPublicUrl(fileName)
      await supabase.from('swing_videos').insert({ player_id: playerId, video_url: publicUrl, title: 'Swing ' + new Date().toLocaleDateString('fr-FR') })
      Alert.alert(t('playerVideos.uploaded'))
      fetchAll()
    } catch(e) { Alert.alert(t('common.error'), e.message) }
    setUploading(false)
  }

  const deleteVideo = async (id) => {
    Alert.alert(t('playerVideos.deleteQuestion'), t('playerVideos.deleteMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => {
        await supabase.from('swing_videos').delete().eq('id', id)
        fetchAll()
      }}
    ])
  }

  if (loading) return <SafeAreaView style={s.safe}><View style={s.header}><View><Text style={s.title}>{t('playerVideos.title')}</Text></View></View><CardListSkeleton /></SafeAreaView>

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>{t('playerVideos.title')}</Text>
          <Text style={s.sub}>{t('playerVideos.recordings')}</Text>
        </View>
        <AnimatedPressable style={s.addBtn} onPress={recordVideo} disabled={uploading}>
          <Ionicons name="videocam" size={16} color="#fff" />
          <Text style={s.addBtnTxt}>{uploading ? '...' : t('playerVideos.film')}</Text>
        </AnimatedPressable>
      </View>

      {playingVideo && <VideoPlayer url={playingVideo} onClose={() => setPlayingVideo(null)} />}

      <ScrollView style={s.scroll}>
        {videos.length === 0 ? (
          <View style={s.emptyWrap}>
            <Ionicons name="videocam-outline" size={48} color={colors.separator} />
            <Text style={s.emptyTitle}>{t('playerVideos.noVideos')}</Text>
            <Text style={s.emptySub}>{t('playerVideos.noVideosSub')}</Text>
            <AnimatedPressable style={s.addBtn} onPress={recordVideo}>
              <Ionicons name="videocam" size={16} color="#fff" />
              <Text style={s.addBtnTxt}>{t('playerVideos.filmSwing')}</Text>
            </AnimatedPressable>
          </View>
        ) : (
          <View style={s.section}>
            {videos.map((v, i) => (
              <AnimatedListItem key={v.id} index={i}>
                <View style={s.videoRow}>
                  <AnimatedPressable style={s.videoThumb} onPress={() => setPlayingVideo(v.video_url)}>
                    <Ionicons name="play" size={24} color={colors.primary} />
                  </AnimatedPressable>
                  <View style={s.videoInfo}>
                    <Text style={s.videoTitle}>{v.title || t('playerVideos.swingVideo')}</Text>
                    <Text style={s.videoDate}>{new Date(v.created_at).toLocaleDateString('fr-FR')}</Text>
                    <AnimatedPressable onPress={() => setPlayingVideo(v.video_url)} style={s.watchBtn}>
                      <Ionicons name="play" size={12} color={colors.primary} />
                      <Text style={s.watchBtnTxt}>{t('playerVideos.watch')}</Text>
                    </AnimatedPressable>
                  </View>
                  <AnimatedPressable onPress={() => deleteVideo(v.id)} style={s.deleteBtn}>
                    <Ionicons name="close" size={18} color={colors.destructive} />
                  </AnimatedPressable>
                </View>
              </AnimatedListItem>
            ))}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bgSecondary },
  header: { backgroundColor: c.card, padding: 16, paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 0.5, borderBottomColor: c.separator },
  title: { fontSize: 22, fontWeight: '800', color: c.text },
  sub: { fontSize: 12, color: c.textTertiary, marginTop: 2 },
  scroll: { flex: 1 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  addBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  section: { backgroundColor: c.card, borderRadius: 16, margin: 16, borderWidth: 0.5, borderColor: c.separator, overflow: 'hidden' },
  emptyWrap: { padding: 40, alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: c.text },
  emptySub: { fontSize: 13, color: c.textTertiary, textAlign: 'center', marginBottom: 12 },
  videoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 0.5, borderBottomColor: c.separatorLight },
  videoThumb: { width: 60, height: 60, borderRadius: 10, backgroundColor: c.primaryLight, alignItems: 'center', justifyContent: 'center' },
  videoInfo: { flex: 1 },
  videoTitle: { fontSize: 14, fontWeight: '600', color: c.text },
  videoDate: { fontSize: 11, color: c.textTertiary, marginTop: 2 },
  watchBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, backgroundColor: c.primaryLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  watchBtnTxt: { fontSize: 12, fontWeight: '600', color: c.primary },
  deleteBtn: { padding: 8 },
})
