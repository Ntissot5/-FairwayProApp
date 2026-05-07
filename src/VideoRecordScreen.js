import { useState, useRef, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { Ionicons } from '@expo/vector-icons'

const G = '#1B5E35'
const MAX_DURATION = 60

export default function VideoRecordScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions()
  const [facing, setFacing] = useState('back')
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const cameraRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!permission?.granted) requestPermission()
  }, [])

  useEffect(() => {
    if (recording && elapsed >= MAX_DURATION) {
      stopRecording()
    }
  }, [elapsed])

  const startRecording = async () => {
    if (!cameraRef.current) return
    setRecording(true)
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    try {
      const video = await cameraRef.current.recordAsync({ maxDuration: MAX_DURATION })
      // recordAsync resolves when recording stops
      if (video?.uri) {
        navigation.navigate('VideoAnnotation', { videoUri: video.uri })
      }
    } catch (e) {
      console.error('[VideoRecord] recordAsync failed:', e)
      setRecording(false)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false)
    cameraRef.current?.stopRecording()
  }

  const cancel = () => {
    if (recording) stopRecording()
    navigation.goBack()
  }

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  if (!permission?.granted) {
    return (
      <View style={s.permissionContainer}>
        <Ionicons name="videocam-off-outline" size={48} color="#9CA3AF" />
        <Text style={s.permissionText}>Permission caméra requise</Text>
        <TouchableOpacity style={s.permissionBtn} onPress={requestPermission}>
          <Text style={s.permissionBtnTxt}>Autoriser</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={s.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        facing={facing}
        mode="video"
      />
      {/* Top bar — sibling, not child of CameraView */}
      <View style={s.topBar} pointerEvents="box-none">
        <TouchableOpacity onPress={cancel} style={s.closeBtn}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        {recording && (
          <View style={s.timerBadge}>
            <View style={s.recDot} />
            <Text style={s.timerText}>{formatTimer(elapsed)}</Text>
          </View>
        )}
        <TouchableOpacity onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')} style={s.flipBtn} disabled={recording}>
          <Ionicons name="camera-reverse-outline" size={24} color={recording ? '#666' : '#fff'} />
        </TouchableOpacity>
      </View>
      {/* Bottom bar — sibling, not child of CameraView */}
      <View style={s.bottomBar} pointerEvents="box-none">
        <TouchableOpacity
          style={[s.recordBtn, recording && s.recordBtnActive]}
          onPress={recording ? stopRecording : startRecording}
        >
          {recording ? (
            <View style={s.stopSquare} />
          ) : (
            <View style={s.recordDot} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  permissionContainer: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', gap: 16 },
  permissionText: { fontSize: 16, color: '#9CA3AF', fontWeight: '500' },
  permissionBtn: { backgroundColor: G, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  permissionBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 20 },
  closeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  flipBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  timerBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  timerText: { fontSize: 16, fontWeight: '700', color: '#fff', fontVariant: ['tabular-nums'] },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, alignItems: 'center', paddingBottom: 50 },
  recordBtn: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  recordBtnActive: { borderColor: '#EF4444' },
  recordDot: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EF4444' },
  stopSquare: { width: 28, height: 28, borderRadius: 4, backgroundColor: '#EF4444' },
})
