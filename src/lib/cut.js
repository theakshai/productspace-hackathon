// F12: cut a clip out of an uploaded video/audio file, right in the browser.
// Plays the segment once in a hidden element and records it (video + audio), so it takes
// as long as the clip. Audio is routed through Web Audio, so nothing plays out loud.

function pickMime(isVideo) {
  const options = isVideo
    ? ['video/mp4;codecs=avc1,mp4a', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  return options.find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || ''
}

export const canCut = () => typeof window !== 'undefined' && 'MediaRecorder' in window

export async function cutClip({ src, isVideo, start, end, onProgress }) {
  const el = document.createElement(isVideo ? 'video' : 'audio')
  el.src = src
  el.preload = 'auto'
  el.playsInline = true
  el.crossOrigin = 'anonymous'
  await new Promise((res, rej) => {
    el.onloadedmetadata = res
    el.onerror = () => rej(new Error('Could not open the file for cutting.'))
  })

  const ctx = new AudioContext()
  const dest = ctx.createMediaStreamDestination()
  ctx.createMediaElementSource(el).connect(dest)
  const tracks = [...dest.stream.getAudioTracks()]
  if (isVideo) {
    const vs = (el.captureStream || el.mozCaptureStream).call(el)
    tracks.push(...vs.getVideoTracks())
  }

  el.currentTime = start
  await new Promise((res) => (el.onseeked = res))

  const mimeType = pickMime(isVideo)
  const rec = new MediaRecorder(new MediaStream(tracks), mimeType ? { mimeType } : undefined)
  const chunks = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const done = new Promise((res) => (rec.onstop = res))

  rec.start(500)
  await el.play()
  await new Promise((res) => {
    el.ontimeupdate = () => {
      onProgress?.(Math.min(1, (el.currentTime - start) / (end - start)))
      if (el.currentTime >= end) res()
    }
    el.onended = res
  })
  el.pause()
  rec.stop()
  await done
  ctx.close()
  const type = rec.mimeType || mimeType || (isVideo ? 'video/webm' : 'audio/webm')
  return { blob: new Blob(chunks, { type }), ext: type.includes('mp4') ? (isVideo ? 'mp4' : 'm4a') : 'webm' }
}

export function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
