import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, RefreshControl, Alert, Modal, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { VideoView, useVideoPlayer } from 'expo-video'
import { supabase } from './supabase'
import { sendPushNotification } from './notifications'
import { useTheme } from './ThemeContext'
import { useTranslation } from 'react-i18next'
import AnimatedPressable from './components/AnimatedPressable'
import Skeleton from './components/Skeleton'

function VideoPlayer({ url, onClose }) {
  const isImage = url && (url.endsWith('.png') || url.endsWith('.jpg') || url.endsWith('.jpeg') || url.includes('annotation_'))
  const player = useVideoPlayer(isImage ? null : url, p => { if (p) p.play() })

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <TouchableOpacity onPress={onClose} style={{ position: 'absolute', top: 56, right: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="close" size={18} color="#fff" />
        </TouchableOpacity>
        {isImage ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 14, marginBottom: 12 }}>Swing Analysis</Text>
            <View style={{ width: '90%', aspectRatio: 16/9, backgroundColor: '#222', borderRadius: 12, overflow: 'hidden' }}>
              <Text style={{ color: '#8E8E93', fontSize: 12, padding: 20, textAlign: 'center' }}>Image annotation</Text>
            </View>
          </View>
        ) : player ? (
          <VideoView player={player} style={{ flex: 1 }} contentFit="contain" allowsFullscreen />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#8E8E93', fontSize: 14 }}>Unable to load video</Text>
          </View>
        )}
      </View>
    </Modal>
  )
}

export default function SpaceScreen({ route, navigation }) {
  const { player } = route.params
  const { colors, isDark } = useTheme()
  const { t } = useTranslation()
  const s = useMemo(() => makeStyles(colors), [colors])

  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [input, setInput] = useState('')
  const [coachId, setCoachId] = useState(null)
  const [playingVideo, setPlayingVideo] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [showSession, setShowSession] = useState(false)
  const [sessionPrice, setSessionPrice] = useState('')
  const [sessionNotes, setSessionNotes] = useState('')
  const [sessionTags, setSessionTags] = useState([])
  const [savingSession, setSavingSession] = useState(false)
  const scrollRef = useRef(null)
  const TAGS = [t('space.tags.driver'), t('space.tags.irons'), t('space.tags.shortGame'), t('space.tags.putting'), t('space.tags.mental'), t('space.tags.courseMgmt')]

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCoachId(user.id)

    const [msgRes, vidRes, exRes, sesRes] = await Promise.all([
      supabase.from('messages').select('*').eq('player_id', player.id).order('created_at', { ascending: true }),
      supabase.from('swing_videos').select('*').eq('player_id', player.id).order('created_at', { ascending: true }),
      supabase.from('exercises').select('*').eq('player_id', player.id).order('created_at', { ascending: true }),
      supabase.from('sessions').select('*').eq('player_id', player.id).order('session_date', { ascending: true }),
    ])

    const items = []

    ;(msgRes.data || []).forEach(m => {
      items.push({ type: 'message', id: 'm_' + m.id, date: m.created_at, sender: m.sender, content: m.content })
    })

    ;(vidRes.data || []).forEach(v => {
      items.push({ type: 'video', id: 'v_' + v.id, date: v.created_at, title: v.title, url: v.video_url, rawId: v.id })
    })

    ;(exRes.data || []).forEach(e => {
      items.push({ type: 'exercise', id: 'e_' + e.id, date: e.created_at, title: e.title, description: e.description, completed: e.completed, rawId: e.id })
    })

    ;(sesRes.data || []).forEach(ss => {
      items.push({ type: 'session', id: 's_' + ss.id, date: ss.session_date || ss.created_at, notes: ss.notes, price: ss.price })
    })

    items.sort((a, b) => new Date(a.date) - new Date(b.date))
    setFeed(items)
    setLoading(false)
    setRefreshing(false)
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 200)
  }

  const sendMessage = async () => {
    if (!input.trim()) return
    const msg = input.trim()
    setInput('')
    await supabase.from('messages').insert({ coach_id: coachId, player_id: player.id, sender: 'coach', content: msg })
    const { data: tokenRow } = await supabase.from('push_tokens').select('token').eq('user_id', player.player_user_id).single()
    if (tokenRow?.token) {
      await sendPushNotification(tokenRow.token, 'Nouveau message de ton coach', msg.slice(0, 80), { type: 'message' })
    }
    fetchAll()
  }

  const uploadVideo = async () => {
    setShowActions(false)
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') { Alert.alert(t('common.permissionNeeded')); return }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], videoMaxDuration: 60 })
    if (result.canceled) return
    setUploading(true)
    try {
      const uri = result.assets[0].uri
      const fileName = 'swing_' + player.id + '_' + Date.now() + '.mp4'
      const response = await fetch(uri)
      const blob = await response.blob()
      const { error } = await supabase.storage.from('swing-videos').upload(fileName, blob, { contentType: 'video/mp4' })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('swing-videos').getPublicUrl(fileName)
      await supabase.from('swing_videos').insert({ player_id: player.id, coach_id: coachId, video_url: publicUrl, title: 'Swing ' + new Date().toLocaleDateString('fr-FR') })
      fetchAll()
    } catch (e) { Alert.alert(t('common.error'), e.message) }
    setUploading(false)
  }

  const uploadFromGallery = async () => {
    setShowActions(false)
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'] })
    if (result.canceled) return
    setUploading(true)
    try {
      const uri = result.assets[0].uri
      const fileName = 'swing_' + player.id + '_' + Date.now() + '.mp4'
      const response = await fetch(uri)
      const blob = await response.blob()
      const { error } = await supabase.storage.from('swing-videos').upload(fileName, blob, { contentType: 'video/mp4' })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('swing-videos').getPublicUrl(fileName)
      await supabase.from('swing_videos').insert({ player_id: player.id, coach_id: coachId, video_url: publicUrl, title: 'Swing ' + new Date().toLocaleDateString('fr-FR') })
      fetchAll()
    } catch (e) { Alert.alert(t('common.error'), e.message) }
    setUploading(false)
  }

  const toggleExercise = async (item) => {
    await supabase.from('exercises').update({ completed: !item.completed }).eq('id', item.rawId)
    fetchAll()
  }

  const generateAIPlan = async () => {
    setShowActions(false)
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
      Alert.alert(t('sessions.planGenerated'), t('create.exercisesGenerated'))
      fetchAll()
    } catch (e) { Alert.alert(t('common.error'), e.message) }
  }

  const toggleTag = (tag) => {
    setSessionTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  const addSession = async (generatePlan = false) => {
    if (!sessionPrice) { Alert.alert(t('space.priceLabel')); return }
    setSavingSession(true)
    const notes = (sessionTags.length > 0 ? '[' + sessionTags.join(', ') + '] ' : '') + sessionNotes
    await supabase.from('sessions').insert({
      coach_id: coachId,
      player_id: player.id,
      price: parseFloat(sessionPrice),
      session_date: new Date().toISOString().split('T')[0],
      notes,
      paid: true,
    })

    if (generatePlan && sessionTags.length > 0) {
      try {
        const response = await fetch('https://aqdifzgqfemfdcigxsgw.supabase.co/functions/v1/claude-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 500, messages: [{ role: 'user', content: 'Generate 3 golf training exercises focused on: ' + sessionTags.join(', ') + '. Return ONLY a JSON array: [{"title":"...","description":"..."}] Player: ' + player.full_name + ', HCP: ' + player.current_handicap + '. Notes: ' + sessionNotes }] })
        })
        const data = await response.json()
        const text = data.content?.[0]?.text || '[]'
        const clean = text.replace(/```json|```/g, '').trim()
        const exercises = JSON.parse(clean)
        for (const ex of exercises) {
          await supabase.from('exercises').insert({ player_id: player.id, coach_id: coachId, title: ex.title, description: ex.description, completed: false })
        }
      } catch (e) { console.log('AI plan error:', e) }
    }

    setSessionPrice('')
    setSessionNotes('')
    setSessionTags([])
    setShowSession(false)
    setSavingSession(false)
    fetchAll()
  }

  const formatDate = (dateStr) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now - d
    if (diff < 60000) return 'Now'
    if (diff < 3600000) return Math.floor(diff / 60000) + 'min'
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h'
    if (diff < 604800000) return d.toLocaleDateString('fr-FR', { weekday: 'short' })
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  const formatFullDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  // Group feed items by day
  const groupedFeed = []
  let lastDay = ''
  feed.forEach(item => {
    const day = new Date(item.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    if (day !== lastDay) {
      groupedFeed.push({ type: 'date_separator', id: 'date_' + day, label: day })
      lastDay = day
    }
    groupedFeed.push(item)
  })

  const renderFeedItem = (item) => {
    switch (item.type) {
      case 'date_separator':
        return (
          <View key={item.id} style={s.dateSep}>
            <View style={s.dateLine} />
            <Text style={s.dateLabel}>{item.label}</Text>
            <View style={s.dateLine} />
          </View>
        )

      case 'message':
        const isCoach = item.sender === 'coach'
        return (
          <View key={item.id} style={[s.msgWrap, isCoach ? s.msgRight : s.msgLeft]}>
            {!isCoach && (
              <View style={s.msgAvatar}>
                <Text style={s.msgAvatarTxt}>{player.full_name?.charAt(0)}</Text>
              </View>
            )}
            <View style={{ maxWidth: '75%' }}>
              <View style={[s.bubble, isCoach ? s.bubbleCoach : s.bubblePlayer]}>
                <Text style={[s.bubbleTxt, isCoach && { color: '#fff' }]}>{item.content}</Text>
              </View>
              <Text style={[s.time, isCoach && { textAlign: 'right' }]}>{formatDate(item.date)}</Text>
            </View>
          </View>
        )

      case 'video':
        return (
          <View key={item.id} style={s.postCard}>
            <View style={s.postHeader}>
              <View style={s.postIcon}><Ionicons name="videocam-outline" size={16} color={colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.postLabel}>{t('space.swingVideo')}</Text>
                <Text style={s.postTime}>{formatDate(item.date)}</Text>
              </View>
              <TouchableOpacity
                style={s.annotateBtn}
                onPress={() => navigation.navigate('VideoAnnotate', { videoUrl: item.url, player, coachId })}
              >
                <Ionicons name="analytics-outline" size={14} color={colors.primary} />
                <Text style={s.annotateBtnTxt}> {t('space.annotate')}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.videoThumb} onPress={() => setPlayingVideo(item.url)}>
              <View style={s.playBtn}>
                <Ionicons name="play" size={24} color="#fff" style={{ marginLeft: 2 }} />
              </View>
              <Text style={s.videoTitle}>{item.title || t('playerDetail.swingVideo')}</Text>
            </TouchableOpacity>
          </View>
        )

      case 'exercise':
        return (
          <View key={item.id} style={s.postCard}>
            <View style={s.postHeader}>
              <View style={[s.postIcon, { backgroundColor: colors.warningBg || '#FFF7ED' }]}><Ionicons name="clipboard-outline" size={16} color={colors.warning || '#D97706'} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.postLabel}>{t('space.exercise')}</Text>
                <Text style={s.postTime}>{formatDate(item.date)}</Text>
              </View>
            </View>
            <TouchableOpacity style={s.exerciseRow} onPress={() => toggleExercise(item)}>
              <View style={[s.exDot, item.completed && s.exDotDone]}>
                {item.completed && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.exTitle, item.completed && s.exTitleDone]}>{item.title}</Text>
                {item.description ? <Text style={s.exDesc}>{item.description}</Text> : null}
              </View>
            </TouchableOpacity>
          </View>
        )

      case 'session':
        return (
          <View key={item.id} style={s.postCard}>
            <View style={s.postHeader}>
              <View style={[s.postIcon, { backgroundColor: colors.successBg || '#F0FDF4' }]}><Ionicons name="flag" size={16} color={colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.postLabel}>{t('space.session')}</Text>
                <Text style={s.postTime}>{formatDate(item.date)}</Text>
              </View>
              <Text style={s.sessionPriceTxt}>{item.price}\u20AC</Text>
            </View>
            {item.notes ? <Text style={s.sessionNotesTxt}>{item.notes}</Text> : null}
          </View>
        )

      default:
        return null
    }
  }

  if (loading) return (
    <View style={s.loadingWrap}>
      <View style={{ padding: 20, gap: 16 }}>
        <Skeleton width="60%" height={20} borderRadius={6} />
        <Skeleton width="100%" height={60} borderRadius={14} />
        <Skeleton width="100%" height={60} borderRadius={14} />
        <Skeleton width="80%" height={60} borderRadius={14} />
      </View>
    </View>
  )

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={s.headerAvatar}>
          <Text style={s.headerAvatarTxt}>{player.full_name?.charAt(0)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.headerName}>{player.full_name}</Text>
          <Text style={s.headerSub}>HCP {player.current_handicap}</Text>
        </View>
        <AnimatedPressable onPress={() => navigation.navigate('PlayerDetail', { player })} style={s.detailBtn}>
          <Text style={s.detailBtnTxt}>{t('space.profile')}</Text>
        </AnimatedPressable>
      </View>

      {playingVideo && <VideoPlayer url={playingVideo} onClose={() => setPlayingVideo(null)} />}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        {/* Feed */}
        <ScrollView
          ref={scrollRef}
          style={s.feed}
          contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll() }} tintColor={colors.primary} />}
        >
          {groupedFeed.length === 0 && (
            <View style={s.emptyState}>
              <Ionicons name="chatbubble-outline" size={40} color={colors.textTertiary} />
              <Text style={s.emptyTitle}>{t('space.startConversation')}</Text>
              <Text style={s.emptySub}>{t('space.startSub', { name: player.full_name })}</Text>
            </View>
          )}
          {groupedFeed.map(item => renderFeedItem(item))}
          {uploading && (
            <View style={s.postCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
                <ActivityIndicator color={colors.primary} />
                <Text style={{ fontSize: 13, color: colors.textTertiary }}>{t('space.uploading')}</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input bar */}
        <View style={s.inputBar}>
          <TouchableOpacity style={s.plusBtn} onPress={() => setShowActions(true)}>
            <Text style={s.plusTxt}>+</Text>
          </TouchableOpacity>
          <TextInput
            style={s.inputMsg}
            value={input}
            onChangeText={setInput}
            placeholder={t('space.messagePlaceholder', { name: player.full_name })}
            placeholderTextColor={colors.textTertiary}
            multiline
          />
          <AnimatedPressable
            style={[s.sendBtn, !input.trim() && { backgroundColor: colors.separator }]}
            onPress={sendMessage}
            disabled={!input.trim()}
          >
            <Ionicons name="arrow-up" size={16} color={!input.trim() ? colors.textTertiary : '#fff'} />
          </AnimatedPressable>
        </View>
      </KeyboardAvoidingView>

      {/* Actions modal */}
      <Modal visible={showActions} animationType="slide" transparent>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowActions(false)}>
          <View style={s.actionSheet}>
            <View style={s.actionHandle} />
            <Text style={s.actionTitle}>{t('space.postTo', { name: player.full_name })}</Text>
            <TouchableOpacity style={s.actionRow} onPress={uploadVideo}>
              <View style={[s.actionIcon, { backgroundColor: colors.destructiveBg }]}><Ionicons name="videocam-outline" size={22} color={colors.destructive} /></View>
              <View>
                <Text style={s.actionLabel}>{t('space.filmSwing')}</Text>
                <Text style={s.actionSub}>{t('space.filmSwingSub')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={s.actionRow} onPress={uploadFromGallery}>
              <View style={[s.actionIcon, { backgroundColor: colors.infoBg || '#EFF6FF' }]}><Ionicons name="folder-outline" size={22} color={colors.info || '#0891B2'} /></View>
              <View>
                <Text style={s.actionLabel}>{t('space.uploadVideo')}</Text>
                <Text style={s.actionSub}>{t('space.uploadVideoSub')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={s.actionRow} onPress={generateAIPlan}>
              <View style={[s.actionIcon, { backgroundColor: colors.successBg || '#F0FDF4' }]}><Text style={{ fontSize: 20 }}>{'\u2726'}</Text></View>
              <View>
                <Text style={s.actionLabel}>{t('space.aiPlan')}</Text>
                <Text style={s.actionSub}>{t('space.aiPlanSub')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={s.actionRow} onPress={() => { setShowActions(false); setShowSession(true) }}>
              <View style={[s.actionIcon, { backgroundColor: colors.successBg || '#F0FDF4' }]}><Ionicons name="flag" size={22} color={colors.primary} /></View>
              <View>
                <Text style={s.actionLabel}>{t('space.logSession')}</Text>
                <Text style={s.actionSub}>{t('space.logSessionSub')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={s.actionRow} onPress={() => { setShowActions(false); navigation.navigate('PlayerDetail', { player }) }}>
              <View style={[s.actionIcon, { backgroundColor: colors.warningBg || '#FFF7ED' }]}><Ionicons name="bar-chart-outline" size={22} color={colors.warning || '#D97706'} /></View>
              <View>
                <Text style={s.actionLabel}>{t('space.viewProfile')}</Text>
                <Text style={s.actionSub}>{t('space.viewProfileSub')}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      {/* Session modal with tags */}
      <Modal visible={showSession} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.card }}>
          <View style={s.sessionHeader}>
            <Text style={s.sessionTitle}>{t('space.logSession')}</Text>
            <TouchableOpacity onPress={() => setShowSession(false)}>
              <Text style={s.sessionCancel}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }}>
            <Text style={s.sessionLabel}>{t('space.whatWorkedOn')}</Text>
            <View style={s.tagsRow}>
              {TAGS.map(tag => (
                <TouchableOpacity
                  key={tag}
                  style={[s.tag, sessionTags.includes(tag) && s.tagActive]}
                  onPress={() => toggleTag(tag)}
                >
                  <Text style={[s.tagTxt, sessionTags.includes(tag) && s.tagTxtActive]}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.sessionLabel}>{t('space.priceLabel')}</Text>
            <TextInput
              style={s.sessionInput}
              value={sessionPrice}
              onChangeText={setSessionPrice}
              placeholder="120"
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={s.sessionLabel}>{t('space.notesOptional')}</Text>
            <TextInput
              style={[s.sessionInput, { height: 80, textAlignVertical: 'top' }]}
              value={sessionNotes}
              onChangeText={setSessionNotes}
              placeholder={t('space.notesPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              multiline
            />

            <AnimatedPressable
              style={[s.sessionBtn, savingSession && { opacity: 0.6 }]}
              onPress={() => addSession(true)}
              disabled={savingSession}
            >
              <Text style={s.sessionBtnTxt}>{savingSession ? t('space.saving') : '\u2726 ' + t('space.saveWithAI')}</Text>
            </AnimatedPressable>

            <AnimatedPressable
              style={s.sessionBtnSecondary}
              onPress={() => addSession(false)}
              disabled={savingSession}
            >
              <Text style={s.sessionBtnSecondaryTxt}>{t('space.saveWithout')}</Text>
            </AnimatedPressable>

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  loadingWrap: { flex: 1, backgroundColor: c.bg },
  header: { backgroundColor: c.card, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, ...c.shadow, zIndex: 1 },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  headerAvatarTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerName: { fontSize: 16, fontWeight: '700', color: c.text },
  headerSub: { fontSize: 12, color: c.textTertiary, marginTop: 1 },
  detailBtn: { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.separator, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  detailBtnTxt: { fontSize: 12, fontWeight: '600', color: c.textSecondary },
  feed: { flex: 1, backgroundColor: c.bgSecondary },
  dateSep: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 },
  dateLine: { flex: 1, height: 0.5, backgroundColor: c.separator },
  dateLabel: { fontSize: 11, color: c.textTertiary, fontWeight: '600' },
  msgWrap: { flexDirection: 'row', marginBottom: 8, gap: 8 },
  msgRight: { justifyContent: 'flex-end' },
  msgLeft: { justifyContent: 'flex-start' },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.separator, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  msgAvatarTxt: { fontSize: 12, fontWeight: '600', color: c.textTertiary },
  bubble: { padding: 12, borderRadius: 18 },
  bubbleCoach: { backgroundColor: c.primary, borderBottomRightRadius: 4 },
  bubblePlayer: { backgroundColor: c.card, borderBottomLeftRadius: 4, borderWidth: 0.5, borderColor: c.separator },
  bubbleTxt: { fontSize: 14, color: c.text, lineHeight: 20 },
  time: { fontSize: 10, color: c.textTertiary, marginTop: 3, paddingHorizontal: 4 },
  postCard: { backgroundColor: c.card, borderRadius: 16, marginBottom: 10, overflow: 'hidden', ...c.shadow },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  postIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: c.primaryLight, alignItems: 'center', justifyContent: 'center' },
  postLabel: { fontSize: 13, fontWeight: '600', color: c.text },
  postTime: { fontSize: 11, color: c.textTertiary, marginTop: 1 },
  annotateBtn: { backgroundColor: c.bgSecondary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center' },
  annotateBtnTxt: { fontSize: 12, fontWeight: '600', color: c.primary },
  videoThumb: { height: 160, backgroundColor: '#111', borderBottomLeftRadius: 16, borderBottomRightRadius: 16, alignItems: 'center', justifyContent: 'center' },
  playBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(27,94,53,0.9)', alignItems: 'center', justifyContent: 'center' },
  videoTitle: { position: 'absolute', bottom: 12, left: 12, color: '#fff', fontSize: 12, fontWeight: '600' },
  exerciseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12, paddingTop: 0 },
  exDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: c.separator, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  exDotDone: { backgroundColor: c.primary, borderColor: c.primary },
  exTitle: { fontSize: 13, fontWeight: '600', color: c.text },
  exTitleDone: { color: c.textTertiary, textDecorationLine: 'line-through' },
  exDesc: { fontSize: 11, color: c.textTertiary, marginTop: 2, lineHeight: 16 },
  sessionPriceTxt: { fontSize: 15, fontWeight: '700', color: c.primary },
  sessionNotesTxt: { fontSize: 13, color: c.textTertiary, paddingHorizontal: 12, paddingBottom: 12, lineHeight: 18 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 8, marginTop: 12 },
  emptySub: { fontSize: 14, color: c.textTertiary, textAlign: 'center', maxWidth: 260, lineHeight: 20 },
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, paddingBottom: 6, backgroundColor: c.card, borderTopWidth: 0.5, borderTopColor: c.separator },
  plusBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.bgSecondary, alignItems: 'center', justifyContent: 'center' },
  plusTxt: { fontSize: 22, color: c.primary, fontWeight: '400', marginTop: -1 },
  inputMsg: { flex: 1, backgroundColor: c.bgSecondary, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: c.text, maxHeight: 100 },
  sendBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' },
  actionSheet: { backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40, paddingTop: 8 },
  actionHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: c.separator, alignSelf: 'center', marginBottom: 16 },
  actionTitle: { fontSize: 16, fontWeight: '700', color: c.text, paddingHorizontal: 20, marginBottom: 16 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14 },
  actionIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 15, fontWeight: '600', color: c.text },
  actionSub: { fontSize: 12, color: c.textTertiary, marginTop: 1 },
  sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 0.5, borderBottomColor: c.separator },
  sessionTitle: { fontSize: 18, fontWeight: '700', color: c.text },
  sessionCancel: { fontSize: 16, color: c.primary, fontWeight: '600' },
  sessionLabel: { fontSize: 13, fontWeight: '600', color: c.textTertiary, marginBottom: 8, marginTop: 18 },
  sessionInput: { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 12, padding: 14, fontSize: 15, color: c.text },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: c.bgSecondary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: c.bgSecondary },
  tagActive: { backgroundColor: c.primaryLight, borderColor: c.primary },
  tagTxt: { fontSize: 13, color: c.textTertiary, fontWeight: '500' },
  tagTxtActive: { color: c.primary, fontWeight: '600' },
  sessionBtn: { backgroundColor: c.primary, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 24 },
  sessionBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  sessionBtnSecondary: { borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: c.separator },
  sessionBtnSecondaryTxt: { color: c.textTertiary, fontSize: 14, fontWeight: '600' },
})
