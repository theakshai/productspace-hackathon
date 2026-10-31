import { useCallback, useEffect, useRef, useState } from 'react'
import { platformLabel } from '../lib/brief.js'
import { clipDuration } from '../lib/clips.js'
import { PLATFORM_FIELDS, countFor, writeCopy } from '../lib/copy.js'
import { buildSrt, downloadText, safeFilename } from '../lib/srt.js'
import { formatTimestamp } from '../lib/transcript.js'
import MediaPlayer from './MediaPlayer.jsx'

function CopyButton({ text }) {
  const [done, setDone] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setDone(true)
    setTimeout(() => setDone(false), 1200)
  }
  return (
    <button className="link" onClick={copy}>
      {done ? 'Copied ✓' : 'Copy'}
    </button>
  )
}

function Field({ field, value, onChange }) {
  const count = countFor(field, value)
  const over = count > field.limit
  return (
    <label className="field copy-field">
      <span className="row between field-head">
        <span>{field.label}</span>
        <span className="row">
          <span className={`counter ${over ? 'over' : ''}`}>
            {count}/{field.limit}
            {field.unit ? ` ${field.unit}` : ''}
          </span>
          <CopyButton text={value} />
        </span>
      </span>
      <textarea rows={field.rows} value={value} onChange={(e) => onChange(e.target.value)} />
      <span className="hint-inline">{field.hint}</span>
    </label>
  )
}

function ClipCopy({ clip, index, entry, platforms, transcript, onEdit, onPlay, playing }) {
  const [tab, setTab] = useState(null)
  const active = platforms.includes(tab) ? tab : platforms[0]
  const srt = () => downloadText(`${String(index + 1).padStart(2, '0')}-${safeFilename(clip.title)}.srt`, buildSrt(transcript, clip), 'application/x-subrip')

  return (
    <li className={`clip-card ${playing ? 'playing' : ''}`} data-testid="copy-card">
      <div className="clip-head">
        <span className="clip-num">{index + 1}</span>
        <div className="clip-title">
          <h3>{clip.title}</h3>
          <p className="muted small">
            <span className="ts">
              {formatTimestamp(clip.start)}–{formatTimestamp(clip.end)}
            </span>{' '}
            · {clipDuration(clip)}s
          </p>
        </div>
        <div className="row">
          <button className="btn small" onClick={onPlay}>
            ▶ Play
          </button>
          <button className="btn small" onClick={srt} title="Subtitle file for this clip, timed from 0:00">
            ⬇ Subtitles .srt
          </button>
        </div>
      </div>

      {entry ? (
        <>
          <div className="tabs" role="tablist">
            {platforms.map((p) => (
              <button key={p} role="tab" aria-selected={active === p} className={`tab ${active === p ? 'on' : ''}`} onClick={() => setTab(p)}>
                {platformLabel(p)}
              </button>
            ))}
          </div>
          {PLATFORM_FIELDS[active].map((f) => (
            <Field
              key={f.key}
              field={f}
              value={entry.platforms[active]?.[f.key] || ''}
              onChange={(v) => onEdit(active, f.key, v)}
            />
          ))}
        </>
      ) : (
        <p className="muted small">No copy for this clip yet.</p>
      )}
    </li>
  )
}

export default function CopyPanel({ settings, media, transcript, clips, brief, copy, onCopyChange, onOpenSettings, onGoClips, onNext }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [playing, setPlaying] = useState(null)
  const playerRef = useRef(null)
  const abortRef = useRef(null)
  const playingRef = useRef(null)
  playingRef.current = playing

  useEffect(() => () => abortRef.current?.abort(), [])

  const kept = (clips?.items || []).filter((c) => c.keep)

  async function run() {
    if (!settings.apiKey) {
      onOpenSettings()
      return
    }
    setBusy(true)
    setError(null)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const result = await writeCopy({
        apiKey: settings.apiKey,
        model: settings.model,
        transcript,
        clips: kept,
        brief,
        brandRules: settings.brandRules || [],
        episodeTitle: transcript.title,
        signal: controller.signal,
      })
      if (!Object.keys(result.byClip).length) throw new Error('Gemini returned no copy. Try again.')
      onCopyChange({ mediaUri: media.gemini.uri, ...result, createdAt: new Date().toISOString() })
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  function edit(clipId, platform, key, value) {
    const entry = copy.byClip[clipId]
    onCopyChange({
      ...copy,
      byClip: {
        ...copy.byClip,
        [clipId]: { ...entry, platforms: { ...entry.platforms, [platform]: { ...entry.platforms[platform], [key]: value } } },
      },
    })
  }

  function play(clip) {
    setPlaying(clip.id)
    playerRef.current?.seek(clip.start)
  }
  const onTime = useCallback(
    (t) => {
      const clip = kept.find((c) => c.id === playingRef.current)
      if (clip && t >= clip.end - 0.15) {
        playerRef.current?.pause()
        setPlaying(null)
      }
    },
    [kept],
  )

  function downloadAllSrt() {
    kept.forEach((clip, i) =>
      setTimeout(
        () => downloadText(`${String(i + 1).padStart(2, '0')}-${safeFilename(clip.title)}.srt`, buildSrt(transcript, clip), 'application/x-subrip'),
        i * 300,
      ),
    )
  }

  if (!kept.length) {
    return (
      <div className="placeholder">
        <span className="tag">Step 4 · Copy</span>
        <h2>Pick some clips first</h2>
        <p className="muted">Captions are written for the clips you keep in step 3.</p>
        <button className="btn primary" onClick={onGoClips}>
          Go to clips
        </button>
      </div>
    )
  }

  const platforms = copy?.platforms || []

  return (
    <div className="copy-panel">
      <div className="row between top">
        <div>
          <span className="tag">Step 4 · Copy</span>
          <h2>Captions and posts for every platform</h2>
          <p className="muted">
            {kept.length} clip{kept.length === 1 ? '' : 's'}
            {platforms.length ? ` · ${platforms.map(platformLabel).join(', ')}` : ''} · each written natively for its platform.
            Edit anything; ClipCraft keeps track of what you change.
          </p>
        </div>
        <div className="row">
          <button className="btn" onClick={downloadAllSrt}>
            ⬇ All subtitles
          </button>
          <button className={`btn ${copy ? '' : 'primary'}`} onClick={run} disabled={busy}>
            {busy ? 'Writing…' : copy ? 'Rewrite all' : 'Write captions'}
          </button>
        </div>
      </div>

      {busy && (
        <div className="progress indeterminate" role="status">
          <div className="progress-bar" />
        </div>
      )}
      {error && (
        <p className="status error" role="alert">
          {error}
        </p>
      )}

      <div className="clips-layout">
        <div className="clips-player">
          <MediaPlayer ref={playerRef} media={media} onTime={onTime} compact />
          {settings.brandRules?.length > 0 && (
            <p className="muted small">Applying {settings.brandRules.length} brand voice rules.</p>
          )}
        </div>
        <ol className="clip-list" data-testid="copy-list">
          {kept.map((clip, i) => (
            <ClipCopy
              key={clip.id}
              clip={clip}
              index={i}
              entry={copy?.byClip[clip.id]}
              platforms={platforms}
              transcript={transcript}
              onEdit={(p, k, v) => edit(clip.id, p, k, v)}
              onPlay={() => play(clip)}
              playing={playing === clip.id}
            />
          ))}
        </ol>
      </div>

      {copy && (
        <div className="row end">
          <button className="btn primary" onClick={onNext}>
            Next: brand voice →
          </button>
        </div>
      )}
    </div>
  )
}
