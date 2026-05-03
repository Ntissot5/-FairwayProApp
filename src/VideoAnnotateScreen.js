import { useState, useRef, useCallback, useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Alert, PanResponder } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { VideoView, useVideoPlayer } from 'expo-video'
import { Svg, Path, Circle, Line } from 'react-native-svg'
import { captureRef } from 'react-native-view-shot'
import { supabase } from './supabase'
import { useTheme } from './ThemeContext'
import { useTranslation } from 'react-i18next'
import AnimatedPressable from './components/AnimatedPressable'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const VIDEO_H = SCREEN_W * (16 / 9) > SCREEN_H * 0.6 ? SCREEN_H * 0.6 : SCREEN_W * (16 / 9)

const DRAW_COLORS = ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#007AFF', '#FFFFFF']

export default function VideoAnnotateScreen({ route, navigation }) {
  const { videoUrl, player, coachId } = route.params
  const { colors } = useTheme()
  const { t } = useTranslation()
  const s = useMemo(() => makeStyles(colors), [colors])

  const TOOLS = [
    { id: 'pen', icon: 'pencil', name: t('videoAnnotate.draw') },
    { id: 'line', icon: 'remove-outline', name: t('videoAnnotate.line') },
    { id: 'circle', icon: 'ellipse-outline', name: t('videoAnnotate.circle') },
    { id: 'angle', icon: 'analytics-outline', name: t('videoAnnotate.angle') },
  ]

  const [paused, setPaused] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [paths, setPaths] = useState([])
  const [currentPath, setCurrentPath] = useState('')
  const [tool, setTool] = useState('pen')
  const [color, setColor] = useState('#FF3B30')
  const [strokeWidth, setStrokeWidth] = useState(3)
  const [saving, setSaving] = useState(false)
  const [shapes, setShapes] = useState([])
  const [dragStart, setDragStart] = useState(null)
  const [dragEnd, setDragEnd] = useState(null)
  const [anglePoints, setAnglePoints] = useState([])
  const canvasRef = useRef(null)
  const videoRef = useRef(null)

  const videoPlayer = useVideoPlayer(videoUrl, p => {
    p.loop = true
    p.play()
  })

  const togglePause = () => {
    if (paused) {
      videoPlayer.play()
      setPaused(false)
      setDrawing(false)
    } else {
      videoPlayer.pause()
      setPaused(true)
      setDrawing(true)
    }
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => drawing,
      onMoveShouldSetPanResponder: () => drawing,
      onPanResponderGrant: (e) => {
        if (!drawing) return
        const { locationX, locationY } = e.nativeEvent
        if (tool === 'pen') {
          setCurrentPath(`M${locationX.toFixed(1)},${locationY.toFixed(1)}`)
        } else if (tool === 'line' || tool === 'circle') {
          setDragStart({ x: locationX, y: locationY })
          setDragEnd({ x: locationX, y: locationY })
        } else if (tool === 'angle') {
          setAnglePoints(prev => {
            const pts = [...prev, { x: locationX, y: locationY }]
            if (pts.length >= 3) {
              setShapes(ss => [
                ...ss,
                { type: 'line', x1: pts[1].x, y1: pts[1].y, x2: pts[0].x, y2: pts[0].y, color, strokeWidth },
                { type: 'line', x1: pts[1].x, y1: pts[1].y, x2: pts[2].x, y2: pts[2].y, color, strokeWidth },
              ])
              return []
            }
            return pts
          })
        }
      },
      onPanResponderMove: (e) => {
        if (!drawing) return
        const { locationX, locationY } = e.nativeEvent
        if (tool === 'pen') {
          setCurrentPath(prev => prev + ` L${locationX.toFixed(1)},${locationY.toFixed(1)}`)
        } else if (tool === 'line' || tool === 'circle') {
          setDragEnd({ x: locationX, y: locationY })
        }
      },
      onPanResponderRelease: () => {
        if (!drawing) return
        if (tool === 'pen' && currentPath) {
          setPaths(prev => [...prev, { d: currentPath, color, strokeWidth }])
          setCurrentPath('')
        } else if (tool === 'line' && dragStart && dragEnd) {
          setShapes(prev => [...prev, { type: 'line', x1: dragStart.x, y1: dragStart.y, x2: dragEnd.x, y2: dragEnd.y, color, strokeWidth }])
          setDragStart(null)
          setDragEnd(null)
        } else if (tool === 'circle' && dragStart && dragEnd) {
          const cx = (dragStart.x + dragEnd.x) / 2
          const cy = (dragStart.y + dragEnd.y) / 2
          const r = Math.sqrt(Math.pow(dragEnd.x - dragStart.x, 2) + Math.pow(dragEnd.y - dragStart.y, 2)) / 2
          setShapes(prev => [...prev, { type: 'circle', cx, cy, r, color, strokeWidth }])
          setDragStart(null)
          setDragEnd(null)
        }
      },
    })
  ).current

  const undo = () => {
    if (shapes.length > 0) {
      setShapes(prev => prev.slice(0, -1))
    } else if (paths.length > 0) {
      setPaths(prev => prev.slice(0, -1))
    }
  }

  const clearAll = () => {
    setPaths([])
    setShapes([])
    setCurrentPath('')
    setAnglePoints([])
  }

  const saveAndSend = async () => {
    if (paths.length === 0 && shapes.length === 0) {
      Alert.alert(t('videoAnnotate.drawFirst'), t('videoAnnotate.pauseAndAnnotate'))
      return
    }
    setSaving(true)
    try {
      const uri = await captureRef(canvasRef, { format: 'png', quality: 0.9 })
      const fileName = 'annotation_' + player.id + '_' + Date.now() + '.png'
      const response = await fetch(uri)
      const blob = await response.blob()
      const { error } = await supabase.storage.from('swing-videos').upload(fileName, blob, { contentType: 'image/png' })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('swing-videos').getPublicUrl(fileName)
      await supabase.from('swing_videos').insert({
        player_id: player.id,
        coach_id: coachId,
        video_url: publicUrl,
        title: 'Swing Analysis ' + new Date().toLocaleDateString('fr-FR'),
      })
      await supabase.from('messages').insert({
        coach_id: coachId,
        player_id: player.id,
        sender: 'coach',
        content: t('videoAnnotate.analysisMsg'),
      })
      Alert.alert('Sent!', t('videoAnnotate.annotationSent', { name: player.full_name }))
      navigation.goBack()
    } catch (e) {
      Alert.alert(t('common.error'), e.message)
    }
    setSaving(false)
  }

  const hasAnnotations = paths.length > 0 || shapes.length > 0

  return (
    <View style={s.container}>
      <SafeAreaView style={s.safe}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBtn}>
            <Text style={s.headerBtnTxt}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>{player.full_name}</Text>
          <AnimatedPressable
            onPress={saveAndSend}
            disabled={saving || !hasAnnotations}
            style={[s.sendBtn, (!hasAnnotations || saving) && { opacity: 0.4 }]}
          >
            <Text style={s.sendBtnTxt}>{saving ? '...' : t('common.send')}</Text>
          </AnimatedPressable>
        </View>

        {/* Video + Canvas */}
        <View style={s.videoWrap} ref={canvasRef} collapsable={false}>
          <VideoView
            ref={videoRef}
            player={videoPlayer}
            style={s.video}
            contentFit="contain"
            nativeControls={false}
          />

          {/* Drawing overlay */}
          {drawing && (
            <View style={s.canvasOverlay} {...panResponder.panHandlers}>
              <Svg style={StyleSheet.absoluteFill}>
                {paths.map((p, i) => (
                  <Path key={'p' + i} d={p.d} stroke={p.color} strokeWidth={p.strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                ))}
                {currentPath ? <Path d={currentPath} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
                {shapes.map((sh, i) => {
                  if (sh.type === 'line') return <Line key={'s' + i} x1={sh.x1} y1={sh.y1} x2={sh.x2} y2={sh.y2} stroke={sh.color} strokeWidth={sh.strokeWidth} strokeLinecap="round" />
                  if (sh.type === 'circle') return <Circle key={'s' + i} cx={sh.cx} cy={sh.cy} r={sh.r} stroke={sh.color} strokeWidth={sh.strokeWidth} fill="none" />
                  return null
                })}
                {dragStart && dragEnd && tool === 'line' && (
                  <Line x1={dragStart.x} y1={dragStart.y} x2={dragEnd.x} y2={dragEnd.y} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray="6,4" />
                )}
                {dragStart && dragEnd && tool === 'circle' && (
                  <Circle
                    cx={(dragStart.x + dragEnd.x) / 2}
                    cy={(dragStart.y + dragEnd.y) / 2}
                    r={Math.sqrt(Math.pow(dragEnd.x - dragStart.x, 2) + Math.pow(dragEnd.y - dragStart.y, 2)) / 2}
                    stroke={color} strokeWidth={strokeWidth} fill="none" strokeDasharray="6,4"
                  />
                )}
                {anglePoints.map((pt, i) => (
                  <Circle key={'a' + i} cx={pt.x} cy={pt.y} r={5} fill={color} />
                ))}
              </Svg>
            </View>
          )}

          {/* Pause indicator */}
          {!paused && (
            <TouchableOpacity style={s.pauseOverlay} onPress={togglePause} activeOpacity={0.8}>
              <View style={s.pauseHint}>
                <Text style={s.pauseHintTxt}>{t('videoAnnotate.tapToPause')}</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Controls */}
        <View style={s.controls}>
          {/* Play/Pause */}
          <View style={s.controlRow}>
            <AnimatedPressable style={[s.playBtn, paused && s.playBtnActive]} onPress={togglePause}>
              <Ionicons name={paused ? 'play' : 'pause'} size={14} color="#fff" />
              <Text style={s.playBtnTxt}>{paused ? ' ' + t('videoAnnotate.play') : ' ' + t('videoAnnotate.pause')}</Text>
            </AnimatedPressable>
            {paused && (
              <>
                <TouchableOpacity style={s.undoBtn} onPress={undo}>
                  <Ionicons name="arrow-undo" size={14} color="#fff" />
                  <Text style={s.undoBtnTxt}> {t('videoAnnotate.undo')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.undoBtn} onPress={clearAll}>
                  <Text style={[s.undoBtnTxt, { color: '#FF3B30' }]}>{t('videoAnnotate.clear')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Tools */}
          {paused && (
            <View style={s.toolsRow}>
              {TOOLS.map(tl => (
                <TouchableOpacity
                  key={tl.id}
                  style={[s.toolBtn, tool === tl.id && s.toolBtnActive]}
                  onPress={() => setTool(tl.id)}
                >
                  <Ionicons name={tl.icon} size={20} color={tool === tl.id ? '#fff' : '#8E8E93'} />
                  <Text style={[s.toolName, tool === tl.id && { color: '#fff' }]}>{tl.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Colors */}
          {paused && (
            <View style={s.colorsRow}>
              {DRAW_COLORS.map(dc => (
                <TouchableOpacity
                  key={dc}
                  style={[s.colorBtn, { backgroundColor: dc }, color === dc && s.colorBtnActive]}
                  onPress={() => setColor(dc)}
                />
              ))}
              {/* Stroke width */}
              <View style={s.widthPicker}>
                {[2, 3, 5].map(w => (
                  <TouchableOpacity
                    key={w}
                    style={[s.widthBtn, strokeWidth === w && s.widthBtnActive]}
                    onPress={() => setStrokeWidth(w)}
                  >
                    <View style={[s.widthDot, { width: w * 3, height: w * 3, borderRadius: w * 1.5, backgroundColor: strokeWidth === w ? '#fff' : '#8E8E93' }]} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Angle helper text */}
          {paused && tool === 'angle' && (
            <Text style={s.helperTxt}>
              {t('videoAnnotate.tapPoints')}{anglePoints.length}/3 — {anglePoints.length === 0 ? t('videoAnnotate.firstArm') : anglePoints.length === 1 ? t('videoAnnotate.vertex') : t('videoAnnotate.secondArm')}
            </Text>
          )}
        </View>
      </SafeAreaView>
    </View>
  )
}

const makeStyles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  headerBtn: { padding: 8 },
  headerBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '500' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  sendBtn: { backgroundColor: c.primary, borderRadius: 18, paddingHorizontal: 20, paddingVertical: 8 },
  sendBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '600' },
  videoWrap: { flex: 1, backgroundColor: '#000', position: 'relative' },
  video: { flex: 1 },
  canvasOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
  pauseOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 5, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 20 },
  pauseHint: { backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 },
  pauseHintTxt: { color: '#fff', fontSize: 14, fontWeight: '500' },
  controls: { paddingHorizontal: 16, paddingBottom: 10 },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  playBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' },
  playBtnActive: { backgroundColor: c.primary },
  playBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '600' },
  undoBtn: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center' },
  undoBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '500' },
  toolsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  toolBtn: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingVertical: 10, gap: 4 },
  toolBtnActive: { backgroundColor: c.primary },
  toolName: { fontSize: 10, color: '#8E8E93', fontWeight: '600' },
  colorsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  colorBtn: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  colorBtnActive: { borderColor: '#fff', transform: [{ scale: 1.15 }] },
  widthPicker: { flexDirection: 'row', gap: 8, marginLeft: 'auto', alignItems: 'center' },
  widthBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  widthBtnActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  widthDot: { backgroundColor: '#8E8E93' },
  helperTxt: { color: '#8E8E93', fontSize: 12, textAlign: 'center', marginTop: 4 },
})
