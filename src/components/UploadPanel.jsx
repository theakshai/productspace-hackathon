import { useEffect, useRef, useState } from 'react'
import { uploadFile } from '../lib/gemini.js'

const ACCEPT = 'video/*,audio/*'

export function formatTime(totalSeconds) {
  if (!Number.isFinite(totalSeconds)) return '–'
  const s = Math.round(totalSeconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

function formatSize(bytes) {
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(2)} GB`
  return `${(bytes / 1e6).toFixed(1)} MB`
}

function lengthNote(duration) {
  if (!Number.isFinite(duration)) return null
  const min = duration / 60
  if (min < 5) return { kind: 'warn', text: 'Short file: there may only be one or two good clips.' }
  if (min > 25) return { kind: 'warn', text: 'Long file: processing will take longer. 10–20 minutes works best.' }
  return { kind: 'ok', text: 'Good length for clipping.' }
}

export default function UploadPanel({ settings, media, onMediaChange, onOpenSettings, onNext }) {
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState(null) // { stage, percent }
  const [error, setError] = useState(null)
  const inputRef = useRef(null)
  const abortRef = useRef(null)

  // Release the preview URL when the file changes or the panel unmounts.
  useEffect(() => {
    const url = media?.previewUrl
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [media?.previewUrl])

  function pick(file) {
    if (!file) return
    if (!/^(video|audio)\//.test(file.type)) {
      setError('Please choose a video or audio file.')
      return
    }
    abortRef.current?.abort()
    setError(null)
    setProgress(null)
    onMediaChange({
      file,
      fileName: file.name,
      size: file.size,
      kind: file.type.startsWith('video') ? 'video' : 'audio',
      previewUrl: URL.createObjectURL(file),
      duration: null,
      gemini: null,
    })
  }

  async function send() {
    if (!settings.apiKey) {
      onOpenSettings()
      return
    }
    setError(null)
    setProgress({ stage: 'uploading', percent: 0 })
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const gemini = await uploadFile(settings.apiKey, media.file, setProgress, controller.signal)
      onMediaChange({ ...media, gemini })
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message)
      setProgress(null)
    }
  }

  function cancel() {
    abortRef.current?.abort()
    setProgress(null)
  }

  const busy = progress && progress.stage !== 'ready'
  const ready = Boolean(media?.gemini)
  const note = lengthNote(media?.duration)

  if (!media) {
    return (
      <div
        className={`dropzone ${dragging ? 'dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          pick(e.dataTransfer.files?.[0])
        }}
      >
        <div className="dropzone-icon" aria-hidden="true">▲</div>
        <h2>Upload a podcast</h2>
        <p className="muted">MP4, MOV, MP3, M4A or WAV · 10–20 minutes works best</p>
        <button className="btn primary" onClick={() => inputRef.current?.click()}>
          Choose file
        </button>
        <p className="hint">or drag and drop it here</p>
        {error && <p className="status error">{error}</p>}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          hidden
          data-testid="file-input"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>
    )
  }

  return (
    <div className="upload">
      <div className="player-wrap">
        {media.previewUrl ? (
          media.kind === 'video' ? (
            <video
              className="player"
              src={media.previewUrl}
              controls
              onLoadedMetadata={(e) => onMediaChange({ ...media, duration: e.currentTarget.duration })}
            />
          ) : (
            <audio
              className="player audio"
              src={media.previewUrl}
              controls
              onLoadedMetadata={(e) => onMediaChange({ ...media, duration: e.currentTarget.duration })}
            />
          )
        ) : (
          <div className="player placeholder-player">
            <p className="muted">Preview isn't kept after a page reload. Choose the file again to watch it.</p>
          </div>
        )}
      </div>

      <div className="file-meta">
        <div>
          <h3 className="file-name">{media.fileName}</h3>
          <p className="muted small">
            {media.kind === 'video' ? 'Video' : 'Audio'} · {formatTime(media.duration)} · {formatSize(media.size)}
          </p>
          {note && <p className={`status ${note.kind}`}>{note.text}</p>}
        </div>
        <button className="btn" onClick={() => inputRef.current?.click()} disabled={busy}>
          Change file
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          hidden
          data-testid="file-input"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>

      <div className="send-box">
        {ready ? (
          <>
            <p className="status ok">✓ Sent to Gemini and ready to analyse.</p>
            <button className="btn primary" onClick={onNext}>
              Next: voice brief →
            </button>
          </>
        ) : busy ? (
          <>
            <div className="progress-label">
              <span>{progress.stage === 'uploading' ? `Uploading to Gemini… ${progress.percent}%` : 'Gemini is processing the file…'}</span>
              <button className="link" onClick={cancel}>
                Cancel
              </button>
            </div>
            <div
              className={`progress ${progress.stage === 'processing' ? 'indeterminate' : ''}`}
              role="progressbar"
              aria-valuenow={progress.percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="progress-bar" style={{ width: `${progress.percent}%` }} />
            </div>
          </>
        ) : (
          <>
            {!settings.apiKey && <p className="muted small">Add your Gemini key in Settings first.</p>}
            <button className="btn primary" onClick={send} disabled={!media.file}>
              {settings.apiKey ? 'Send to Gemini' : 'Add Gemini key'}
            </button>
          </>
        )}
        {error && (
          <p className="status error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
