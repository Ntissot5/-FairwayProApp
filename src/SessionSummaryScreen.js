import { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { supabase } from './supabase'
import { colors } from './theme'

export default function SessionSummaryScreen({ route, navigation }) {
  const { t } = useTranslation()
  const { session_record_id } = route.params || {}

  const [record, setRecord] = useState(null)
  const [player, setPlayer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [timedOut, setTimedOut] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [showSendModal, setShowSendModal] = useState(false)
  const [editSummary, setEditSummary] = useState(null)

  const pollRef = useRef(null)
  const pollStart = useRef(Date.now())

  useEffect(() => {
    fetchRecord()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const fetchRecord = async () => {
    if (!session_record_id) return

    const { data } = await supabase
      .from('session_records')
      .select('*')
      .eq('id', session_record_id)
      .single()

    if (!data) return

    // Fetch player
    if (!player) {
      const { data: p } = await supabase.from('players').select('*').eq('id', data.player_id).single()
      if (p) setPlayer(p)
    }

    if (data.status === 'processing') {
      setRecord(data)
      setLoading(true)
      // Start polling if not already
      if (!pollRef.current) {
        pollStart.current = Date.now()
        pollRef.current = setInterval(async () => {
          const elapsed = Date.now() - pollStart.current
          if (elapsed > 60000) {
            clearInterval(pollRef.current)
            pollRef.current = null
            setTimedOut(true)
            setLoading(false)
            return
          }
          const { data: updated } = await supabase
            .from('session_records')
            .select('*')
            .eq('id', session_record_id)
            .single()
          if (updated && updated.status !== 'processing') {
            clearInterval(pollRef.current)
            pollRef.current = null
            setRecord(updated)
            setEditSummary(JSON.parse(JSON.stringify(updated.ai_summary || {})))
            setLoading(false)
          }
        }, 3000)
      }
    } else {
      setRecord(data)
      setEditSummary(JSON.parse(JSON.stringify(data.ai_summary || {})))
      setLoading(false)
    }
  }

  const handleRetry = async () => {
    setTimedOut(false)
    setLoading(true)
    await supabase.functions.invoke('transcribe-summarize', { body: { session_record_id } })
    fetchRecord()
  }

  const handleSaveEdit = async () => {
    await supabase.from('session_records').update({ ai_summary: editSummary, status: 'edited' }).eq('id', session_record_id)
    setIsEditing(false)
    fetchRecord()
  }

  const handleCancelEdit = () => {
    setEditSummary(JSON.parse(JSON.stringify(record?.ai_summary || {})))
    setIsEditing(false)
  }

  const handleSend = async () => {
    setShowSendModal(false)
    setIsSending(true)

    // Update DB
    await supabase.from('session_records').update({ sent_at: new Date().toISOString(), status: 'sent' }).eq('id', session_record_id)

    // Send push to player
    if (player?.player_user_id) {
      const { data: tokenRow } = await supabase
        .from('push_tokens')
        .select('token')
        .eq('user_id', player.player_user_id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      if (tokenRow?.token) {
        const summary = record?.ai_summary || editSummary || {}
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: tokenRow.token,
            title: t('session_summary.push_title'),
            body: (summary.worked_on || '').slice(0, 100),
            data: { type: 'session_summary', session_record_id },
            sound: 'default',
            priority: 'high',
          }),
        })
      }
    }

    setIsSending(false)
    Alert.alert(t('session_summary.sent_toast'), '', [
      { text: t('common.ok'), onPress: () => navigation.navigate('CoachTabs') },
    ])
  }

  // Edit helpers
  const updateEditField = (field, value) => setEditSummary(prev => ({ ...prev, [field]: value }))
  const updateEditArrayItem = (field, index, value) => {
    const arr = [...(editSummary[field] || [])]
    arr[index] = value
    setEditSummary(prev => ({ ...prev, [field]: arr }))
  }
  const removeEditArrayItem = (field, index) => {
    const arr = [...(editSummary[field] || [])]
    arr.splice(index, 1)
    setEditSummary(prev => ({ ...prev, [field]: arr }))
  }
  const addEditArrayItem = (field, defaultVal) => {
    const arr = [...(editSummary[field] || []), defaultVal]
    setEditSummary(prev => ({ ...prev, [field]: arr }))
  }

  const summary = isEditing ? editSummary : (record?.ai_summary || {})
  const isSent = record?.status === 'sent'
  const canSend = record?.status === 'ready' || record?.status === 'edited'
  const durationMin = record?.duration_seconds ? Math.round(record.duration_seconds / 60) : 0

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={s.loadingText}>{t('session_summary.generating')}</Text>
        </View>
      </SafeAreaView>
    )
  }

  // Timeout state
  if (timedOut) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.loadingContainer}>
          <Ionicons name="time-outline" size={48} color={colors.warning} />
          <Text style={s.loadingText}>{t('session_summary.generation_timeout')}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={handleRetry}>
            <Text style={s.retryBtnTxt}>{t('session_summary.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{t('session_summary.title_for', { name: player?.full_name || '' })}</Text>
          <Text style={s.headerSub}>{durationMin} min</Text>
        </View>
        {isSent && (
          <View style={s.sentBadge}><Text style={s.sentBadgeTxt}>{t('session_summary.sent_badge')}</Text></View>
        )}
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        {/* Worked on */}
        <View style={[s.card, s.cardGreen]}>
          <Text style={s.sectionLabel}>{t('session_summary.section_worked_on')}</Text>
          {isEditing ? (
            <TextInput style={s.editInput} value={summary.worked_on || ''} onChangeText={v => updateEditField('worked_on', v)} multiline />
          ) : (
            <Text style={s.paragraph}>{summary.worked_on}</Text>
          )}
        </View>

        {/* Strengths */}
        <View style={[s.card, s.cardBlue]}>
          <Text style={s.sectionLabel}>{t('session_summary.section_strengths')}</Text>
          {(summary.strengths || []).map((item, i) => (
            <View key={i} style={s.bulletRow}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#3B82F6" style={{ marginTop: 2 }} />
              {isEditing ? (
                <TextInput style={[s.editInput, { flex: 1 }]} value={item} onChangeText={v => updateEditArrayItem('strengths', i, v)} />
              ) : (
                <Text style={s.bulletText}>{item}</Text>
              )}
              {isEditing && (
                <TouchableOpacity onPress={() => removeEditArrayItem('strengths', i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
          ))}
          {isEditing && (
            <TouchableOpacity onPress={() => addEditArrayItem('strengths', '')} style={s.addBtn}>
              <Text style={s.addBtnTxt}>{t('session_summary.add_item')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Improvements */}
        <View style={[s.card, s.cardAmber]}>
          <Text style={s.sectionLabel}>{t('session_summary.section_improvements')}</Text>
          {(summary.improvements || []).map((item, i) => (
            <View key={i} style={s.bulletRow}>
              <Ionicons name="trending-up-outline" size={16} color={colors.warning} style={{ marginTop: 2 }} />
              {isEditing ? (
                <TextInput style={[s.editInput, { flex: 1 }]} value={item} onChangeText={v => updateEditArrayItem('improvements', i, v)} />
              ) : (
                <Text style={s.bulletText}>{item}</Text>
              )}
              {isEditing && (
                <TouchableOpacity onPress={() => removeEditArrayItem('improvements', i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
          ))}
          {isEditing && (
            <TouchableOpacity onPress={() => addEditArrayItem('improvements', '')} style={s.addBtn}>
              <Text style={s.addBtnTxt}>{t('session_summary.add_item')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Drills */}
        <View style={[s.card, s.cardTeal]}>
          <Text style={s.sectionLabel}>{t('session_summary.section_drills')}</Text>
          {(summary.drills || []).map((drill, i) => {
            const drillStr = typeof drill === 'string'
            const name = drillStr ? drill : drill?.name || ''
            const desc = drillStr ? '' : drill?.description || ''
            return (
              <View key={i} style={s.drillRow}>
                <Ionicons name="flag-outline" size={16} color="#10B981" style={{ marginTop: 2 }} />
                {isEditing ? (
                  <View style={{ flex: 1, gap: 4 }}>
                    <TextInput style={s.editInput} value={name} onChangeText={v => {
                      const arr = [...(editSummary.drills || [])]
                      arr[i] = drillStr ? v : { ...arr[i], name: v }
                      setEditSummary(prev => ({ ...prev, drills: arr }))
                    }} placeholder={t('session_summary.drill_name_placeholder')} placeholderTextColor={colors.textTertiary} />
                    {!drillStr && (
                      <TextInput style={s.editInput} value={desc} onChangeText={v => {
                        const arr = [...(editSummary.drills || [])]
                        arr[i] = { ...arr[i], description: v }
                        setEditSummary(prev => ({ ...prev, drills: arr }))
                      }} placeholder={t('session_summary.drill_desc_placeholder')} placeholderTextColor={colors.textTertiary} />
                    )}
                  </View>
                ) : (
                  <View style={{ flex: 1 }}>
                    <Text style={s.drillName}>{name}</Text>
                    {desc ? <Text style={s.drillDesc}>{desc}</Text> : null}
                  </View>
                )}
                {isEditing && (
                  <TouchableOpacity onPress={() => removeEditArrayItem('drills', i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                )}
              </View>
            )
          })}
          {isEditing && (
            <TouchableOpacity onPress={() => addEditArrayItem('drills', { name: '', description: '' })} style={s.addBtn}>
              <Text style={s.addBtnTxt}>{t('session_summary.add_item')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Coach message */}
        <View style={s.messageSection}>
          {isEditing ? (
            <TextInput style={[s.editInput, { textAlign: 'center', fontStyle: 'italic' }]} value={summary.coach_message || ''} onChangeText={v => updateEditField('coach_message', v)} multiline />
          ) : (
            <Text style={s.messageText}>{summary.coach_message}</Text>
          )}
        </View>
      </ScrollView>

      {/* Bottom actions */}
      <View style={s.bottomActions}>
        {isEditing ? (
          <>
            <TouchableOpacity style={s.cancelBtn} onPress={handleCancelEdit}>
              <Text style={s.cancelBtnTxt}>{t('session_summary.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={handleSaveEdit}>
              <Text style={s.saveBtnTxt}>{t('session_summary.save_edit')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {!isSent && (
              <TouchableOpacity style={s.editBtn} onPress={() => setIsEditing(true)}>
                <Ionicons name="pencil-outline" size={18} color={colors.primary} />
                <Text style={s.editBtnTxt}>{t('session_summary.edit')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[s.sendBtn, (!canSend || isSending) && s.sendBtnDisabled]}
              onPress={() => setShowSendModal(true)}
              disabled={!canSend || isSending}
            >
              {isSending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="send-outline" size={18} color="#fff" />
                  <Text style={s.sendBtnTxt}>{isSent ? t('session_summary.sent_badge') : t('session_summary.send')}</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Send confirm modal */}
      <Modal visible={showSendModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{t('session_summary.confirm_send_title')}</Text>
            <Text style={s.modalBody}>{t('session_summary.confirm_send_body', { name: player?.full_name || '' })}</Text>
            <View style={s.modalBtns}>
              <TouchableOpacity onPress={() => setShowSendModal(false)} style={s.modalBtnCancel}>
                <Text style={s.modalBtnCancelTxt}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSend} style={s.modalBtnSend}>
                <Text style={s.modalBtnSendTxt}>{t('session_summary.confirm_send_cta')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceElevated },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { fontSize: 16, color: colors.textSecondary, fontWeight: '500' },
  retryBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10, marginTop: 8 },
  retryBtnTxt: { color: colors.textInverse, fontSize: 14, fontWeight: '700' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: colors.surface, borderBottomWidth: 0.5, borderBottomColor: colors.borderStrong },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  headerSub: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  sentBadge: { backgroundColor: colors.primaryLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  sentBadgeTxt: { fontSize: 12, fontWeight: '600', color: colors.primary },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24, gap: 12 },
  card: { borderRadius: 12, padding: 14, borderLeftWidth: 4 },
  cardGreen: { backgroundColor: '#F0FDF4', borderLeftColor: '#22C55E' },
  cardBlue: { backgroundColor: '#EFF6FF', borderLeftColor: '#3B82F6' },
  cardAmber: { backgroundColor: '#FFFBEB', borderLeftColor: colors.warning },
  cardTeal: { backgroundColor: '#ECFDF5', borderLeftColor: '#10B981' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.5, marginBottom: 8 },
  paragraph: { fontSize: 15, color: colors.textPrimary, lineHeight: 22 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  bulletText: { flex: 1, fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  drillRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  drillName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  drillDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  messageSection: { paddingVertical: 8, paddingHorizontal: 4 },
  messageText: { fontSize: 15, color: colors.textSecondary, fontStyle: 'italic', textAlign: 'center', lineHeight: 22 },
  editInput: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, padding: 10, fontSize: 14, color: colors.textPrimary },
  addBtn: { marginTop: 6, alignSelf: 'flex-start' },
  addBtnTxt: { fontSize: 13, fontWeight: '600', color: colors.primary },
  bottomActions: { flexDirection: 'row', gap: 10, padding: 16, backgroundColor: colors.surface, borderTopWidth: 0.5, borderTopColor: colors.borderStrong },
  editBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.borderStrong },
  editBtnTxt: { fontSize: 15, fontWeight: '600', color: colors.primary },
  sendBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary },
  sendBtnDisabled: { backgroundColor: '#C4C4C4' },
  sendBtnTxt: { fontSize: 15, fontWeight: '700', color: colors.textInverse },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center' },
  cancelBtnTxt: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  saveBtnTxt: { fontSize: 15, fontWeight: '700', color: colors.textInverse },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  modalCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, width: '100%' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  modalBody: { fontSize: 14, color: colors.textSecondary, marginBottom: 16, lineHeight: 20 },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalBtnCancel: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center' },
  modalBtnCancelTxt: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  modalBtnSend: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center' },
  modalBtnSendTxt: { fontSize: 15, fontWeight: '700', color: colors.textInverse },
})
