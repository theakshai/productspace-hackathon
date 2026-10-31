import { useCallback, useEffect, useRef, useState } from 'react'
import { platformLabel } from '../lib/brief.js'
import { clipDuration } from '../lib/clips.js'
import { PLATFORM_FIELDS, countFor, rewriteCopy, writeCopy } from '../lib/copy.js'
import { buildSrt, downloadText, safeFilename } from '../lib/srt.js'
import { formatTimestamp } from '../lib/transcript.js'
import DictationBox from './DictationBox.jsx'
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

function VoiceEdit({ platform, clipCount, canUndo, onRewrite, onUndo, onAddRules }) {
  const [feedback, setFeedback] = useState('')
  const [allClips, setAllClips] = useState(false)
  const [status, setStatus] = useState(null) // { kind, text }
  const [suggested, setSuggested] = useState([])
  const [saved, setSaved] = useState([])
  const boxRef = useRef(null)

  async function run() {
    const text = (boxRef.current?.read() ?? feedback).trim()
    if (text.length < 3) return
    setStatus({ kind: 'busy', text: allClips ? 'Rewriting every clip…' : 'Rewriting…' })
    setSuggested([])
    setSaved([])
    try {
      const result = await onRewrite(text, allClips, (done, total) =>
        setStatus({ kind: 'busy', text: `Rewriting ${done + 1} of ${total}…` }),
      )
      setStatus({ kind: 'ok', text: `✓ ${result.changes}` })
      setSuggested(result.rules)
      setFeedback('')
    } catch (e) {
      setStatus({ kind: 'error', text: e.message })
    }
  }

  const busy = status?.kind === 'busy'
  return (
    <div className="voice-edit" data-testid="voice-edit">
      <DictationBox
        ref={boxRef}
        className="dictation-box small-box"
        value={feedback}
        onChange={setFeedback}
        rows={2}
        placeholder={`🎙 Tell it what to change in this ${platformLabel(platform)} copy: “shorter, no emojis, less corporate…”`}
        data-testid="feedback"
      />
      <div className="row between">
        <label className="row small muted check">
          <input type="checkbox" checked={allClips} onChange={(e) => setAllClips(e.target.checked)} disabled={clipCount < 2} />
          Apply to all {clipCount} clips
        </label>
        <div className="row">
          {canUndo && (
            <button className="btn small" onClick={onUndo} disabled={busy}>
              ↶ Undo
            </button>
          )}
          <button className="btn small primary" onClick={run} disabled={busy || feedback.trim().length < 3}>
            {busy ? 'Rewriting…' : 'Rewrite'}
          </button>
        </div>
      </div>
      {status && <p className={`status ${status.kind}`}>{status.text}</p>}
      {suggested.length > 0 && (
        <div className="callout rule-suggest" data-testid="rule-suggest">
          <strong>Sounds like a lasting preference. Remember it for all future captions?</strong>
          <ul>
            {suggested.map((r) => (
              <li key={r} className="row between">
                <span>{r}</span>
                {saved.includes(r) ? (
                  <span className="status ok small">Saved to brand voice ✓</span>
                ) : (
                  <span className="row">
                    <button
                      className="btn small"
                      onClick={() => {
                        onAddRules([r])
                        setSaved((x) => [...x, r])
                      }}
                    >
                      Remember
                    </button>
                    <button className="link" onClick={() => setSuggested((x) => x.filter((y) => y !== r))}>
                      Not this time
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function ClipCopy({ clip, index, entry, platforms, transcript, onEdit, onPlay, playing, clipCount, onRewrite, onUndo, onAddRules }) {
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
          <VoiceEdit
            key={active}
            platform={active}
            clipCount={clipCount}
            canUndo={Boolean(entry.history?.some((h) => h.platform === active))}
            onRewrite={(feedback, all, progress) => onRewrite(active, feedback, all, progress)}
            onUndo={() => onUndo(active)}
            onAddRules={onAddRules}
          />
        </>
      ) : (
        <p className="muted small">No copy for this clip yet.</p>
      )}
    </li>
  )
}

export default function CopyPanel({ settings, media, transcript, clips, brief, copy, onCopyChange, onAddBrandRules, onOpenSettings, onGoClips, onNext }) {
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

  // Rewrites one platform's copy for one clip (or every kept clip) from spoken feedback.
  // Uses functional updates so several rewrites in a row never overwrite each other.
  async function rewrite(clipId, platform, feedback, allClips, progress) {
    const targets = allClips ? kept : kept.filter((c) => c.id === clipId)
    let first = null
    for (let i = 0; i < targets.length; i++) {
      const clip = targets[i]
      const entry = copy.byClip[clip.id]
      if (!entry) continue
      if (allClips) progress?.(i, targets.length)
      const result = await rewriteCopy({
        apiKey: settings.apiKey,
        model: settings.model,
        platform,
        current: entry.platforms[platform],
        feedback,
        transcript,
        clip,
        brief,
        brandRules: settings.brandRules || [],
      })
      if (!first) first = result
      onCopyChange((prev) => {
        const e = prev.byClip[clip.id]
        return {
          ...prev,
          byClip: {
            ...prev.byClip,
            [clip.id]: {
              ...e,
              platforms: { ...e.platforms, [platform]: result.fields },
              history: [...(e.history || []), { platform, fields: e.platforms[platform] }].slice(-20),
              edits: [...(e.edits || []), { kind: 'voice', platform, feedback, changes: result.changes, at: new Date().toISOString() }],
            },
          },
        }
      })
    }
    if (!first) throw new Error('Nothing to rewrite yet.')
    return first
  }

  function undo(clipId, platform) {
    onCopyChange((prev) => {
      const e = prev.byClip[clipId]
      const history = [...(e.history || [])]
      const idx = history.map((h) => h.platform).lastIndexOf(platform)
      if (idx < 0) return prev
      const [last] = history.splice(idx, 1)
      return { ...prev, byClip: { ...prev.byClip, [clipId]: { ...e, platforms: { ...e.platforms, [platform]: last.fields }, history } } }
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
            Edit any field directly, or dictate what to change and it gets rewritten.
          </p>
        </div>
        <div className="row">
          <button className="btn" onClick={downloadAllSrt}>
            ⬇ All subtitles
          </button>
          <button className={`btn ${copy ? '' : 'primary'}`} onClick={run} disabled={busy}>
            {busy ? 'Writing… (30–60s)' : copy ? 'Rewrite all' : 'Write captions'}
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
      {copy && !busy && kept.every((c) => !copy.byClip[c.id]) && (
        <div className="callout" data-testid="stale-copy">
          <strong>Your clips changed since these captions were written.</strong> Click <strong>Rewrite all</strong> to write
          captions for the current clips.
        </div>
      )}
      {!copy && !busy && (
        <p className="muted small">
          Click <strong>Write captions</strong>. Each clip then gets tabs per platform, editable fields, and a 🎙 box to change the
          copy by voice.
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
              clipCount={kept.length}
              onRewrite={(p, feedback, all, progress) => rewrite(clip.id, p, feedback, all, progress)}
              onUndo={(p) => undo(clip.id, p)}
              onAddRules={onAddBrandRules}
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
