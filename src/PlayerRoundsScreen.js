import { useState, useEffect, useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Modal, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Svg, Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg'
import { supabase } from './supabase'
import { useTheme } from './ThemeContext'
import { useTranslation } from 'react-i18next'
import AnimatedPressable from './components/AnimatedPressable'
import AnimatedListItem from './components/AnimatedListItem'
import { CardListSkeleton } from './components/Skeleton'

function QuickModeScreen({ onSave, onBack, colors }) {
  const { t } = useTranslation()
  const s = useMemo(() => makeStyles(colors), [colors])
  const [course, setCourse] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [score, setScore] = useState('')
  const [newHcp, setNewHcp] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!score) { Alert.alert('Entre un score'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: player } = await supabase.from('players').select('id').eq('player_user_id', user.id).single()
    if (player) {
      const { error } = await supabase.from('rounds').insert({ player_id: player.id, course_name: course, played_at: date, score: parseInt(score) })
      if (error) { Alert.alert('Erreur', error.message); setSaving(false); return }
      if (newHcp) {
        await supabase.from('handicap_history').insert({ player_id: player.id, handicap: parseFloat(newHcp), date })
        await supabase.from('players').update({ current_handicap: parseFloat(newHcp) }).eq('id', player.id)
      }
    }
    setSaving(false)
    onSave()
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.card }}>
      <View style={s.modalHead}>
        <TouchableOpacity onPress={onBack}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
            <Text style={s.backTxt}>{t('common.back')}</Text>
          </View>
        </TouchableOpacity>
        <Text style={s.modalTitle}>{t('rounds.quickMode')}</Text>
        <View style={{ width: 50 }} />
      </View>
      <ScrollView style={{ padding: 20 }}>
        <Text style={s.label}>{t('rounds.course')}</Text>
        <TextInput style={s.input} value={course} onChangeText={setCourse} placeholder={t('rounds.coursePlaceholder')} placeholderTextColor={colors.textTertiary} />
        <Text style={s.label}>{t('rounds.date')}</Text>
        <TextInput style={s.input} value={date} onChangeText={setDate} placeholderTextColor={colors.textTertiary} />
        <Text style={s.label}>{t('rounds.totalScore')}</Text>
        <TextInput style={s.input} value={score} onChangeText={setScore} placeholder="82" keyboardType="numeric" placeholderTextColor={colors.textTertiary} />
        <Text style={s.label}>{t('rounds.newHcp')}</Text>
        <TextInput style={s.input} value={newHcp} onChangeText={setNewHcp} placeholder="8.4" keyboardType="decimal-pad" placeholderTextColor={colors.textTertiary} />
        <AnimatedPressable style={[s.saveBtn, saving && { opacity: 0.7 }]} onPress={save} disabled={saving}>
          <Text style={s.saveBtnTxt}>{saving ? t('rounds.saving') : t('common.save')}</Text>
        </AnimatedPressable>
      </ScrollView>
    </View>
  )
}

function DetailedSetupScreen({ onStart, onBack, colors }) {
  const { t } = useTranslation()
  const s = useMemo(() => makeStyles(colors), [colors])
  const [course, setCourse] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [holes, setHoles] = useState(18)

  return (
    <View style={{ flex: 1, backgroundColor: colors.card }}>
      <View style={s.modalHead}>
        <TouchableOpacity onPress={onBack}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
            <Text style={s.backTxt}>{t('common.back')}</Text>
          </View>
        </TouchableOpacity>
        <Text style={s.modalTitle}>{t('rounds.detailedMode')}</Text>
        <View style={{ width: 50 }} />
      </View>
      <View style={{ padding: 20 }}>
        <Text style={s.label}>{t('rounds.course')}</Text>
        <TextInput style={s.input} value={course} onChangeText={setCourse} placeholder={t('rounds.coursePlaceholder')} placeholderTextColor={colors.textTertiary} />
        <Text style={s.label}>{t('rounds.date')}</Text>
        <TextInput style={s.input} value={date} onChangeText={setDate} placeholderTextColor={colors.textTertiary} />
        <Text style={s.label}>{t('rounds.holes')}</Text>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
          {[9, 18].map(h => (
            <TouchableOpacity key={h} onPress={() => setHoles(h)} style={[s.holeBtn, holes === h && s.holeBtnActive]}>
              <Text style={[s.holeBtnTxt, holes === h && s.holeBtnTxtActive]}>{h === 9 ? t('rounds.holes9') : t('rounds.holes18')}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <AnimatedPressable style={[s.saveBtn, { marginTop: 24 }]} onPress={() => onStart({ course, date, holes })}>
          <Text style={s.saveBtnTxt}>{t('rounds.start')} <Ionicons name="arrow-forward" size={16} color="#fff" /></Text>
        </AnimatedPressable>
      </View>
    </View>
  )
}

function HoleScreen({ hole, total, holeData, onUpdate, onNext, onFinish, onBack, isLast, holesData, currentHoleNum, colors }) {
  const { t } = useTranslation()
  const s = useMemo(() => makeStyles(colors), [colors])
  const [localStrokes, setLocalStrokes] = useState(holeData.strokes || 0)
  const otherHolesScore = Object.entries(holesData || {}).filter(([k]) => parseInt(k) !== currentHoleNum).reduce((sum, [, h]) => sum + (h.strokes || 0), 0)
  const totalScore = otherHolesScore + localStrokes
  const par = holeData.par || 4
  const strokes = localStrokes
  const diff = strokes > 0 ? strokes - par : null
  const scoreLabel = diff === null ? '' : diff === -2 ? t('rounds.eagle') : diff === -1 ? t('rounds.birdie') : diff === 0 ? t('rounds.par') : diff === 1 ? t('rounds.bogey') : diff === 2 ? t('rounds.doubleBogey') : '+' + diff
  const scoreColor = diff === null ? colors.textTertiary : diff < 0 ? '#16A34A' : diff === 0 ? colors.primary : diff === 1 ? '#F59E0B' : colors.destructive

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgSecondary }}>
      <View style={s.holeHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <TouchableOpacity onPress={() => Alert.alert(t('rounds.quitQuestion'), t('rounds.quitMsg'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('rounds.quit'), style: 'destructive', onPress: onBack }])} style={{ marginRight: 12 }}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={[s.holeTitle, { flex: 1 }]}>{t('rounds.hole', { n: hole })}</Text>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{t('rounds.score', { score: totalScore })}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={s.holeTitle}></Text>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 6 }}>{hole}/{total}</Text>
          <View style={s.progressBar}>
            {Array.from({ length: total }, (_, i) => (
              <View key={i} style={[s.progressDot, i < hole - 1 && s.progressDotDone, i === hole - 1 && s.progressDotCurrent]} />
            ))}
          </View>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        <View style={s.holeCard}>
          <Text style={s.cardLabel}>{t('rounds.holePar')}</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            {[3, 4, 5].map(p => (
              <TouchableOpacity key={p} onPress={() => onUpdate({ ...holeData, par: p })} style={[s.parBtn, par === p && s.parBtnActive]}>
                <Text style={[s.parBtnTxt, par === p && s.parBtnTxtActive]}>Par {p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={s.holeCard}>
          <Text style={s.cardLabel}>{t('rounds.strokes')}</Text>
          <View style={s.counter}>
            <TouchableOpacity onPress={() => { const v = Math.max(0, strokes - 1); setLocalStrokes(v); onUpdate({ ...holeData, strokes: v }) }} style={s.counterBtn}>
              <Text style={s.counterBtnTxt}>{'\u2212'}</Text>
            </TouchableOpacity>
            <View style={{ alignItems: "center" }}>
              <Text style={s.counterValue}>{strokes}</Text>
              {scoreLabel ? <Text style={[s.scoreLabel, { color: scoreColor }]}>{scoreLabel}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => { const v = strokes + 1; setLocalStrokes(v); onUpdate({ ...holeData, strokes: v }) }} style={[s.counterBtn, s.counterBtnGreen]}>
              <Text style={[s.counterBtnTxt, { color: "#fff" }]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.holeCard}>
          <Text style={s.cardLabel}>{t('rounds.putts')}</Text>
          <View style={s.counter}>
            <TouchableOpacity onPress={() => onUpdate({ ...holeData, putts: Math.max(0, (holeData.putts || 0) - 1) })} style={s.counterBtn}>
              <Text style={s.counterBtnTxt}>{'\u2212'}</Text>
            </TouchableOpacity>
            <Text style={s.counterValue}>{holeData.putts || 0}</Text>
            <TouchableOpacity onPress={() => onUpdate({ ...holeData, putts: (holeData.putts || 0) + 1 })} style={[s.counterBtn, s.counterBtnGreen]}>
              <Text style={[s.counterBtnTxt, { color: "#fff" }]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.holeCard}>
          <Text style={s.cardLabel}>{t('rounds.fairway')}</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            {[["left", "\u2190 " + t('rounds.left')], ["hit", "\u2713 " + t('rounds.hit')], ["right", t('rounds.right') + " \u2192"]].map(([val, label]) => (
              <TouchableOpacity key={val} onPress={() => onUpdate({ ...holeData, fairway: holeData.fairway === val ? null : val })} style={[s.toggleBtn, holeData.fairway === val && (val === "hit" ? s.toggleBtnGreen : s.toggleBtnRed)]}>
                <Text style={[s.toggleBtnTxt, holeData.fairway === val && { color: "#fff" }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={s.holeCard}>
          <Text style={s.cardLabel}>{t('rounds.gir')}</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            {[["yes", "\u2713 Oui"], ["no", "\u2717 Non"]].map(([val, label]) => (
              <TouchableOpacity key={val} onPress={() => onUpdate({ ...holeData, gir: holeData.gir === val ? null : val })} style={[s.toggleBtn, { flex: 1 }, holeData.gir === val && (val === "yes" ? s.toggleBtnGreen : s.toggleBtnRed)]}>
                <Text style={[s.toggleBtnTxt, holeData.gir === val && { color: "#fff" }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={s.holeCard}>
          <Text style={s.cardLabel}>BUNKER</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            {[["no", "\u2713 Non"], ["yes", "\u2717 Oui"]].map(([val, label]) => (
              <TouchableOpacity key={val} onPress={() => onUpdate({ ...holeData, bunker: holeData.bunker === val ? null : val })} style={[s.toggleBtn, { flex: 1 }, holeData.bunker === val && (val === "no" ? s.toggleBtnGreen : s.toggleBtnRed)]}>
                <Text style={[s.toggleBtnTxt, holeData.bunker === val && { color: "#fff" }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <AnimatedPressable style={s.saveBtn} onPress={isLast ? onFinish : onNext}>
          <Text style={s.saveBtnTxt}>{isLast ? t('rounds.finishRound') : t('rounds.nextHole')} <Ionicons name={isLast ? "checkmark" : "arrow-forward"} size={16} color="#fff" /></Text>
        </AnimatedPressable>
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  )
}

function StatsView({ rounds, colors }) {
  const s = useMemo(() => makeStyles(colors), [colors])
  const [period, setPeriod] = useState('1M')

  const filterByPeriod = (rounds, period) => {
    const now = new Date()
    const cutoff = new Date()
    if (period === '1S') cutoff.setDate(now.getDate() - 7)
    else if (period === '1M') cutoff.setMonth(now.getMonth() - 1)
    else if (period === '6M') cutoff.setMonth(now.getMonth() - 6)
    else if (period === '1A') cutoff.setFullYear(now.getFullYear() - 1)
    else return rounds
    return rounds.filter(r => new Date(r.played_at) >= cutoff)
  }

  const filtered = filterByPeriod(rounds, period)
  const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0

  if (rounds.length < 2) return (
    <View style={{ padding: 32, alignItems: 'center' }}>
      <Text style={{ fontSize: 13, color: colors.textTertiary, textAlign: 'center' }}>Ajoute au moins 2 rounds pour voir tes stats</Text>
    </View>
  )

  const scores = filtered.map(r => r.score).filter(Boolean)
  const best = scores.length ? Math.min(...scores) : 0
  const avgScore = avg(scores)
  const avgPutts = avg(filtered.map(r => r.putts).filter(Boolean))
  const avgGir = avg(filtered.map(r => r.gir).filter(Boolean))
  const avgFw = avg(filtered.map(r => r.fairways_hit).filter(Boolean))

  const prevPeriod = (() => {
    const now = new Date()
    const start2 = new Date(), end2 = new Date()
    if (period === '1S') { end2.setDate(now.getDate() - 7); start2.setDate(now.getDate() - 14) }
    else if (period === '1M') { end2.setMonth(now.getMonth() - 1); start2.setMonth(now.getMonth() - 2) }
    else return []
    return rounds.filter(r => { const d = new Date(r.played_at); return d >= start2 && d < end2 })
  })()
  const prevAvg = avg(prevPeriod.map(r => r.score).filter(Boolean))
  const trend = prevAvg && avgScore ? avgScore - prevAvg : 0

  const scoreDist = { eagle: 0, birdie: 0, par: 0, bogey: 0, double: 0, worse: 0 }
  filtered.forEach(r => {
    if (r.holes_data) {
      try {
        const holes = JSON.parse(r.holes_data)
        Object.values(holes).forEach(h => {
          const diff = (h.strokes || 0) - (h.par || 4)
          if (diff <= -2) scoreDist.eagle++
          else if (diff === -1) scoreDist.birdie++
          else if (diff === 0) scoreDist.par++
          else if (diff === 1) scoreDist.bogey++
          else if (diff === 2) scoreDist.double++
          else if (diff > 2) scoreDist.worse++
        })
      } catch(e) {}
    }
  })
  const totalHoles = Object.values(scoreDist).reduce((a, b) => a + b, 0)

  const chartRounds = [...filtered].reverse().slice(-8)
  const chartScores = chartRounds.map(r => r.score).filter(Boolean)
  const W = 300, H = 120, padL = 28, padR = 8, padT = 10, padB = 20
  const chartW = W - padL - padR
  const chartH = H - padT - padB
  const maxS = chartScores.length ? Math.max(...chartScores) + 2 : 100
  const minS = chartScores.length ? Math.min(...chartScores) - 2 : 70
  const rangeS = maxS - minS || 1
  const pts = chartScores.map((sc, i) => ({
    x: padL + (i / Math.max(chartScores.length - 1, 1)) * chartW,
    y: padT + ((maxS - sc) / rangeS) * chartH,
    date: chartRounds[i]?.played_at?.slice(5)
  }))
  const linePath = pts.map((p, i) => (i === 0 ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ")
  const areaPath = pts.length > 1 ? linePath + " L" + pts[pts.length-1].x.toFixed(1) + " " + (padT + chartH) + " L" + pts[0].x.toFixed(1) + " " + (padT + chartH) + " Z" : ""

  return (
    <View>
      {/* Period selector */}
      <View style={{ flexDirection: "row", gap: 6, padding: 16, paddingBottom: 8 }}>
        {["1S","1M","6M","1A","Tout"].map(p => (
          <TouchableOpacity key={p} onPress={() => setPeriod(p)} style={{ flex: 1, paddingVertical: 7, alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: period === p ? colors.primary : colors.separator, backgroundColor: period === p ? colors.primary : colors.card }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: period === p ? "#fff" : colors.textTertiary }}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Key stats */}
      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
        {[
          { label: "MEILLEUR", value: best || "\u2014", clr: colors.primary },
          { label: "MOYENNE", value: avgScore || "\u2014", clr: colors.text, trend },
          { label: "PUTTS MOY.", value: avgPutts || "\u2014", clr: colors.text },
          { label: "ROUNDS", value: filtered.length, clr: colors.text },
        ].map((stat, i) => (
          <View key={i} style={[s.statCard, i === 0 && { borderTopWidth: 3, borderTopColor: colors.primary }]}>
            <Text style={[s.statCardValue, { color: stat.clr }]}>{stat.value}</Text>
            {stat.trend !== undefined && stat.trend !== 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name={stat.trend < 0 ? "arrow-down" : "arrow-up"} size={10} color={stat.trend < 0 ? colors.primary : colors.destructive} />
                <Text style={{ fontSize: 10, fontWeight: "700", color: stat.trend < 0 ? colors.primary : colors.destructive }}>
                  {' '}{Math.abs(stat.trend)}
                </Text>
              </View>
            )}
            <Text style={s.statCardLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Score chart */}
      {pts.length >= 2 && (
        <View style={s.chartSection}>
          <Text style={s.chartTitle}>Evolution du score</Text>
          <Svg width={W} height={H}>
            <Defs>
              <LinearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.primary} stopOpacity="0.2" />
                <Stop offset="1" stopColor={colors.primary} stopOpacity="0.02" />
              </LinearGradient>
            </Defs>
            <Line x1={padL} y1={padT} x2={padL} y2={padT + chartH} stroke={colors.separator} strokeWidth="1" />
            <Line x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH} stroke={colors.separator} strokeWidth="1" />
            <SvgText x={padL - 4} y={padT + 4} fontSize="9" fill={colors.textTertiary} textAnchor="end">{maxS}</SvgText>
            <SvgText x={padL - 4} y={padT + chartH} fontSize="9" fill={colors.textTertiary} textAnchor="end">{minS}</SvgText>
            <Path d={areaPath} fill="url(#scoreGrad)" />
            <Path d={linePath} stroke={colors.primary} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {pts.map((p, i) => (
              <Circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 5 : 3} fill={i === pts.length - 1 ? colors.primary : "#86EFAC"} stroke={colors.card} strokeWidth="1.5" />
            ))}
            <SvgText x={pts[0]?.x} y={H} fontSize="9" fill={colors.textTertiary} textAnchor="start">{pts[0]?.date}</SvgText>
            <SvgText x={pts[pts.length-1]?.x} y={H} fontSize="9" fill={colors.textTertiary} textAnchor="end">{pts[pts.length-1]?.date}</SvgText>
          </Svg>
        </View>
      )}

      {/* Score distribution */}
      {totalHoles > 0 && (
        <View style={s.chartSection}>
          <Text style={s.chartTitle}>Repartition des scores</Text>
          <View style={{ flexDirection: "row", gap: 4, marginTop: 12, height: 60, alignItems: "flex-end" }}>
            {[
              { label: "Eagle", count: scoreDist.eagle, color: "#7C3AED" },
              { label: "Birdie", count: scoreDist.birdie, color: colors.primary },
              { label: "Par", count: scoreDist.par, color: "#0891B2" },
              { label: "Bogey", count: scoreDist.bogey, color: "#F59E0B" },
              { label: "Dbl", count: scoreDist.double, color: "#EF4444" },
              { label: "+3", count: scoreDist.worse, color: colors.destructive },
            ].map((item, i) => {
              const maxCount = Math.max(scoreDist.eagle, scoreDist.birdie, scoreDist.par, scoreDist.bogey, scoreDist.double, scoreDist.worse, 1)
              const h = Math.max((item.count / maxCount) * 44, item.count > 0 ? 4 : 0)
              return (
                <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
                  {item.count > 0 && <Text style={{ fontSize: 10, color: item.color, fontWeight: "700", marginBottom: 2 }}>{item.count}</Text>}
                  <View style={{ width: "80%", height: h, backgroundColor: item.color, borderRadius: 4, opacity: item.count > 0 ? 1 : 0.15 }} />
                  <Text style={{ fontSize: 9, color: colors.textTertiary, marginTop: 4 }}>{item.label}</Text>
                </View>
              )
            })}
          </View>
        </View>
      )}

      {/* Detailed stats */}
      <View style={s.chartSection}>
        <Text style={s.chartTitle}>Statistiques detaillees</Text>
        {[
          { label: "Putts moyens", value: avgPutts, target: 30, unit: "putts", lower: true },
          { label: "GIR moyen", value: avgGir, target: 12, unit: "/18", lower: false },
          { label: "Fairways touches", value: avgFw, target: 10, unit: "/14", lower: false },
        ].map((stat, i) => {
          const val = stat.value || 0
          const pct = val ? Math.min((stat.lower ? stat.target / val : val / stat.target) * 100, 100) : 0
          const clr = val ? (stat.lower ? (val <= stat.target ? colors.primary : colors.destructive) : (val >= stat.target ? colors.primary : '#F59E0B')) : colors.separator
          return (
            <View key={i} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: "500" }}>{stat.label}</Text>
                <Text style={{ fontSize: 13, fontWeight: "800", color: val ? clr : colors.textTertiary }}>{val || "\u2014"}{val ? " " + stat.unit : ""}</Text>
              </View>
              <View style={{ height: 8, backgroundColor: colors.separatorLight, borderRadius: 4 }}>
                <View style={{ height: 8, width: pct + "%", backgroundColor: clr, borderRadius: 4 }} />
              </View>
              <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 3 }}>Objectif: {stat.target} {stat.unit}</Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

export default function PlayerRoundsScreen({ navigation }) {
  const { colors, isDark } = useTheme()
  const { t } = useTranslation()
  const s = useMemo(() => makeStyles(colors), [colors])

  const [rounds, setRounds] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [screen, setScreen] = useState('list')
  const [tab, setTab] = useState('rounds')
  const [roundConfig, setRoundConfig] = useState(null)
  const [currentHole, setCurrentHole] = useState(1)
  const [holesData, setHolesData] = useState({})

  useEffect(() => { fetchRounds() }, [])

  const fetchRounds = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: player } = await supabase.from('players').select('id').eq('player_user_id', user.id).single()
    if (player) {
      const { data: r } = await supabase.from('rounds').select('*').eq('player_id', player.id).order('played_at', { ascending: false })
      setRounds(r || [])
    }
    setLoading(false)
    setRefreshing(false)
  }

  const getLiveScore = (currentHoleData) => { const base = Object.entries(holesData).filter(([k]) => parseInt(k) !== currentHole).reduce((sum, [, h]) => sum + (h.strokes || 0), 0); return base + (currentHoleData?.strokes || 0) }
  const deleteRound = async (id) => {
    Alert.alert(t('rounds.deleteRound'), t('rounds.deleteRoundMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => {
        await supabase.from('rounds').delete().eq('id', id)
        fetchRounds()
      }}
    ])
  }

  const totalScore = Object.values(holesData).reduce((sum, h) => sum + (h.strokes || 0), 0)

  const finishDetailedRound = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: player } = await supabase.from('players').select('id').eq('player_user_id', user.id).single()
    if (!player) return
    const totalPutts = Object.values(holesData).reduce((sum, h) => sum + (h.putts || 0), 0)
    const girCount = Object.values(holesData).filter(h => h.gir === "yes").length
    const fairwaysHit = Object.values(holesData).filter(h => h.fairway === "hit").length
    const { error } = await supabase.from('rounds').insert({
      player_id: player.id,
      course_name: roundConfig.course,
      played_at: roundConfig.date,
      score: totalScore,
      putts: totalPutts,
      gir: girCount,
      fairways_hit: fairwaysHit,
      holes_data: JSON.stringify(holesData)
    })
    if (error) { Alert.alert('Erreur', error.message); return }
    Alert.alert(t('rounds.roundSaved'), "Score: " + totalScore + " | Putts: " + totalPutts)
    setScreen("list")
    fetchRounds()
  }

  if (screen === "choose") return (
    <SafeAreaView style={s.safe}>
      <View style={s.modalHead}>
        <TouchableOpacity onPress={() => setScreen("list")}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
            <Text style={s.backTxt}>{t('common.back')}</Text>
          </View>
        </TouchableOpacity>
        <Text style={s.modalTitle}>{t('rounds.newRound')}</Text>
        <View style={{ width: 50 }} />
      </View>
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 14, color: colors.textTertiary, textAlign: "center", marginBottom: 20 }}>{t('rounds.chooseMode')}</Text>
        <TouchableOpacity style={s.modeCard} onPress={() => setScreen("quick")}>
          <Ionicons name="flash-outline" size={28} color={colors.text} />
          <View style={{ flex: 1 }}>
            <Text style={s.modeTitle}>{t('rounds.quickMode')}</Text>
            <Text style={s.modeSub}>{t('rounds.quickModeSub')}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={[s.modeCard, s.modeCardActive]} onPress={() => setScreen("detailedSetup")}>
          <Ionicons name="bar-chart-outline" size={28} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[s.modeTitle, { color: colors.primary }]}>{t('rounds.detailedMode')}</Text>
            <Text style={s.modeSub}>{t('rounds.detailedModeSub')}</Text>
          </View>
          <View style={s.recommendedBadge}><Text style={s.recommendedTxt}>{t('rounds.recommended')}</Text></View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )

  if (screen === "quick") return <SafeAreaView style={s.safe}><QuickModeScreen onSave={() => { setScreen("list"); fetchRounds() }} onBack={() => setScreen("choose")} colors={colors} /></SafeAreaView>
  if (screen === "detailedSetup") return <SafeAreaView style={s.safe}><DetailedSetupScreen onStart={(config) => { setRoundConfig(config); setCurrentHole(1); setHolesData({}); setScreen("detailed") }} onBack={() => setScreen("choose")} colors={colors} /></SafeAreaView>
  if (screen === "detailed" && roundConfig) return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.primary }]}>
      <HoleScreen
        hole={currentHole} total={roundConfig.holes}
        holeData={holesData[currentHole] || { par: 4, strokes: 0, putts: 0 }}
        onUpdate={(data) => setHolesData({ ...holesData, [currentHole]: data })}
        onNext={() => setCurrentHole(currentHole + 1)}
        onFinish={finishDetailedRound}
        onBack={() => setScreen('list')}
        isLast={currentHole === roundConfig.holes}
        holesData={holesData}
        currentHoleNum={currentHole}
        colors={colors}
      />
    </SafeAreaView>
  )

  if (loading) return (
    <View style={s.loading}>
      <CardListSkeleton />
    </View>
  )

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>{t('rounds.title')}</Text>
          <Text style={s.sub}>{rounds.length} {t('rounds.played')}</Text>
        </View>
        <AnimatedPressable style={s.addBtn} onPress={() => setScreen("choose")}>
          <Text style={s.addBtnTxt}>{t('rounds.addRound')}</Text>
        </AnimatedPressable>
      </View>

      <View style={s.tabs}>
        {['rounds', 'stats'].map(tt => (
          <TouchableOpacity key={tt} style={[s.tab, tab === tt && s.tabActive]} onPress={() => setTab(tt)}>
            <Ionicons name={tt === 'rounds' ? 'flag' : 'bar-chart-outline'} size={14} color={tab === tt ? '#fff' : colors.textTertiary} />
            <Text style={[s.tabTxt, tab === tt && s.tabTxtActive]}> {tt === 'rounds' ? t('rounds.roundsTab') : t('rounds.statsTab')}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRounds() }} tintColor={colors.primary} />}>
        {tab === 'stats' ? (
          <StatsView rounds={rounds} colors={colors} />
        ) : (
          <>
            {rounds.length === 0 ? (
              <View style={{ padding: 40, alignItems: "center" }}>
                <Ionicons name="flag" size={40} color={colors.textTertiary} />
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 16, marginTop: 12 }}>{t('rounds.noRounds')}</Text>
                <AnimatedPressable style={s.addBtn} onPress={() => setScreen("choose")}>
                  <Text style={s.addBtnTxt}>{t('rounds.addFirst')}</Text>
                </AnimatedPressable>
              </View>
            ) : rounds.map((r, idx) => (
              <AnimatedListItem key={r.id} index={idx}>
                <View style={s.roundCard}>
                  <View style={s.roundCardTop}>
                    <View style={s.roundInfo}>
                      <Text style={s.roundCourse}>{r.course_name || t('playerDetail.golfCourse')}</Text>
                      <Text style={s.roundDate}>{r.played_at}</Text>
                    </View>
                    <Text style={s.roundScore}>{r.score}</Text>
                    <TouchableOpacity onPress={() => deleteRound(r.id)} style={{ marginLeft: 12, padding: 6, backgroundColor: colors.destructiveBg, borderRadius: 8 }}>
                      <Ionicons name="close" size={14} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                  {(r.putts || r.gir) ? (
                    <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                      {r.putts ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="flag" size={12} color={colors.textTertiary} /><Text style={s.roundStat}>{r.putts} putts</Text></View> : null}
                      {r.gir ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="locate-outline" size={12} color={colors.textTertiary} /><Text style={s.roundStat}>{r.gir} GIR</Text></View> : null}
                      {r.fairways_hit ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="trending-up" size={12} color={colors.textTertiary} /><Text style={s.roundStat}>{r.fairways_hit} FW</Text></View> : null}
                    </View>
                  ) : null}
                </View>
              </AnimatedListItem>
            ))}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bgSecondary },
  loading: { flex: 1, backgroundColor: c.bgSecondary },
  header: { backgroundColor: c.card, padding: 16, paddingTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 0.5, borderBottomColor: c.separator },
  title: { fontSize: 22, fontWeight: "800", color: c.text, letterSpacing: -0.5 },
  sub: { fontSize: 12, color: c.textTertiary, marginTop: 2 },
  scroll: { flex: 1 },
  tabs: { flexDirection: "row", backgroundColor: c.card, padding: 4, margin: 16, marginBottom: 8, borderRadius: 12, borderWidth: 0.5, borderColor: c.separator },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10, flexDirection: 'row', justifyContent: 'center' },
  tabActive: { backgroundColor: c.primary },
  tabTxt: { fontSize: 13, fontWeight: "600", color: c.textTertiary },
  tabTxtActive: { color: "#fff" },
  addBtn: { backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  addBtnTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },
  roundCard: { backgroundColor: c.card, borderRadius: 12, margin: 16, marginBottom: 8, padding: 14, borderWidth: 0.5, borderColor: c.separator, position: 'relative' },
  roundCardTop: { flexDirection: "row", alignItems: "center" },
  roundInfo: { flex: 1 },
  roundCourse: { fontSize: 14, fontWeight: "600", color: c.text },
  roundDate: { fontSize: 11, color: c.textTertiary, marginTop: 2 },
  roundScore: { fontSize: 28, fontWeight: "800", color: c.primary },
  roundStat: { fontSize: 12, color: c.textTertiary },
  statCard: { flex: 1, backgroundColor: c.card, borderRadius: 12, padding: 10, alignItems: "center", borderWidth: 0.5, borderColor: c.separator },
  statCardValue: { fontSize: 20, fontWeight: "800" },
  statCardLabel: { fontSize: 9, color: c.textTertiary, fontWeight: "600", marginTop: 3 },
  chartSection: { backgroundColor: c.card, margin: 16, marginTop: 0, marginBottom: 8, borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: c.separator },
  chartTitle: { fontSize: 13, fontWeight: "700", color: c.text, marginBottom: 8 },
  modalHead: { backgroundColor: c.card, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 0.5, borderBottomColor: c.separator },
  modalTitle: { fontSize: 17, fontWeight: "700", color: c.text },
  backTxt: { fontSize: 16, color: c.primary, fontWeight: "600" },
  label: { fontSize: 11, fontWeight: "600", color: c.textTertiary, marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 12, padding: 14, fontSize: 15, color: c.text },
  saveBtn: { backgroundColor: c.primary, borderRadius: 14, padding: 16, alignItems: "center", marginTop: 24 },
  saveBtnTxt: { color: "#fff", fontSize: 16, fontWeight: "700" },
  modeCard: { backgroundColor: c.card, borderRadius: 14, padding: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: c.separator },
  modeCardActive: { borderColor: c.primary, borderWidth: 2 },
  modeTitle: { fontSize: 16, fontWeight: "700", color: c.text },
  modeSub: { fontSize: 12, color: c.textTertiary, marginTop: 2 },
  recommendedBadge: { backgroundColor: c.primary, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  recommendedTxt: { fontSize: 9, fontWeight: "700", color: "#fff" },
  holeHeader: { backgroundColor: c.primary, padding: 16, paddingTop: 8 },
  holeTitle: { fontSize: 22, fontWeight: "800", color: "#fff" },
  progressBar: { flexDirection: "row", gap: 3 },
  progressDot: { flex: 1, height: 3, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 2 },
  progressDotDone: { backgroundColor: "rgba(255,255,255,0.6)" },
  progressDotCurrent: { backgroundColor: "#fff" },
  holeCard: { backgroundColor: c.card, borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: c.separator },
  cardLabel: { fontSize: 11, fontWeight: "600", color: c.textTertiary },
  counter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  counterBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.separator, alignItems: "center", justifyContent: "center" },
  counterBtnGreen: { backgroundColor: c.primary, borderColor: c.primary },
  counterBtnTxt: { fontSize: 24, color: c.textSecondary, lineHeight: 28 },
  counterValue: { fontSize: 40, fontWeight: "800", color: c.text },
  scoreLabel: { fontSize: 13, fontWeight: "700", marginTop: 2 },
  parBtn: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: c.separator, alignItems: "center" },
  parBtnActive: { backgroundColor: c.primary, borderColor: c.primary },
  parBtnTxt: { fontSize: 13, fontWeight: "600", color: c.textSecondary },
  parBtnTxtActive: { color: "#fff" },
  toggleBtn: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: c.separator, alignItems: "center" },
  toggleBtnGreen: { backgroundColor: c.primary, borderColor: c.primary },
  toggleBtnRed: { backgroundColor: "#EF4444", borderColor: "#EF4444" },
  toggleBtnTxt: { fontSize: 13, fontWeight: "600", color: c.textSecondary },
  holeBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: c.separator, alignItems: "center" },
  holeBtnActive: { backgroundColor: c.primary, borderColor: c.primary },
  holeBtnTxt: { fontSize: 15, fontWeight: "600", color: c.textSecondary },
  holeBtnTxtActive: { color: "#fff" },
})
