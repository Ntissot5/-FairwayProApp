import { useState } from 'react'
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native'
import { colors } from './theme'

const DAYS = ['L','M','M','J','V','S','D']
const MONTHS = ['Janvier','Fevrier','Mars','Avril','Mai','Juin','Juillet','Aout','Septembre','Octobre','Novembre','Decembre']

export default function CalendarPicker({ value, onChange, onClose }) {
  const initial = value ? new Date(value) : new Date()
  const [viewDate, setViewDate] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1))
  const selected = value ? new Date(value) : null

  const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
  const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))

  const getDays = () => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const offset = firstDay === 0 ? 6 : firstDay - 1
    const days = []
    for (let i = 0; i < offset; i++) days.push(null)
    for (let i = 1; i <= daysInMonth; i++) days.push(i)
    return days
  }

  const selectDay = (day) => {
    if (!day) return
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day)
    const iso = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
    onChange(iso)
    onClose()
  }

  const isSelected = (day) => {
    if (!day || !selected) return false
    return selected.getDate() === day && selected.getMonth() === viewDate.getMonth() && selected.getFullYear() === viewDate.getFullYear()
  }

  const isToday = (day) => {
    if (!day) return false
    const today = new Date()
    return today.getDate() === day && today.getMonth() === viewDate.getMonth() && today.getFullYear() === viewDate.getFullYear()
  }

  return (
    <Modal visible animationType="fade" transparent>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={s.container} activeOpacity={1}>
          <View style={s.header}>
            <TouchableOpacity onPress={prevMonth} style={s.navBtn}>
              <Text style={s.navTxt}>{"<"}</Text>
            </TouchableOpacity>
            <Text style={s.monthTitle}>{MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}</Text>
            <TouchableOpacity onPress={nextMonth} style={s.navBtn}>
              <Text style={s.navTxt}>{">"}</Text>
            </TouchableOpacity>
          </View>
          <View style={s.daysHeader}>
            {DAYS.map((d, i) => (
              <Text key={i} style={s.dayLabel}>{d}</Text>
            ))}
          </View>
          <View style={s.grid}>
            {getDays().map((day, i) => (
              <TouchableOpacity key={i} style={[s.dayCell, isSelected(day) && s.dayCellSelected, isToday(day) && !isSelected(day) && s.dayCellToday]} onPress={() => selectDay(day)}>
                <Text style={[s.dayTxt, isSelected(day) && s.dayTxtSelected, isToday(day) && !isSelected(day) && s.dayTxtToday]}>
                  {day || ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
            <Text style={s.cancelTxt}>Annuler</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  container: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, width: 320 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  navTxt: { fontSize: 18, color: colors.primary, fontWeight: '600' },
  monthTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  daysHeader: { flexDirection: 'row', marginBottom: 8 },
  dayLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: colors.textTertiary },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  dayCellSelected: { backgroundColor: colors.primary },
  dayCellToday: { borderWidth: 1.5, borderColor: colors.primary },
  dayTxt: { fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
  dayTxtSelected: { color: colors.textInverse, fontWeight: '700' },
  dayTxtToday: { color: colors.primary, fontWeight: '700' },
  cancelBtn: { marginTop: 16, alignItems: 'center', padding: 10 },
  cancelTxt: { fontSize: 15, color: colors.textTertiary, fontWeight: '600' },
})
