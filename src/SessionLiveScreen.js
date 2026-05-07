import { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Modal, TextInput, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import * as FileSystem from 'expo-file-system/legacy'
import { decode } from 'base64-arraybuffer'
import { supabase } from './supabase'
import { consumePendingVideo } from './videoResult'
import { colors } from './theme'

const generateId = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = Math.random() * 16 | 0
  return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
})

export default function SessionLiveScreen({ route, navigation }) {
  const { t } = useTranslation()
  const { lesson_id, player_id } = route.params

  const [player, setPlayer] = useState(null)
  const [userId, setUserId] = useState(null)
  const [recordId, setRecordId] = useState(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [events, setEvents] = useState([])
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [showDrillModal, setShowDrillModal] = useState(false)
  const [showEndModal, setShowEndModal] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [drillName, setDrillName] = useState('')
  const [drillDesc, setDrillDesc] = useState('')
  const [isUploadingVideo, setIsUploadingVideo] = useState(false)

  const timerRef = useRef(null)
  const recordIdRef = useRef(null)

  // Handle annotated video returned from VideoAnnotationScreen (via shared module)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      const video = consumePendingVideo()
      if (video) handleVideoSave(video)
    })
    return unsubscribe
  }, [navigation])

  const handleVideoSave = async (pendingVideo) => {
    try {
      setIsUploadingVideo(true)
      const { videoUri, annotations, duration_ms } = pendingVideo

      const base64 = await FileSystem.readAsStringAsync(videoUri, { encoding: 'base64' })
      const arrayBuffer = decode(base64)

      const authUser = (await supabase.auth.getUser()).data.user
      const fileName = `${authUser.id}/${recordIdRef.current}/${Date.now()}.mp4`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('session-videos')
        .upload(fileName, arrayBuffer, { contentType: 'video/mp4', upsert: false })

      if (uploadError) {
        console.error('[Video] Upload failed:', uploadError)
        Alert.alert('Erreur', "Échec de l'envoi de la vidéo. Réessaye.")
        return
      }
      const { data: urlData } = await supabase.storage
        .from('session-videos')
        .createSignedUrl(fileName, 60 * 60 * 24 * 7)

      const videoEvent = {
        id: generateId(),
        type: 'video',
        timestamp: elapsedSeconds,
        videoPath: fileName,
        videoUrl: urlData?.signedUrl || null,
        annotations,
        duration_ms,
      }

      const updatedEvents = [...events, videoEvent]
      setEvents(updatedEvents)

      if (recordIdRef.current) {
        const { error } = await supabase.from('session_records').update({ events: updatedEvents }).eq('id', recordIdRef.current)
        if (error) console.error('[Video] DB update failed:', error)
      }
    } catch (e) {
      console.error('[Video] Save failed:', e)
      Alert.alert('Erreur', "Échec de l'enregistrement. Réessaye.")
    } finally {
      setIsUploadingVideo(false)
    }
  }

  // Init: fetch player, create session_record, start chrono
  useEffect(() => {
    if (recordIdRef.current) return
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user.id)

      const { data: p } = await supabase.from('players').select('*').eq('id', player_id).single()
      setPlayer(p)

      // Create session_record
      const { data: rec, error: recErr } = await supabase.from('session_records').insert({
        lesson_id,
        player_id,
        coach_id: user.id,
        status: 'in_progress',
        events: [],
      }).select().single()
      if (recErr) console.error('[SessionLive] Failed to create session_record:', recErr)
      if (rec) {
        recordIdRef.current = rec.id
        setRecordId(rec.id)
      }
    }
    init()

    // Start chrono
    timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const formatTime = (sec) => {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // Add note
  const handleSaveNote = async () => {
    if (!noteText.trim()) return
    const newEvent = { id: generateId(), type: 'note', timestamp: elapsedSeconds, text: noteText.trim() }
    const updatedEvents = [...events, newEvent]
    setEvents(updatedEvents)
    setNoteText('')
    setShowNoteModal(false)
    if (recordId) {
      const { error } = await supabase.from('session_records').update({ events: updatedEvents }).eq('id', recordId)
      if (error) console.error('[SessionLive] Update events failed:', error)
    }
  }

  // Add drill
  const handleSaveDrill = async () => {
    if (!drillName.trim()) return
    const newEvent = { id: generateId(), type: 'drill', timestamp: elapsedSeconds, name: drillName.trim(), description: drillDesc.trim() || null }
    const updatedEvents = [...events, newEvent]
    setEvents(updatedEvents)
    setDrillName('')
    setDrillDesc('')
    setShowDrillModal(false)
    if (recordId) {
      const { error } = await supabase.from('session_records').update({ events: updatedEvents }).eq('id', recordId)
      if (error) console.error('[SessionLive] Update events (drill) failed:', error)
    }
  }

  // End session
  const handleEndSession = async () => {
    setShowEndModal(false)
    if (timerRef.current) clearInterval(timerRef.current)

    if (recordId) {
      await supabase.from('session_records').update({
        status: 'processing',
        ended_at: new Date().toISOString(),
        duration_seconds: elapsedSeconds,
      }).eq('id', recordId)

      // Invoke transcribe-summarize
      await supabase.functions.invoke('transcribe-summarize', { body: { session_record_id: recordId } })
    }

    navigation.navigate('SessionSummary', { session_record_id: recordId })
  }

  const eventIcon = (type) => {
    if (type === 'video') return 'videocam-outline'
    if (type === 'note') return 'document-text-outline'
    return 'flag-outline'
  }

  const eventPreview = (e) => {
    if (e.type === 'video') return `${t('session_live.video_annotated')} · ${Math.round((e.duration_ms || 0) / 1000)}s · ${e.annotations?.length || 0} anno.`
    if (e.type === 'note') return e.text?.slice(0, 40) || ''
    return e.name || ''
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => Alert.alert(t('session_live.confirm_end_title'), t('session_live.confirm_end_body', { minutes: Math.round(elapsedSeconds / 60) }), [{ text: t('common.cancel') }, { text: t('session_live.end_session'), style: 'destructive', onPress: handleEndSession }])}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{player?.full_name || '...'} · HCP {player?.current_handicap ?? '—'}</Text>
      </View>

      {/* Chrono */}
      <View style={s.chronoSection}>
        <Text style={s.chrono}>{formatTime(elapsedSeconds)}</Text>
        <Text style={s.chronoSub}>{t('session_live.in_progress')}</Text>
      </View>

      {/* Action buttons */}
      <View style={s.actions}>
        <TouchableOpacity style={s.actionBtn} onPress={() => navigation.navigate('VideoRecord')} disabled={isUploadingVideo}>
          <Ionicons name="videocam-outline" size={22} color={isUploadingVideo ? '#C4C4C4' : colors.textSecondary} />
          <Text style={[s.actionBtnTxt, isUploadingVideo && { color: '#C4C4C4' }]}>{t('session_live.video')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={() => setShowNoteModal(true)} disabled={isUploadingVideo}>
          <Ionicons name="document-text-outline" size={22} color={isUploadingVideo ? '#C4C4C4' : colors.textSecondary} />
          <Text style={[s.actionBtnTxt, isUploadingVideo && { color: '#C4C4C4' }]}>{t('session_live.note')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={() => setShowDrillModal(true)} disabled={isUploadingVideo}>
          <Ionicons name="flag-outline" size={22} color={isUploadingVideo ? '#C4C4C4' : colors.textSecondary} />
          <Text style={[s.actionBtnTxt, isUploadingVideo && { color: '#C4C4C4' }]}>{t('session_live.drill')}</Text>
        </TouchableOpacity>
      </View>

      {/* Timeline */}
      <View style={s.timelineSection}>
        <Text style={s.timelineTitle}>{t('session_live.timeline')} ({events.length})</Text>
        <ScrollView style={s.timeline}>
          {[...events].reverse().map((e) => (
            <View key={e.id} style={s.timelineRow}>
              <Ionicons name={eventIcon(e.type)} size={16} color={colors.textSecondary} />
              <Text style={s.timelineTs}>{formatTime(e.timestamp)}</Text>
              <Text style={s.timelinePreview} numberOfLines={1}>{eventPreview(e)}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* End button */}
      <TouchableOpacity style={[s.endBtn, isUploadingVideo && { opacity: 0.5 }]} onPress={() => setShowEndModal(true)} disabled={isUploadingVideo}>
        <Text style={s.endBtnTxt}>{t('session_live.end_session')}</Text>
      </TouchableOpacity>

      {/* Upload overlay */}
      {isUploadingVideo && (
        <View style={s.uploadOverlay}>
          <ActivityIndicator size="large" color={colors.textInverse} />
          <Text style={s.uploadOverlayTxt}>{t('session_live.uploading_video')}</Text>
        </View>
      )}

      {/* Note Modal */}
      <Modal visible={showNoteModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{t('session_live.note')}</Text>
            <TextInput style={s.modalInput} value={noteText} onChangeText={setNoteText} placeholder="..." placeholderTextColor={colors.textTertiary} multiline autoFocus />
            <View style={s.modalBtns}>
              <TouchableOpacity onPress={() => { setNoteText(''); setShowNoteModal(false) }} style={s.modalBtnCancel}><Text style={s.modalBtnCancelTxt}>{t('common.cancel')}</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleSaveNote} style={s.modalBtnSave}><Text style={s.modalBtnSaveTxt}>{t('common.save')}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Drill Modal */}
      <Modal visible={showDrillModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{t('session_live.drill')}</Text>
            <TextInput style={s.modalInput} value={drillName} onChangeText={setDrillName} placeholder={t('session_live.drill_name_placeholder')} placeholderTextColor={colors.textTertiary} autoFocus />
            <TextInput style={[s.modalInput, { marginTop: 8 }]} value={drillDesc} onChangeText={setDrillDesc} placeholder={t('session_live.drill_desc_placeholder')} placeholderTextColor={colors.textTertiary} multiline />
            <View style={s.modalBtns}>
              <TouchableOpacity onPress={() => { setDrillName(''); setDrillDesc(''); setShowDrillModal(false) }} style={s.modalBtnCancel}><Text style={s.modalBtnCancelTxt}>{t('common.cancel')}</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleSaveDrill} style={s.modalBtnSave}><Text style={s.modalBtnSaveTxt}>{t('common.save')}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* End Confirm Modal */}
      <Modal visible={showEndModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{t('session_live.confirm_end_title')}</Text>
            <Text style={s.modalBody}>{t('session_live.confirm_end_body', { minutes: Math.round(elapsedSeconds / 60) })}</Text>
            <View style={s.modalBtns}>
              <TouchableOpacity onPress={() => setShowEndModal(false)} style={s.modalBtnCancel}><Text style={s.modalBtnCancelTxt}>{t('common.cancel')}</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleEndSession} style={[s.modalBtnSave, { backgroundColor: colors.error }]}><Text style={s.modalBtnSaveTxt}>{t('session_live.confirm_end_cta')}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceElevated },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.borderStrong },
  headerTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  chronoSection: { alignItems: 'center', paddingVertical: 32 },
  chrono: { fontSize: 48, fontWeight: '800', color: colors.textPrimary, letterSpacing: -2, fontVariant: ['tabular-nums'] },
  chronoSub: { fontSize: 13, color: '#22C55E', fontWeight: '600', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 16 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 16, borderWidth: 1, borderColor: colors.borderStrong },
  actionBtnTxt: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  timelineSection: { flex: 1, marginTop: 20, marginHorizontal: 16 },
  timelineTitle: { fontSize: 12, fontWeight: '700', color: colors.textTertiary, marginBottom: 8 },
  timeline: { flex: 1 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  timelineTs: { fontSize: 12, fontWeight: '600', color: colors.textTertiary, width: 42 },
  timelinePreview: { flex: 1, fontSize: 13, color: colors.textSecondary },
  endBtn: { margin: 16, backgroundColor: colors.errorLight, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: colors.error },
  endBtnTxt: { fontSize: 16, fontWeight: '700', color: colors.error },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  modalCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, width: '100%' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
  modalBody: { fontSize: 14, color: colors.textSecondary, marginBottom: 16 },
  modalInput: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 10, padding: 12, fontSize: 15, color: colors.textPrimary, minHeight: 44 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalBtnCancel: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center' },
  modalBtnCancelTxt: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  modalBtnSave: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center' },
  modalBtnSaveTxt: { fontSize: 15, fontWeight: '700', color: colors.textInverse },
  uploadOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', zIndex: 100, gap: 12 },
  uploadOverlayTxt: { fontSize: 16, fontWeight: '600', color: colors.textInverse },
})
