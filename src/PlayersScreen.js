import { useState, useEffect, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, TextInput, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from './supabase'
import { useTheme } from './ThemeContext'
import { useTranslation } from 'react-i18next'
import AnimatedPressable from './components/AnimatedPressable'
import AnimatedListItem from './components/AnimatedListItem'
import { PlayerListSkeleton } from './components/Skeleton'

export default function PlayersScreen({ navigation }) {
  const { colors } = useTheme()
  const { t } = useTranslation()
  const s = useMemo(() => makeStyles(colors), [colors])
  const [players, setPlayers] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newPlayer, setNewPlayer] = useState({ full_name: '', current_handicap: '' })
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: p } = await supabase.from('players').select('*').eq('coach_id', user.id)
    const { data: s } = await supabase.from('sessions').select('*').eq('coach_id', user.id)
    setPlayers(p || [])
    setSessions(s || [])
    setLoading(false)
    setRefreshing(false)
  }

  const addPlayer = async () => {
    if (!newPlayer.full_name) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('players').insert({ coach_id: user.id, full_name: newPlayer.full_name, current_handicap: parseFloat(newPlayer.current_handicap) || 0 })
    setNewPlayer({ full_name: '', current_handicap: '' })
    setShowAdd(false)
    setSaving(false)
    fetchAll()
  }

  const now = new Date()
  const avatarColors = colors.avatarColors

  if (loading) return <SafeAreaView style={s.safe}><PlayerListSkeleton /></SafeAreaView>

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>{t('players.title')}</Text>
          <Text style={s.sub}>{t('players.count', { count: players.length })}</Text>
        </View>
        <AnimatedPressable style={s.addBtn} onPress={() => setShowAdd(true)}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={s.addBtnTxt}>{t('common.player')}</Text>
        </AnimatedPressable>
      </View>

      <View style={s.searchWrap}>
        <Ionicons name="search" size={16} color={colors.textTertiary} />
        <TextInput style={s.searchInput} value={search} onChangeText={setSearch} placeholder={t('players.search')} placeholderTextColor={colors.textTertiary} />
      </View>

      <ScrollView style={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll() }} tintColor={colors.primary} />}>
        {players.filter(p => !search || p.full_name?.toLowerCase().includes(search.toLowerCase())).map((p, i) => {
          const ps = sessions.filter(s => s.player_id === p.id)
          const revenue = ps.reduce((sum, s) => sum + (s.price || 0), 0)
          const last = ps.sort((a, b) => new Date(b.session_date) - new Date(a.session_date))[0]
          const days = last ? Math.floor((now - new Date(last.session_date)) / (1000*60*60*24)) : null
          const inactive = !days || days > 14
          return (
            <AnimatedListItem key={p.id} index={i}>
              <AnimatedPressable style={[s.row, inactive && s.rowInactive]} onPress={() => navigation.navigate("PlayerDetail", { player: p })}>
                <View style={[s.av, { backgroundColor: avatarColors[i % avatarColors.length] }]}>
                  <Text style={s.avTxt}>{p.full_name?.charAt(0)}</Text>
                </View>
                <View style={s.info}>
                  <Text style={s.name}>{p.full_name}</Text>
                  <Text style={s.rowSub}>{ps.length} {t('common.sessions')}</Text>
                </View>
                <View style={s.right}>
                  <Text style={s.hcp}>{p.current_handicap}</Text>
                  <Text style={s.hcpLabel}>{t('players.hcp')}</Text>
                </View>
                <View style={s.right}>
                  <Text style={s.rev}>{revenue}€</Text>
                  <Text style={s.hcpLabel}>{t('players.revenue')}</Text>
                </View>
                <View style={[s.badge, inactive ? s.badgeRed : s.badgeGreen]}>
                  <Text style={[s.badgeTxt, { color: inactive ? colors.destructive : colors.primary }]}>{inactive ? t('players.inactive') : t('players.activeLabel')}</Text>
                </View>
              </AnimatedPressable>
            </AnimatedListItem>
          )
        })}
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{t('players.addPlayer')}</Text>
            <AnimatedPressable onPress={() => setShowAdd(false)} haptic={false}>
              <Text style={s.modalClose}>{t('common.cancel')}</Text>
            </AnimatedPressable>
          </View>
          <View style={s.modalBody}>
            <Text style={s.label}>{t('players.fullName')}</Text>
            <TextInput style={s.input} value={newPlayer.full_name} onChangeText={v => setNewPlayer({...newPlayer, full_name: v})} placeholder="Emma Wilson" placeholderTextColor={colors.textTertiary} />
            <Text style={s.label}>{t('players.handicap')}</Text>
            <TextInput style={s.input} value={newPlayer.current_handicap} onChangeText={v => setNewPlayer({...newPlayer, current_handicap: v})} placeholder="8.2" keyboardType="decimal-pad" placeholderTextColor={colors.textTertiary} />
            <AnimatedPressable style={[s.btn, saving && { opacity: 0.7 }]} onPress={addPlayer} disabled={saving} hapticStyle="medium">
              <Text style={s.btnTxt}>{saving ? t('players.adding') : t('players.addBtn')}</Text>
            </AnimatedPressable>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bgSecondary },
  header: { backgroundColor: c.bgSecondary, padding: 20, paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 34, fontWeight: '700', color: c.text, letterSpacing: 0.4 },
  sub: { fontSize: 13, color: c.textTertiary, marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.primary, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 },
  addBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '600' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, backgroundColor: c.bgSecondary },
  searchInput: { flex: 1, backgroundColor: c.inputBg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, color: c.text },
  scroll: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: c.card, marginHorizontal: 16, marginTop: 8, borderRadius: 14, ...c.shadow },
  rowInactive: { backgroundColor: c.destructiveBg },
  av: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: c.text },
  rowSub: { fontSize: 11, color: c.textTertiary, marginTop: 2 },
  right: { alignItems: 'center', minWidth: 45 },
  hcp: { fontSize: 16, fontWeight: '800', color: c.primary },
  hcpLabel: { fontSize: 9, color: c.textTertiary, fontWeight: '600' },
  rev: { fontSize: 13, fontWeight: '700', color: c.textSecondary },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeGreen: { backgroundColor: c.primaryLight },
  badgeRed: { backgroundColor: c.destructiveBg },
  badgeTxt: { fontSize: 10, fontWeight: '600' },
  modal: { flex: 1, backgroundColor: c.card },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 0.5, borderBottomColor: c.separator },
  modalTitle: { fontSize: 18, fontWeight: '700', color: c.text },
  modalClose: { fontSize: 16, color: c.primary, fontWeight: '600' },
  modalBody: { padding: 20 },
  label: { fontSize: 12, fontWeight: '600', color: c.textTertiary, marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 12, padding: 14, fontSize: 15, color: c.text },
  btn: { backgroundColor: c.primary, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 24 },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
