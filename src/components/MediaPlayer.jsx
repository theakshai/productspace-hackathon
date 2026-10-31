import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

// One player for both sources. Exposes seek(seconds) and reports the current time.
// YouTube is controlled through the embed's postMessage API, so no extra script is needed.
const MediaPlayer = forwardRef(function MediaPlayer({ media, onTime, compact = false }, ref) {
  const videoRef = useRef(null)
  const frameRef = useRef(null)
  const isYouTube = media?.kind === 'youtube'

  const ytCommand = (func, args = []) =>
    frameRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*')

  useImperativeHandle(ref, () => ({
    seek(seconds, play = true) {
      if (isYouTube) {
        ytCommand('seekTo', [seconds, true])
        if (play) ytCommand('playVideo')
        onTime?.(seconds)
        return true
      }
      const el = videoRef.current
      if (!el) return false
      el.currentTime = seconds
      if (play) el.play().catch(() => {})
      return true
    },
    pause() {
      if (isYouTube) ytCommand('pauseVideo')
      else videoRef.current?.pause()
    },
    canPlay: () => (isYouTube ? Boolean(frameRef.current) : Boolean(videoRef.current)),
  }))

  // YouTube time updates: ask the embed to start sending "infoDelivery" messages.
  useEffect(() => {
    if (!isYouTube) return
    function onMessage(e) {
      if (!/youtube(-nocookie)?\.com$/.test(new URL(e.origin).hostname)) return
      let data
      try {
        data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
      } catch {
        return
      }
      const t = data?.info?.currentTime
      if (data?.event === 'infoDelivery' && Number.isFinite(t)) onTime?.(t)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [isYouTube, onTime])

  const startListening = () => frameRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 'clipcraft' }), '*')

  if (!media) return null

  if (isYouTube) {
    const origin = encodeURIComponent(window.location.origin)
    return (
      <div className={`player-wrap ${compact ? 'compact' : ''}`}>
        <div className="yt-frame">
          <iframe
            ref={frameRef}
            src={`https://www.youtube-nocookie.com/embed/${media.youtubeId}?enablejsapi=1&rel=0&origin=${origin}`}
            title={media.fileName}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
            onLoad={startListening}
            data-testid="yt-player"
          />
        </div>
      </div>
    )
  }

  if (!media.previewUrl) {
    return (
      <div className={`player-wrap ${compact ? 'compact' : ''}`}>
        <div className="player placeholder-player">
          <p className="muted">To play along, choose the file again in step 1. The transcript still works.</p>
        </div>
      </div>
    )
  }

  const Tag = media.kind === 'audio' ? 'audio' : 'video'
  return (
    <div className={`player-wrap ${compact ? 'compact' : ''}`}>
      <Tag
        ref={videoRef}
        className={`player ${media.kind === 'audio' ? 'audio' : ''}`}
        src={media.previewUrl}
        controls
        onTimeUpdate={(e) => onTime?.(e.currentTarget.currentTime)}
        data-testid="media-el"
      />
    </div>
  )
})

export default MediaPlayer
