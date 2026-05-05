import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Modal, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Svg, Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg'
import { supabase } from './supabase'
import { Ionicons } from '@expo/vector-icons'

const G = '#1B5E35'

function QuickModeScreen({ onSave, onBack }) {
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
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={s.modalHead}>
        <TouchableOpacity onPress={onBack}><Text style={s.backTxt}>‹ Back</Text></TouchableOpacity>
        <Text style={s.modalTitle}>Quick mode</Text>
        <View style={{ width: 50 }} />
      </View>
      <ScrollView style={{ padding: 20 }}>
        <Text style={s.label}>COURSE</Text>
        <TextInput style={s.input} value={course} onChangeText={setCourse} placeholder="Golf de Lausanne..." placeholderTextColor="#9CA3AF" />
        <Text style={s.label}>DATE</Text>
        <TextInput style={s.input} value={date} onChangeText={setDate} placeholderTextColor="#9CA3AF" />
        <Text style={s.label}>TOTAL SCORE</Text>
        <TextInput style={s.input} value={score} onChangeText={setScore} placeholder="82" keyboardType="numeric" placeholderTextColor="#9CA3AF" />
        <Text style={s.label}>NEW HANDICAP (optionnel)</Text>
        <TextInput style={s.input} value={newHcp} onChangeText={setNewHcp} placeholder="8.4" keyboardType="decimal-pad" placeholderTextColor="#9CA3AF" />
        <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.7 }]} onPress={save} disabled={saving}>
          <Text style={s.saveBtnTxt}>{saving ? "Saving..." : "Save"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

function DetailedSetupScreen({ onStart, onBack }) {
  const [course, setCourse] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [holes, setHoles] = useState(18)

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={s.modalHead}>
        <TouchableOpacity onPress={onBack}><Text style={s.backTxt}>‹ Back</Text></TouchableOpacity>
        <Text style={s.modalTitle}>Detailed mode</Text>
        <View style={{ width: 50 }} />
      </View>
      <View style={{ padding: 20 }}>
        <Text style={s.label}>COURSE</Text>
        <TextInput style={s.input} value={course} onChangeText={setCourse} placeholder="Golf de Lausanne..." placeholderTextColor="#9CA3AF" />
        <Text style={s.label}>DATE</Text>
        <TextInput style={s.input} value={date} onChangeText={setDate} placeholderTextColor="#9CA3AF" />
        <Text style={s.label}>NUMBER OF HOLES</Text>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
          {[9, 18].map(h => (
            <TouchableOpacity key={h} onPress={() => setHoles(h)} style={[s.holeBtn, holes === h && s.holeBtnActive]}>
              <Text style={[s.holeBtnTxt, holes === h && s.holeBtnTxtActive]}>{h} holes</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={[s.saveBtn, { marginTop: 24 }]} onPress={() => onStart({ course, date, holes })}>
          <Text style={s.saveBtnTxt}>Start →</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function HoleScreen({ hole, total, holeData, onUpdate, onNext, onFinish, onBack, isLast, holesData, currentHoleNum }) {
  const [localStrokes, setLocalStrokes] = useState(holeData.strokes || 0)
  const otherHolesScore = Object.entries(holesData || {}).filter(([k]) => parseInt(k) !== currentHoleNum).reduce((sum, [, h]) => sum + (h.strokes || 0), 0)
  const totalScore = otherHolesScore + localStrokes
  const par = holeData.par || 4
  const strokes = localStrokes
  const diff = strokes > 0 ? strokes - par : null
  const scoreLabel = diff === null ? '' : diff === -2 ? 'Eagle 🦅' : diff === -1 ? 'Birdie 🐦' : diff === 0 ? 'Par ✓' : diff === 1 ? 'Bogey' : diff === 2 ? 'Double Bogey' : '+' + diff
  const scoreColor = diff === null ? '#9CA3AF' : diff < 0 ? '#16A34A' : diff === 0 ? G : diff === 1 ? '#F59E0B' : '#DC2626'

  return (
    <View style={{ flex: 1, backgroundColor: "#f8f8f8" }}>
      <View style={s.holeHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <TouchableOpacity onPress={() => Alert.alert('Quitter ?', 'Ton round ne sera pas sauvegardé.', [{ text: 'Annuler', style: 'cancel' }, { text: 'Quitter', style: 'destructive', onPress: onBack }])} style={{ marginRight: 12 }}>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '300' }}>✕</Text>
          </TouchableOpacity>
          <Text style={[s.holeTitle, { flex: 1 }]}>Hole {hole}</Text>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Score: {totalScore}</Text>
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
          <Text style={s.cardLabel}>HOLE PAR</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            {[3, 4, 5].map(p => (
              <TouchableOpacity key={p} onPress={() => onUpdate({ ...holeData, par: p })} style={[s.parBtn, par === p && s.parBtnActive]}>
                <Text style={[s.parBtnTxt, par === p && s.parBtnTxtActive]}>Par {p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={s.holeCard}>
          <Text style={s.cardLabel}>STROKES</Text>
          <View style={s.counter}>
            <TouchableOpacity onPress={() => { const v = Math.max(0, strokes - 1); setLocalStrokes(v); onUpdate({ ...holeData, strokes: v }) }} style={s.counterBtn}>
              <Text style={s.counterBtnTxt}>−</Text>
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
          <Text style={s.cardLabel}>PUTTS</Text>
          <View style={s.counter}>
            <TouchableOpacity onPress={() => onUpdate({ ...holeData, putts: Math.max(0, (holeData.putts || 0) - 1) })} style={s.counterBtn}>
              <Text style={s.counterBtnTxt}>−</Text>
            </TouchableOpacity>
            <Text style={s.counterValue}>{holeData.putts || 0}</Text>
            <TouchableOpacity onPress={() => onUpdate({ ...holeData, putts: (holeData.putts || 0) + 1 })} style={[s.counterBtn, s.counterBtnGreen]}>
              <Text style={[s.counterBtnTxt, { color: "#fff" }]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.holeCard}>
          <Text style={s.cardLabel}>FAIRWAY</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            {[["left", "← Left"], ["hit", "✓ Hit"], ["right", "Right →"]].map(([val, label]) => (
              <TouchableOpacity key={val} onPress={() => onUpdate({ ...holeData, fairway: holeData.fairway === val ? null : val })} style={[s.toggleBtn, holeData.fairway === val && (val === "hit" ? s.toggleBtnGreen : s.toggleBtnRed)]}>
                <Text style={[s.toggleBtnTxt, holeData.fairway === val && { color: "#fff" }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={s.holeCard}>
          <Text style={s.cardLabel}>GREEN IN REGULATION</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            {[["yes", "✓ Oui"], ["no", "✗ Non"]].map(([val, label]) => (
              <TouchableOpacity key={val} onPress={() => onUpdate({ ...holeData, gir: holeData.gir === val ? null : val })} style={[s.toggleBtn, { flex: 1 }, holeData.gir === val && (val === "yes" ? s.toggleBtnGreen : s.toggleBtnRed)]}>
                <Text style={[s.toggleBtnTxt, holeData.gir === val && { color: "#fff" }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={s.holeCard}>
          <Text style={s.cardLabel}>BUNKER</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            {[["no", "✓ Non"], ["yes", "✗ Oui"]].map(([val, label]) => (
              <TouchableOpacity key={val} onPress={() => onUpdate({ ...holeData, bunker: holeData.bunker === val ? null : val })} style={[s.toggleBtn, { flex: 1 }, holeData.bunker === val && (val === "no" ? s.toggleBtnGreen : s.toggleBtnRed)]}>
                <Text style={[s.toggleBtnTxt, holeData.bunker === val && { color: "#fff" }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={s.saveBtn} onPress={isLast ? onFinish : onNext}>
          <Text style={s.saveBtnTxt}>{isLast ? "Finish round ✓" : "Next hole →"}</Text>
        </TouchableOpacity>
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  )
}

function StatsView({ rounds }) {
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
      <Text style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center' }}>Ajoute au moins 2 rounds pour voir tes stats</Text>
    </View>
  )

  const scores = filtered.map(r => r.score).filter(Boolean)
  const best = scores.length ? Math.min(...scores) : 0
  const avgScore = avg(scores)
  const avgPutts = avg(filtered.map(r => r.putts).filter(Boolean))
  const avgGir = avg(filtered.map(r => r.gir).filter(Boolean))
  const avgFw = avg(filtered.map(r => r.fairways_hit).filter(Boolean))

  // Trend
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

  // Score distribution from holes_data
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

  // Chart data
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
          <TouchableOpacity key={p} onPress={() => setPeriod(p)} style={{ flex: 1, paddingVertical: 7, alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: period === p ? G : "#E5E7EB", backgroundColor: period === p ? G : "#fff" }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: period === p ? "#fff" : "#6B7280" }}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Key stats */}
      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
        {[
          { label: "MEILLEUR", value: best || "—", color: G },
          { label: "MOYENNE", value: avgScore || "—", color: "#1a1a1a", trend },
          { label: "PUTTS MOY.", value: avgPutts || "—", color: "#1a1a1a" },
          { label: "ROUNDS", value: filtered.length, color: "#1a1a1a" },
        ].map((stat, i) => (
          <View key={i} style={[s.statCard, i === 0 && { borderTopWidth: 3, borderTopColor: G }]}>
            <Text style={[s.statCardValue, { color: stat.color }]}>{stat.value}</Text>
            {stat.trend !== undefined && stat.trend !== 0 && (
              <Text style={{ fontSize: 10, fontWeight: "700", color: stat.trend < 0 ? G : "#EF4444" }}>
                {stat.trend < 0 ? "↓ " + Math.abs(stat.trend) : "↑ +" + stat.trend}
              </Text>
            )}
            <Text style={s.statCardLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Score chart */}
      {pts.length >= 2 && (
        <View style={s.chartSection}>
          <Text style={s.chartTitle}>Évolution du score</Text>
          <Svg width={W} height={H}>
            <Defs>
              <LinearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={G} stopOpacity="0.2" />
                <Stop offset="1" stopColor={G} stopOpacity="0.02" />
              </LinearGradient>
            </Defs>
            <Line x1={padL} y1={padT} x2={padL} y2={padT + chartH} stroke="#E5E7EB" strokeWidth="1" />
            <Line x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH} stroke="#E5E7EB" strokeWidth="1" />
            <SvgText x={padL - 4} y={padT + 4} fontSize="9" fill="#9CA3AF" textAnchor="end">{maxS}</SvgText>
            <SvgText x={padL - 4} y={padT + chartH} fontSize="9" fill="#9CA3AF" textAnchor="end">{minS}</SvgText>
            <Path d={areaPath} fill="url(#scoreGrad)" />
            <Path d={linePath} stroke={G} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {pts.map((p, i) => (
              <Circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 5 : 3} fill={i === pts.length - 1 ? G : "#86EFAC"} stroke="white" strokeWidth="1.5" />
            ))}
            <SvgText x={pts[0]?.x} y={H} fontSize="9" fill="#9CA3AF" textAnchor="start">{pts[0]?.date}</SvgText>
            <SvgText x={pts[pts.length-1]?.x} y={H} fontSize="9" fill="#9CA3AF" textAnchor="end">{pts[pts.length-1]?.date}</SvgText>
          </Svg>
        </View>
      )}

      {/* Score distribution */}
      {totalHoles > 0 && (
        <View style={s.chartSection}>
          <Text style={s.chartTitle}>Répartition des scores</Text>
          <View style={{ flexDirection: "row", gap: 4, marginTop: 12, height: 60, alignItems: "flex-end" }}>
            {[
              { label: "Eagle", count: scoreDist.eagle, color: "#7C3AED" },
              { label: "Birdie", count: scoreDist.birdie, color: G },
              { label: "Par", count: scoreDist.par, color: "#0891B2" },
              { label: "Bogey", count: scoreDist.bogey, color: "#F59E0B" },
              { label: "Dbl", count: scoreDist.double, color: "#EF4444" },
              { label: "+3", count: scoreDist.worse, color: "#DC2626" },
            ].map((item, i) => {
              const maxCount = Math.max(scoreDist.eagle, scoreDist.birdie, scoreDist.par, scoreDist.bogey, scoreDist.double, scoreDist.worse, 1)
              const h = Math.max((item.count / maxCount) * 44, item.count > 0 ? 4 : 0)
              return (
                <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
                  {item.count > 0 && <Text style={{ fontSize: 10, color: item.color, fontWeight: "700", marginBottom: 2 }}>{item.count}</Text>}
                  <View style={{ width: "80%", height: h, backgroundColor: item.color, borderRadius: 4, opacity: item.count > 0 ? 1 : 0.15 }} />
                  <Text style={{ fontSize: 9, color: "#9CA3AF", marginTop: 4 }}>{item.label}</Text>
                </View>
              )
            })}
          </View>
        </View>
      )}

      {/* Detailed stats */}
      <View style={s.chartSection}>
        <Text style={s.chartTitle}>Statistiques détaillées</Text>
        {[
          { label: "Putts moyens", value: avgPutts, target: 30, unit: "putts", lower: true },
          { label: "GIR moyen", value: avgGir, target: 12, unit: "/18", lower: false },
          { label: "Fairways touchés", value: avgFw, target: 10, unit: "/14", lower: false },
        ].map((stat, i) => {
          const val = stat.value || 0
          const pct = val ? Math.min((stat.lower ? stat.target / val : val / stat.target) * 100, 100) : 0
          const color = val ? (stat.lower ? (val <= stat.target ? G : "#EF4444") : (val >= stat.target ? G : "#F59E0B")) : "#E5E7EB"
          return (
            <View key={i} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                <Text style={{ fontSize: 13, color: "#374151", fontWeight: "500" }}>{stat.label}</Text>
                <Text style={{ fontSize: 13, fontWeight: "800", color: val ? color : "#9CA3AF" }}>{val || "—"}{val ? " " + stat.unit : ""}</Text>
              </View>
              <View style={{ height: 8, backgroundColor: "#F0F4F0", borderRadius: 4 }}>
                <View style={{ height: 8, width: pct + "%", backgroundColor: color, borderRadius: 4 }} />
              </View>
              <Text style={{ fontSize: 10, color: "#9CA3AF", marginTop: 3 }}>Objectif: {stat.target} {stat.unit}</Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

export default function PlayerRoundsScreen({ navigation }) {
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
    Alert.alert('Supprimer ce round ?', 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
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
    Alert.alert("Round saved! 🏌️", "Score: " + totalScore + " | Putts: " + totalPutts)
    setScreen("list")
    fetchRounds()
  }

  if (screen === "choose") return (
    <SafeAreaView style={s.safe}>
      <View style={s.modalHead}>
        <TouchableOpacity onPress={() => setScreen("list")}><Text style={s.backTxt}>‹ Back</Text></TouchableOpacity>
        <Text style={s.modalTitle}>New round</Text>
        <View style={{ width: 50 }} />
      </View>
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 14, color: "#6B7280", textAlign: "center", marginBottom: 20 }}>Choisis ton mode de saisie</Text>
        <TouchableOpacity style={s.modeCard} onPress={() => setScreen("quick")}>
          <Text style={s.modeIcon}>⚡</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.modeTitle}>Quick mode</Text>
            <Text style={s.modeSub}>Score total + parcours — 30 secondes</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={[s.modeCard, s.modeCardActive]} onPress={() => setScreen("detailedSetup")}>
          <Ionicons name="stats-chart-outline" size={20} color={G} />
          <View style={{ flex: 1 }}>
            <Text style={[s.modeTitle, { color: G }]}>Detailed mode</Text>
            <Text style={s.modeSub}>Hole par trou — Par, coups, putts, fairway, GIR</Text>
          </View>
          <View style={s.recommendedBadge}><Text style={s.recommendedTxt}>RECOMMANDÉ</Text></View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )

  if (screen === "quick") return <SafeAreaView style={s.safe}><QuickModeScreen onSave={() => { setScreen("list"); fetchRounds() }} onBack={() => setScreen("choose")} /></SafeAreaView>
  if (screen === "detailedSetup") return <SafeAreaView style={s.safe}><DetailedSetupScreen onStart={(config) => { setRoundConfig(config); setCurrentHole(1); setHolesData({}); setScreen("detailed") }} onBack={() => setScreen("choose")} /></SafeAreaView>
  if (screen === "detailed" && roundConfig) return (
    <SafeAreaView style={[s.safe, { backgroundColor: G }]}>
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
      />
    </SafeAreaView>
  )

  if (loading) return <View style={s.loading}><ActivityIndicator color={G} size="large" /></View>

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>My rounds</Text>
          <Text style={s.sub}>{rounds.length} rounds played</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => setScreen("choose")}>
          <Text style={s.addBtnTxt}>+ Round</Text>
        </TouchableOpacity>
      </View>

      <View style={s.tabs}>
        {['rounds', 'stats'].map(t => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name={t === 'rounds' ? 'flag-outline' : 'stats-chart-outline'} size={14} color={tab === t ? G : '#9CA3AF'} /><Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>{t === 'rounds' ? 'Rounds' : 'Stats'}</Text></View>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRounds() }} tintColor={G} />}>
        {tab === 'stats' ? (
          <StatsView rounds={rounds} />
        ) : (
          <>
            {rounds.length === 0 ? (
              <View style={{ padding: 40, alignItems: "center" }}>
                <Ionicons name="flag-outline" size={40} color={G} style={{ marginBottom: 16 }} />
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#1a1a1a", marginBottom: 16 }}>No rounds yet</Text>
                <TouchableOpacity style={s.addBtn} onPress={() => setScreen("choose")}>
                  <Text style={s.addBtnTxt}>+ Add your first round</Text>
                </TouchableOpacity>
              </View>
            ) : rounds.map(r => (
              <View key={r.id} style={s.roundCard}>
                <View style={s.roundCardTop}>
                  <View style={s.roundInfo}>
                    <Text style={s.roundCourse}>{r.course_name || "Golf course"}</Text>
                    <Text style={s.roundDate}>{r.played_at}</Text>
                  </View>
                  <Text style={s.roundScore}>{r.score}</Text>
                  <TouchableOpacity onPress={() => deleteRound(r.id)} style={{ marginLeft: 12, padding: 6, backgroundColor: '#FEF2F2', borderRadius: 8 }}>
                    <Text style={{ fontSize: 13, color: '#DC2626', fontWeight: '700' }}>✕</Text>
                  </TouchableOpacity>
                </View>
                {(r.putts || r.gir) ? (
                  <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                    {r.putts ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><Ionicons name="flag-outline" size={12} color="#9CA3AF" /><Text style={s.roundStat}>{r.putts} putts</Text></View> : null}
                    {r.gir ? <Text style={s.roundStat}>🎯 {r.gir} GIR</Text> : null}
                    {r.fairways_hit ? <Text style={s.roundStat}>🏹 {r.fairways_hit} FW</Text> : null}
                  </View>
                ) : null}

              </View>
            ))}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8f8f8" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { backgroundColor: "#fff", padding: 16, paddingTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  title: { fontSize: 22, fontWeight: "800", color: "#1a1a1a", letterSpacing: -0.5 },
  sub: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  scroll: { flex: 1 },
  tabs: { flexDirection: "row", backgroundColor: "#fff", padding: 4, margin: 16, marginBottom: 8, borderRadius: 12, borderWidth: 0.5, borderColor: "#E5E7EB" },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10 },
  tabActive: { backgroundColor: G },
  tabTxt: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  tabTxtActive: { color: "#fff" },
  addBtn: { backgroundColor: G, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  addBtnTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },
  roundCard: { backgroundColor: "#fff", borderRadius: 12, margin: 16, marginBottom: 8, padding: 14, borderWidth: 0.5, borderColor: "#E5E7EB", position: 'relative' },
  roundCardTop: { flexDirection: "row", alignItems: "center" },
  roundInfo: { flex: 1 },
  roundCourse: { fontSize: 14, fontWeight: "600", color: "#1a1a1a" },
  roundDate: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  roundScore: { fontSize: 28, fontWeight: "800", color: G },
  roundStat: { fontSize: 12, color: "#6B7280" },
  statCard: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 10, alignItems: "center", borderWidth: 0.5, borderColor: "#E5E7EB" },
  statCardValue: { fontSize: 20, fontWeight: "800" },
  statCardLabel: { fontSize: 9, color: "#9CA3AF", fontWeight: "600", marginTop: 3 },
  chartSection: { backgroundColor: "#fff", margin: 16, marginTop: 0, marginBottom: 8, borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: "#E5E7EB" },
  chartTitle: { fontSize: 13, fontWeight: "700", color: "#1a1a1a", marginBottom: 8 },
  modalHead: { backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#1a1a1a" },
  backTxt: { fontSize: 16, color: G, fontWeight: "600" },
  label: { fontSize: 11, fontWeight: "600", color: "#6B7280", marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: "#F8FAF8", borderWidth: 1, borderColor: "#E0E5E0", borderRadius: 12, padding: 14, fontSize: 15, color: "#1a1a1a" },
  saveBtn: { backgroundColor: G, borderRadius: 14, padding: 16, alignItems: "center", marginTop: 24 },
  saveBtnTxt: { color: "#fff", fontSize: 16, fontWeight: "700" },
  modeCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  modeCardActive: { borderColor: G, borderWidth: 2 },
  modeIcon: { fontSize: 28 },
  modeTitle: { fontSize: 16, fontWeight: "700", color: "#1a1a1a" },
  modeSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  recommendedBadge: { backgroundColor: G, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  recommendedTxt: { fontSize: 9, fontWeight: "700", color: "#fff" },
  holeHeader: { backgroundColor: G, padding: 16, paddingTop: 8 },
  holeTitle: { fontSize: 22, fontWeight: "800", color: "#fff" },
  progressBar: { flexDirection: "row", gap: 3 },
  progressDot: { flex: 1, height: 3, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 2 },
  progressDotDone: { backgroundColor: "rgba(255,255,255,0.6)" },
  progressDotCurrent: { backgroundColor: "#fff" },
  holeCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: "#E5E7EB" },
  cardLabel: { fontSize: 11, fontWeight: "600", color: "#9CA3AF" },
  counter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  counterBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center", justifyContent: "center" },
  counterBtnGreen: { backgroundColor: G, borderColor: G },
  counterBtnTxt: { fontSize: 24, color: "#374151", lineHeight: 28 },
  counterValue: { fontSize: 40, fontWeight: "800", color: "#1a1a1a" },
  scoreLabel: { fontSize: 13, fontWeight: "700", marginTop: 2 },
  parBtn: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center" },
  parBtnActive: { backgroundColor: G, borderColor: G },
  parBtnTxt: { fontSize: 13, fontWeight: "600", color: "#374151" },
  parBtnTxtActive: { color: "#fff" },
  toggleBtn: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center" },
  toggleBtnGreen: { backgroundColor: G, borderColor: G },
  toggleBtnRed: { backgroundColor: "#EF4444", borderColor: "#EF4444" },
  toggleBtnTxt: { fontSize: 13, fontWeight: "600", color: "#374151" },
  holeBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center" },
  holeBtnActive: { backgroundColor: G, borderColor: G },
  holeBtnTxt: { fontSize: 15, fontWeight: "600", color: "#374151" },
  holeBtnTxtActive: { color: "#fff" },
})
