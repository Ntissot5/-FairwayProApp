import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'

const G = '#1B5E35'

export default function PermissionPushModal({ visible, onEnable, onLater }) {
  const { t } = useTranslation()
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.overlay}>
        <View style={s.card}>
          <View style={s.iconWrap}>
            <Ionicons name="notifications-outline" size={32} color={G} />
          </View>
          <Text style={s.title}>{t('notifications.permission_title')}</Text>
          <Text style={s.body}>{t('notifications.permission_body')}</Text>
          <View style={s.buttons}>
            <TouchableOpacity style={s.btnLater} onPress={onLater}>
              <Text style={s.btnLaterTxt}>{t('notifications.permission_later')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnEnable} onPress={onEnable}>
              <Text style={s.btnEnableTxt}>{t('notifications.permission_enable')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 28, width: '100%', alignItems: 'center' },
  iconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', marginBottom: 10, textAlign: 'center' },
  body: { fontSize: 14, color: '#6B7280', lineHeight: 22, textAlign: 'center', marginBottom: 24 },
  buttons: { flexDirection: 'row', gap: 12, width: '100%' },
  btnLater: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  btnLaterTxt: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  btnEnable: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: G, alignItems: 'center' },
  btnEnableTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
})
