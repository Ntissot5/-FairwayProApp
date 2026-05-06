// Shared state for passing video annotation data between screens
// without triggering navigation remounts
let _pendingVideo = null

export function setPendingVideo(data) {
  _pendingVideo = data
}

export function consumePendingVideo() {
  const data = _pendingVideo
  _pendingVideo = null
  return data
}
