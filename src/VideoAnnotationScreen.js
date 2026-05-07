import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, PanResponder, Dimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useVideoPlayer, VideoView } from 'expo-video'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Line, Circle } from 'react-native-svg'
import { setPendingVideo } from './videoResult'

const G = '#1B5E35'
const COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6']
const FPS = 30
const FRAME_MS = Math.round(1000 / FPS)
const TOLERANCE_MS = 100
const { width: SCREEN_W } = Dimensions.get('window')

export default function VideoAnnotationScreen({ route, navigation }) {
  const { videoUri } = route.params || {}

  const [annotations, setAnnotations] = useState([])
  const [selectedTool, setSelectedTool] = useState('line')
  const [selectedColor, setSelectedColor] = useState(COLORS[0])
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTimeMs, setCurrentTimeMs] = useState(0)
  const [durationMs, setDurationMs] = useState(0)
  const [drawStart, setDrawStart] = useState(null)
  const [drawCurrent, setDrawCurrent] = useState(null)
  const [videoLayout, setVideoLayout] = useState({ width: SCREEN_W, height: SCREEN_W * 16 / 9 })

  const player = useVideoPlayer(videoUri, p => {
    p.loop = false
    p.muted = false
  })

  // Track playback status
  useEffect(() => {
    if (!player) return
    const sub = player.addListener('playingChange', ({ isPlaying: playing }) => {
      setIsPlaying(playing)
    })
    const sub2 = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay' && player.duration) {
        setDurationMs(Math.round(player.duration * 1000))
      }
    })
    return () => { sub.remove(); sub2.remove() }
  }, [player])

  // Poll current time while playing
  useEffect(() => {
    if (!player) return
    const interval = setInterval(() => {
      if (player.currentTime != null) {
        setCurrentTimeMs(Math.round(player.currentTime * 1000))
      }
    }, 50)
    return () => clearInterval(interval)
  }, [player])

  const togglePlay = () => {
    if (isPlaying) {
      player.pause()
    } else {
      player.play()
    }
  }

  const seekFrame = (delta) => {
    const newMs = Math.max(0, Math.min(durationMs, currentTimeMs + delta * FRAME_MS))
    player.currentTime = newMs / 1000
    setCurrentTimeMs(newMs)
  }

  const seekTo = (ms) => {
    const clamped = Math.max(0, Math.min(durationMs, ms))
    player.currentTime = clamped / 1000
    setCurrentTimeMs(clamped)
  }

  // Visible annotations at current time
  const visibleAnnotations = annotations.filter(a =>
    a.timestamp_ms <= currentTimeMs + TOLERANCE_MS
  )

  // Refs for values needed inside PanResponder (avoids stale closures)
  const toolRef = useRef(selectedTool)
  const colorRef = useRef(selectedColor)
  const timeRef = useRef(currentTimeMs)
  const layoutRef = useRef(videoLayout)
  const playingRef = useRef(isPlaying)
  const drawStartRef = useRef(null)
  useEffect(() => { toolRef.current = selectedTool }, [selectedTool])
  useEffect(() => { colorRef.current = selectedColor }, [selectedColor])
  useEffect(() => { timeRef.current = currentTimeMs }, [currentTimeMs])
  useEffect(() => { layoutRef.current = videoLayout }, [videoLayout])
  useEffect(() => { playingRef.current = isPlaying }, [isPlaying])

  // Drawing via PanResponder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !playingRef.current,
      onMoveShouldSetPanResponder: () => !playingRef.current,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent
        drawStartRef.current = { x: locationX, y: locationY }
        setDrawStart({ x: locationX, y: locationY })
        setDrawCurrent({ x: locationX, y: locationY })
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent
        setDrawCurrent({ x: locationX, y: locationY })
      },
      onPanResponderRelease: (e) => {
        const { locationX, locationY } = e.nativeEvent
        const start = drawStartRef.current
        if (!start) return

        const layout = layoutRef.current
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
        const newAnnotation = {
          id,
          type: toolRef.current,
          color: colorRef.current,
          timestamp_ms: timeRef.current,
          start: { x: start.x / layout.width, y: start.y / layout.height },
          end: { x: locationX / layout.width, y: locationY / layout.height },
        }
        setAnnotations(prev => [...prev, newAnnotation])
        drawStartRef.current = null
        setDrawStart(null)
        setDrawCurrent(null)
      },
    })
  ).current

  const deleteLastAnnotation = () => {
    const visible = annotations.filter(a => Math.abs(a.timestamp_ms - currentTimeMs) <= TOLERANCE_MS)
    if (visible.length === 0) return
    const lastId = visible[visible.length - 1].id
    setAnnotations(prev => prev.filter(a => a.id !== lastId))
  }

  const handleSave = () => {
    setPendingVideo({ videoUri, annotations, duration_ms: durationMs })
    navigation.pop(2)
  }

  const handleCancel = () => {
    Alert.alert('Supprimer cette vidéo ?', '', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => navigation.goBack() },
    ])
  }

  const formatMs = (ms) => (ms / 1000).toFixed(2) + 's'

  const renderAnnotation = (a) => {
    const sx = a.start.x * videoLayout.width
    const sy = a.start.y * videoLayout.height
    const ex = a.end.x * videoLayout.width
    const ey = a.end.y * videoLayout.height

    if (a.type === 'line') {
      return <Line key={a.id} x1={sx} y1={sy} x2={ex} y2={ey} stroke={a.color} strokeWidth={3} strokeLinecap="round" />
    }
    if (a.type === 'circle') {
      const r = Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2)
      return <Circle key={a.id} cx={sx} cy={sy} r={r} stroke={a.color} strokeWidth={3} fill="none" />
    }
    return null
  }

  const renderLiveDrawing = () => {
    if (!drawStart || !drawCurrent) return null
    if (selectedTool === 'line') {
      return <Line x1={drawStart.x} y1={drawStart.y} x2={drawCurrent.x} y2={drawCurrent.y} stroke={selectedColor} strokeWidth={3} strokeLinecap="round" opacity={0.7} />
    }
    if (selectedTool === 'circle') {
      const r = Math.sqrt((drawCurrent.x - drawStart.x) ** 2 + (drawCurrent.y - drawStart.y) ** 2)
      return <Circle cx={drawStart.x} cy={drawStart.y} r={r} stroke={selectedColor} strokeWidth={3} fill="none" opacity={0.7} />
    }
    return null
  }

  return (
    <View style={s.container}>
      {/* Video + annotation overlay */}
      <View
        style={s.videoContainer}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout
          setVideoLayout({ width, height })
        }}
      >
        <VideoView
          player={player}
          style={s.video}
          contentFit="contain"
          nativeControls={false}
        />

        {/* SVG overlay for annotations */}
        <View style={s.svgOverlay} {...panResponder.panHandlers}>
          <Svg width={videoLayout.width} height={videoLayout.height}>
            {visibleAnnotations.map(renderAnnotation)}
            {renderLiveDrawing()}
          </Svg>
        </View>

        {/* Toolbar (right side) */}
        <View style={s.toolbar}>
          <TouchableOpacity style={[s.toolBtn, selectedTool === 'line' && s.toolBtnActive]} onPress={() => setSelectedTool('line')}>
            <Ionicons name="remove-outline" size={20} color={selectedTool === 'line' ? '#fff' : '#ccc'} />
          </TouchableOpacity>
          <TouchableOpacity style={[s.toolBtn, selectedTool === 'circle' && s.toolBtnActive]} onPress={() => setSelectedTool('circle')}>
            <Ionicons name="ellipse-outline" size={20} color={selectedTool === 'circle' ? '#fff' : '#ccc'} />
          </TouchableOpacity>
          <View style={s.toolDivider} />
          {COLORS.map(c => (
            <TouchableOpacity key={c} onPress={() => setSelectedColor(c)} style={[s.colorBtn, { backgroundColor: c }, selectedColor === c && s.colorBtnActive]} />
          ))}
          <View style={s.toolDivider} />
          <TouchableOpacity style={s.toolBtn} onPress={deleteLastAnnotation}>
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* Pause hint */}
        {isPlaying && (
          <View style={s.pauseHint}>
            <Text style={s.pauseHintTxt}>Pause pour annoter</Text>
          </View>
        )}
      </View>

      {/* Scrubber */}
      <View style={s.scrubber}>
        <TouchableOpacity onPress={togglePlay} style={s.playBtn}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => seekFrame(-1)} style={s.frameBtn}>
          <Ionicons name="play-back" size={14} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={s.sliderContainer}
          activeOpacity={1}
          onPress={(e) => {
            const ratio = e.nativeEvent.locationX / (SCREEN_W - 160)
            seekTo(ratio * durationMs)
          }}
        >
          <View style={s.sliderTrack}>
            <View style={[s.sliderFill, { width: durationMs > 0 ? `${(currentTimeMs / durationMs) * 100}%` : '0%' }]} />
          </View>
          {/* Annotation markers */}
          {annotations.map(a => (
            <View key={a.id} style={[s.marker, { left: durationMs > 0 ? `${(a.timestamp_ms / durationMs) * 100}%` : '0%', backgroundColor: a.color }]} />
          ))}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => seekFrame(1)} style={s.frameBtn}>
          <Ionicons name="play-forward" size={14} color="#fff" />
        </TouchableOpacity>
        <Text style={s.timeLabel}>{formatMs(currentTimeMs)}</Text>
      </View>

      {/* Footer */}
      <SafeAreaView edges={['bottom']} style={s.footer}>
        <TouchableOpacity style={s.cancelBtn} onPress={handleCancel}>
          <Text style={s.cancelBtnTxt}>Annuler</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
          <Text style={s.saveBtnTxt}>Enregistrer</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  videoContainer: { flex: 1, position: 'relative' },
  video: { flex: 1 },
  svgOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
  toolbar: { position: 'absolute', right: 12, top: 60, zIndex: 20, gap: 6, alignItems: 'center' },
  toolBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  toolBtnActive: { backgroundColor: 'rgba(255,255,255,0.3)', borderWidth: 2, borderColor: '#fff' },
  toolDivider: { width: 24, height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 2 },
  colorBtn: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  colorBtnActive: { borderColor: '#fff', transform: [{ scale: 1.2 }] },
  pauseHint: { position: 'absolute', bottom: 12, left: 0, right: 0, alignItems: 'center', zIndex: 15 },
  pauseHintTxt: { fontSize: 12, color: 'rgba(255,255,255,0.6)', backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
  scrubber: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#111' },
  playBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: G, alignItems: 'center', justifyContent: 'center' },
  frameBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  sliderContainer: { flex: 1, height: 30, justifyContent: 'center', position: 'relative' },
  sliderTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' },
  sliderFill: { height: 4, backgroundColor: G, borderRadius: 2 },
  marker: { position: 'absolute', width: 4, height: 12, borderRadius: 2, top: 9 },
  timeLabel: { fontSize: 11, color: '#9CA3AF', fontVariant: ['tabular-nums'], minWidth: 42, textAlign: 'right' },
  footer: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, backgroundColor: '#111' },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#333', alignItems: 'center' },
  cancelBtnTxt: { fontSize: 15, fontWeight: '600', color: '#9CA3AF' },
  saveBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: G, alignItems: 'center' },
  saveBtnTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
})
