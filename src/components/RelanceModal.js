import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { colors, spacing, radius } from '../theme'
import { generateRelanceMessage, sendRelanceMessage } from '../lib/aiRelance'

export default function RelanceModal({ visible, player, coachId, sessions, onClose }) {
  const [message, setMessage] = useState('')
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (visible && player) {
      setGenerating(true)
      setMessage('')
      generateRelanceMessage(player, sessions)
        .then(msg => { setMessage(msg); setGenerating(false) })
        .catch(() => { setMessage(''); setGenerating(false) })
    }
  }, [visible, player?.id])

  const handleSend = async () => {
    if (!message.trim()) return
    setSending(true)
    try {
      await sendRelanceMessage(coachId, player, message.trim())
      Alert.alert('Message envoyé', `Ton message a été envoyé à ${player.full_name?.split(' ')[0]}`)
      onClose()
    } catch (e) {
      Alert.alert('Erreur', e.message)
    }
    setSending(false)
  }

  const firstName = player?.full_name?.split(' ')[0] || ''

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.title}>Relancer {firstName}</Text>
          <Text style={s.subtitle}>Le message sera envoyé à {firstName} immédiatement</Text>

          {generating ? (
            <View style={s.loaderWrap}>
              <ActivityIndicator color={colors.primary} />
              <Text style={s.loaderTxt}>Génération du message...</Text>
            </View>
          ) : (
            <TextInput
              style={s.input}
              value={message}
              onChangeText={setMessage}
              multiline
              placeholder="Message de relance..."
              placeholderTextColor={colors.textTertiary}
            />
          )}

          <View style={s.buttons}>
            <TouchableOpacity style={s.btnCancel} onPress={onClose} disabled={sending}>
              <Text style={s.btnCancelTxt}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btnSend, (!message.trim() || generating || sending) && { opacity: 0.4 }]}
              onPress={handleSend}
              disabled={!message.trim() || generating || sending}
            >
              {sending ? (
                <ActivityIndicator color={colors.textInverse} size="small" />
              ) : (
                <Text style={s.btnSendTxt}>Envoyer</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  card: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg },
  loaderWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  loaderTxt: { fontSize: 14, color: colors.textSecondary },
  input: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: 15, color: colors.textPrimary, minHeight: 120, textAlignVertical: 'top' },
  buttons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  btnCancel: { flex: 1, paddingVertical: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center' },
  btnCancelTxt: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  btnSend: { flex: 2, paddingVertical: 14, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center' },
  btnSendTxt: { fontSize: 15, fontWeight: '700', color: colors.textInverse },
})
