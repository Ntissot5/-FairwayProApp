import { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Modal, TextInput, Pressable, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useAudioRecorder, RecordingPresets, AudioModule } from 'expo-audio'
import { supabase } from './supabase'

const G = '#1B5E35'

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
  const [isRecording, setIsRecording] = useState(false)
  const [hasMicPermission, setHasMicPermission] = useState(false)
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [showDrillModal, setShowDrillModal] = useState(false)
  const [showEndModal, setShowEndModal] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [drillName, setDrillName] = useState('')
  const [drillDesc, setDrillDesc] = useState('')

  const timerRef = useRef(null)
  const recordStartTime = useRef(0)

  // Init: fetch player, create session_record, start chrono, request mic
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user.id)

      const { data: p } = await supabase.from('players').select('*').eq('id', player_id).single()
      setPlayer(p)

      // Create session_record
      const { data: rec } = await supabase.from('session_records').insert({
        lesson_id,
        player_id,
        coach_id: user.id,
        status: 'in_progress',
        events: [],
      }).select().single()
      if (rec) setRecordId(rec.id)

      // Request mic permission
      const permResult = await AudioModule.requestRecordingPermissionsAsync()
      setHasMicPermission(permResult.granted)
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

  // Push-to-talk: start
  const handlePressIn = async () => {
    if (!hasMicPermission) {
      Alert.alert(t('session_live.permission_mic_title'), t('session_live.permission_mic_body'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('session_live.open_settings'), onPress: () => Linking.openURL('app-settings:') },
      ])
      return
    }
    try {
      audioRecorder.record()
      recordStartTime.current = elapsedSeconds
      setIsRecording(true)
    } catch (e) {
      console.error('[Audio] Start recording failed:', e)
    }
  }

  // Push-to-talk: stop
  const handlePressOut = async () => {
    if (!isRecording) return
    setIsRecording(false)
    try {
      await audioRecorder.stop()
      const uri = audioRecorder.uri
      if (!uri || !recordId || !userId) return

      const duration = elapsedSeconds - recordStartTime.current
      const eventId = generateId()
      const audioPath = `${userId}/${recordId}/${eventId}.m4a`

      // Upload to Supabase Storage
      const response = await fetch(uri)
      const blob = await response.blob()
      const { error: uploadErr } = await supabase.storage.from('session-audio').upload(audioPath, blob, { contentType: 'audio/m4a' })

      if (uploadErr) {
        console.error('[Storage] Upload failed:', uploadErr)
        return
      }

      const newEvent = { id: eventId, type: 'vocal', timestamp: recordStartTime.current, duration, audio_path: audioPath }
      const updatedEvents = [...events, newEvent]
      setEvents(updatedEvents)
      await supabase.from('session_records').update({ events: updatedEvents }).eq('id', recordId)
    } catch (e) {
      console.error('[Audio] Stop recording failed:', e)
    }
  }

  // Add note
  const handleSaveNote = async () => {
    if (!noteText.trim()) return
    const newEvent = { id: generateId(), type: 'note', timestamp: elapsedSeconds, text: noteText.trim() }
    const updatedEvents = [...events, newEvent]
    setEvents(updatedEvents)
    setNoteText('')
    setShowNoteModal(false)
    if (recordId) await supabase.from('session_records').update({ events: updatedEvents }).eq('id', recordId)
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
    if (recordId) await supabase.from('session_records').update({ events: updatedEvents }).eq('id', recordId)
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
    if (type === 'vocal') return 'mic-outline'
    if (type === 'note') return 'document-text-outline'
    return 'flag-outline'
  }

  const eventPreview = (e) => {
    if (e.type === 'vocal') return `Vocal (${e.duration || 0}s)`
    if (e.type === 'note') return e.text?.slice(0, 40) || ''
    return e.name || ''
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => Alert.alert(t('session_live.confirm_end_title'), t('session_live.confirm_end_body'), [{ text: t('common.cancel') }, { text: t('session_live.end_session'), style: 'destructive', onPress: handleEndSession }])}>
          <Ionicons name="chevron-back" size={24} color={G} />
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
        <Pressable
          style={[s.micBtn, isRecording && s.micBtnActive]}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <Ionicons name={isRecording ? 'mic' : 'mic-outline'} size={28} color={isRecording ? '#fff' : G} />
          <Text style={[s.micBtnTxt, isRecording && { color: '#fff' }]}>{t('session_live.hold_to_speak')}</Text>
        </Pressable>

        <View style={s.secondaryActions}>
          <TouchableOpacity style={s.actionBtn} onPress={() => setShowNoteModal(true)}>
            <Ionicons name="document-text-outline" size={22} color="#374151" />
            <Text style={s.actionBtnTxt}>{t('session_live.note')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={() => setShowDrillModal(true)}>
            <Ionicons name="flag-outline" size={22} color="#374151" />
            <Text style={s.actionBtnTxt}>{t('session_live.drill')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Timeline */}
      <View style={s.timelineSection}>
        <Text style={s.timelineTitle}>{t('session_live.timeline')} ({events.length})</Text>
        <ScrollView style={s.timeline}>
          {[...events].reverse().map((e) => (
            <View key={e.id} style={s.timelineRow}>
              <Ionicons name={eventIcon(e.type)} size={16} color="#6B7280" />
              <Text style={s.timelineTs}>{formatTime(e.timestamp)}</Text>
              <Text style={s.timelinePreview} numberOfLines={1}>{eventPreview(e)}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* End button */}
      <TouchableOpacity style={s.endBtn} onPress={() => setShowEndModal(true)}>
        <Text style={s.endBtnTxt}>{t('session_live.end_session')}</Text>
      </TouchableOpacity>

      {/* Note Modal */}
      <Modal visible={showNoteModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{t('session_live.note')}</Text>
            <TextInput style={s.modalInput} value={noteText} onChangeText={setNoteText} placeholder="..." placeholderTextColor="#9CA3AF" multiline autoFocus />
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
            <TextInput style={s.modalInput} value={drillName} onChangeText={setDrillName} placeholder={t('session_live.drill_name_placeholder')} placeholderTextColor="#9CA3AF" autoFocus />
            <TextInput style={[s.modalInput, { marginTop: 8 }]} value={drillDesc} onChangeText={setDrillDesc} placeholder={t('session_live.drill_desc_placeholder')} placeholderTextColor="#9CA3AF" multiline />
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
              <TouchableOpacity onPress={handleEndSession} style={[s.modalBtnSave, { backgroundColor: '#DC2626' }]}><Text style={s.modalBtnSaveTxt}>{t('session_live.confirm_end_cta')}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f8f8' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  chronoSection: { alignItems: 'center', paddingVertical: 24 },
  chrono: { fontSize: 48, fontWeight: '800', color: '#1a1a1a', letterSpacing: -2, fontVariant: ['tabular-nums'] },
  chronoSub: { fontSize: 13, color: '#22C55E', fontWeight: '600', marginTop: 4 },
  actions: { alignItems: 'center', gap: 16, paddingHorizontal: 16 },
  micBtn: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#E8F5E9', borderRadius: 16, paddingVertical: 18, borderWidth: 2, borderColor: G },
  micBtnActive: { backgroundColor: G },
  micBtnTxt: { fontSize: 16, fontWeight: '700', color: G },
  secondaryActions: { flexDirection: 'row', gap: 12, width: '100%' },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  actionBtnTxt: { fontSize: 14, fontWeight: '600', color: '#374151' },
  timelineSection: { flex: 1, marginTop: 16, marginHorizontal: 16 },
  timelineTitle: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', marginBottom: 8 },
  timeline: { flex: 1 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#F0F4F0' },
  timelineTs: { fontSize: 12, fontWeight: '600', color: '#9CA3AF', width: 42 },
  timelinePreview: { flex: 1, fontSize: 13, color: '#374151' },
  endBtn: { margin: 16, backgroundColor: '#FEF2F2', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' },
  endBtnTxt: { fontSize: 16, fontWeight: '700', color: '#DC2626' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  modalBody: { fontSize: 14, color: '#6B7280', marginBottom: 16 },
  modalInput: { backgroundColor: '#F8FAF8', borderWidth: 1, borderColor: '#E0E5E0', borderRadius: 10, padding: 12, fontSize: 15, color: '#1a1a1a', minHeight: 44 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalBtnCancel: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  modalBtnCancelTxt: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  modalBtnSave: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: G, alignItems: 'center' },
  modalBtnSaveTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
})
