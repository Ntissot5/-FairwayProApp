import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useVideoPlayer, VideoView } from 'expo-video'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import Svg, { Line, Circle } from 'react-native-svg'
import { colors } from './theme'

const TOLERANCE_MS = 100
const { width: SCREEN_W } = Dimensions.get('window')

export default function PlayerVideoReplayScreen({ route, navigation }) {
  const { t } = useTranslation()
  const { video } = route.params || {}
  const { videoUrl, annotations = [], duration_ms = 0 } = video || {}

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTimeMs, setCurrentTimeMs] = useState(0)
  const [durationMs, setDurationMs] = useState(duration_ms)
  const [videoLayout, setVideoLayout] = useState({ width: SCREEN_W, height: SCREEN_W * 16 / 9 })
  const [videoError, setVideoError] = useState(false)

  const player = useVideoPlayer(videoUrl, p => {
    p.loop = false
    p.muted = false
  })

  useEffect(() => {
    if (!player) return
    const sub = player.addListener('playingChange', ({ isPlaying: playing }) => {
      setIsPlaying(playing)
    })
    const sub2 = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'readyToPlay' && player.duration) {
        setDurationMs(Math.round(player.duration * 1000))
      }
      if (status === 'error' || error) {
        setVideoError(true)
      }
    })
    return () => { sub.remove(); sub2.remove() }
  }, [player])

  useEffect(() => {
    if (!player) return
    const interval = setInterval(() => {
      if (player.currentTime != null) {
        setCurrentTimeMs(Math.round(player.currentTime * 1000))
      }
    }, 50)
    return () => clearInterval(interval)
  }, [player])

  useEffect(() => {
    if (player && !videoError) {
      setTimeout(() => player.play(), 500)
    }
  }, [player, videoError])

  const togglePlay = () => {
    if (isPlaying) player.pause()
    else player.play()
  }

  const seekTo = (ms) => {
    const clamped = Math.max(0, Math.min(durationMs, ms))
    player.currentTime = clamped / 1000
    setCurrentTimeMs(clamped)
  }

  const visibleAnnotations = annotations.filter(a =>
    a.timestamp_ms <= currentTimeMs + TOLERANCE_MS
  )

  const formatMs = (ms) => (ms / 1000).toFixed(1) + 's'

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

  if (videoError || !videoUrl) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.errorContainer}>
          <Ionicons name="videocam-off-outline" size={48} color={colors.textTertiary} />
          <Text style={s.errorText}>{t('player_session_summary.video_expired')}</Text>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Text style={s.backBtnTxt}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={s.headerSafe}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBack}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
          <Text style={s.headerBackTxt}>{t('common.back')}</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Video + annotations overlay */}
      <View
        style={s.videoContainer}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout
          setVideoLayout({ width, height })
        }}
      >
        <VideoView player={player} style={s.video} contentFit="contain" nativeControls={false} />
        <View style={s.svgOverlay}>
          <Svg width={videoLayout.width} height={videoLayout.height}>
            {visibleAnnotations.map(renderAnnotation)}
          </Svg>
        </View>
      </View>

      {/* Scrubber */}
      <View style={s.scrubber}>
        <TouchableOpacity onPress={togglePlay} style={s.playBtn}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={s.sliderContainer}
          activeOpacity={1}
          onPress={(e) => {
            const ratio = e.nativeEvent.locationX / (SCREEN_W - 100)
            seekTo(ratio * durationMs)
          }}
        >
          <View style={s.sliderTrack}>
            <View style={[s.sliderFill, { width: durationMs > 0 ? `${(currentTimeMs / durationMs) * 100}%` : '0%' }]} />
          </View>
          {annotations.map(a => (
            <View key={a.id} style={[s.marker, { left: durationMs > 0 ? `${(a.timestamp_ms / durationMs) * 100}%` : '0%', backgroundColor: a.color }]} />
          ))}
        </TouchableOpacity>
        <Text style={s.timeLabel}>{formatMs(currentTimeMs)}</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  headerSafe: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 },
  headerBack: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 16 },
  headerBackTxt: { fontSize: 16, fontWeight: '600', color: colors.textInverse },
  videoContainer: { flex: 1, position: 'relative' },
  video: { flex: 1 },
  svgOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
  scrubber: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 40, backgroundColor: '#111' },
  playBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sliderContainer: { flex: 1, height: 30, justifyContent: 'center', position: 'relative' },
  sliderTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' },
  sliderFill: { height: 4, backgroundColor: colors.primary, borderRadius: 2 },
  marker: { position: 'absolute', width: 4, height: 12, borderRadius: 2, top: 9 },
  timeLabel: { fontSize: 12, color: colors.textTertiary, fontVariant: ['tabular-nums'], minWidth: 40, textAlign: 'right' },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  errorText: { fontSize: 16, color: colors.textTertiary, textAlign: 'center', lineHeight: 22 },
  backBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10, marginTop: 8 },
  backBtnTxt: { color: colors.textInverse, fontSize: 14, fontWeight: '700' },
})
