import { useRef, useState } from 'react'
import { fetchYouTubeTitle, parseYouTubeId, uploadFile } from '../lib/gemini.js'

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
  if (!Number.isFinite(bytes)) return ''
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

function YouTubeForm({ onPick }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    const id = parseYouTubeId(url)
    if (!id) {
      setError("That doesn't look like a YouTube link. Try something like https://www.youtube.com/watch?v=…")
      return
    }
    setError(null)
    setBusy(true)
    const title = await fetchYouTubeTitle(id)
    setBusy(false)
    onPick({
      source: 'youtube',
      kind: 'youtube',
      youtubeId: id,
      url: `https://www.youtube.com/watch?v=${id}`,
      fileName: title || 'YouTube video',
      size: null,
      duration: null,
      gemini: { uri: `https://www.youtube.com/watch?v=${id}`, mimeType: null, expiresAt: null },
    })
  }

  return (
    <form className="yt-form" onSubmit={submit}>
      <div className="dropzone-icon" aria-hidden="true">▶</div>
      <h2>Paste a YouTube link</h2>
      <p className="muted">Any public podcast or interview. Gemini watches it straight from YouTube, no download needed.</p>
      <div className="row yt-row">
        <input
          className="yt-input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          aria-label="YouTube link"
          data-testid="yt-input"
        />
        <button className="btn primary" type="submit" disabled={!url.trim() || busy}>
          {busy ? 'Checking…' : 'Use this video'}
        </button>
      </div>
      {error && <p className="status error">{error}</p>}
      <p className="hint">Private and unlisted videos won't work. Upload the file instead.</p>
    </form>
  )
}

export default function UploadPanel({ settings, media, onMediaChange, onOpenSettings, onNext }) {
  const [mode, setMode] = useState('youtube')
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState(null) // { stage, percent }
  const [error, setError] = useState(null)
  const inputRef = useRef(null)
  const abortRef = useRef(null)

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
      source: 'file',
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

  function startOver() {
    abortRef.current?.abort()
    setProgress(null)
    setError(null)
    onMediaChange(null)
  }

  const busy = progress && progress.stage !== 'ready'
  const ready = Boolean(media?.gemini)
  const isYouTube = media?.kind === 'youtube'
  const note = lengthNote(media?.duration)

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPT}
      hidden
      data-testid="file-input"
      onChange={(e) => pick(e.target.files?.[0])}
    />
  )

  if (!media) {
    return (
      <div className="source">
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={mode === 'youtube'} className={`tab ${mode === 'youtube' ? 'on' : ''}`} onClick={() => setMode('youtube')}>
            YouTube link
          </button>
          <button role="tab" aria-selected={mode === 'file'} className={`tab ${mode === 'file' ? 'on' : ''}`} onClick={() => setMode('file')}>
            Upload a file
          </button>
        </div>

        {mode === 'youtube' ? (
          <div className="dropzone">
            <YouTubeForm onPick={onMediaChange} />
          </div>
        ) : (
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
            {fileInput}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="upload">
      <div className="player-wrap">
        {isYouTube ? (
          <div className="yt-frame">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${media.youtubeId}?rel=0`}
              title={media.fileName}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen
              data-testid="yt-player"
            />
          </div>
        ) : media.previewUrl ? (
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
            {isYouTube
              ? 'YouTube · public link'
              : [media.kind === 'video' ? 'Video' : 'Audio', formatTime(media.duration), formatSize(media.size)]
                  .filter(Boolean)
                  .join(' · ')}
          </p>
          {!isYouTube && note && <p className={`status ${note.kind}`}>{note.text}</p>}
        </div>
        <div className="row">
          {!isYouTube && (
            <button className="btn" onClick={() => inputRef.current?.click()} disabled={busy}>
              Change file
            </button>
          )}
          <button className="btn" onClick={startOver} disabled={busy}>
            {isYouTube ? 'Use a different source' : 'Start over'}
          </button>
        </div>
        {fileInput}
      </div>

      <div className="send-box">
        {ready ? (
          <>
            <p className="status ok">
              {isYouTube ? '✓ Linked. Gemini will watch it straight from YouTube.' : '✓ Sent to Gemini and ready to analyse.'}
            </p>
            <button className="btn primary" onClick={onNext}>
              Next: transcript →
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
