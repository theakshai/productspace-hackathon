import { useCallback, useEffect, useRef, useState } from 'react'
import { platformLabel, structureBrief } from '../lib/brief.js'
import { DEFAULT_BRIEF, clipDuration, selectClips } from '../lib/clips.js'
import { canCut, cutClip, downloadBlob } from '../lib/cut.js'
import { safeFilename } from '../lib/srt.js'
import { formatTimestamp } from '../lib/transcript.js'
import DictationBox from './DictationBox.jsx'
import MediaPlayer from './MediaPlayer.jsx'

const EXAMPLE =
  "Uh, find me the bits about AI and jobs, like what young people should actually learn, for, um, college students. Let's do LinkedIn, no wait, Instagram and YouTube Shorts. Five clips, keep them under a minute, and skip the personal stuff."

// F12: export the actual clip. Uploaded files are cut in the browser; YouTube clips open at the moment.
function ExportClip({ media, clip, index }) {
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  if (media?.kind === 'youtube') {
    return (
      <a className="btn small" href={`https://www.youtube.com/watch?v=${media.youtubeId}&t=${Math.floor(clip.start)}s`} target="_blank" rel="noreferrer" title="YouTube videos can't be cut in the browser. Upload the file to export clips.">
        ↗ Open at {formatTimestamp(clip.start)}
      </a>
    )
  }
  if (!canCut()) return null
  async function run() {
    setError(null)
    setProgress(0)
    try {
      const { blob, ext } = await cutClip({ src: media.previewUrl, isVideo: media.kind === 'video', start: clip.start, end: clip.end, onProgress: setProgress })
      downloadBlob(`${String(index + 1).padStart(2, '0')}-${safeFilename(clip.title)}.${ext}`, blob)
    } catch (e) {
      setError(e.message)
    } finally {
      setProgress(null)
    }
  }
  return (
    <button className="btn small" onClick={run} disabled={!media?.previewUrl || progress !== null} title={media?.previewUrl ? 'Cut this clip into its own file' : 'Re-select the file on the Upload step to export clips'}>
      {progress !== null ? `Cutting… ${Math.round(progress * 100)}%` : error ? '⚠ Retry export' : '⬇ Export clip'}
    </button>
  )
}

function BriefSummary({ brief }) {
  return (
    <div className="brief-mini" data-testid="brief-mini">
      <p className="brief-summary">“{brief.summary}”</p>
      <p className="muted small">
        {brief.clipCount} clips · {brief.clipLengthSeconds.min}–{brief.clipLengthSeconds.max}s ·{' '}
        {brief.platforms.map(platformLabel).join(', ')}
        {brief.audience ? ` · for ${brief.audience}` : ''}
      </p>
      {brief.corrections.length > 0 && (
        <div className="callout">
          <strong>Understood your corrections</strong>
          <ul>
            {brief.corrections.map((c, i) => (
              <li key={i}>
                <span className="strike">{c.heard}</span> → {c.understood}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function ScoreBar({ score }) {
  return (
    <span className="score" title={`Hook strength ${score}/10`}>
      <span className="score-track">
        <span className="score-fill" style={{ width: `${score * 10}%` }} />
      </span>
      <span className="small">{score}/10</span>
    </span>
  )
}

export default function ClipsPanel({
  settings,
  media,
  transcript,
  speech,
  onSpeechChange,
  brief,
  onBriefChange,
  clips,
  onClipsChange,
  onOpenSettings,
  onGoTranscript,
  onNext,
}) {
  const [stage, setStage] = useState(null) // 'brief' | 'clips' | null
  const [error, setError] = useState(null)
  const [playing, setPlaying] = useState(null)
  const dictRef = useRef(null)
  const playerRef = useRef(null)
  const abortRef = useRef(null)
  const playingRef = useRef(null)
  playingRef.current = playing

  useEffect(() => () => abortRef.current?.abort(), [])

  async function run() {
    if (!settings.apiKey) {
      onOpenSettings()
      return
    }
    const text = (dictRef.current?.read() ?? speech).trim()
    if (text !== speech) onSpeechChange(text)
    const controller = new AbortController()
    abortRef.current = controller
    setError(null)
    try {
      let useBrief = DEFAULT_BRIEF
      if (text.length >= 10) {
        setStage('brief')
        useBrief = await structureBrief({ apiKey: settings.apiKey, model: settings.model, rawSpeech: text, signal: controller.signal })
      }
      // F11: fall back to the default platforms from Settings when the brief names none.
      if (!useBrief.platforms?.length && settings.defaultPlatforms?.length) useBrief = { ...useBrief, platforms: settings.defaultPlatforms }
      onBriefChange(useBrief)
      setStage('clips')
      const items = await selectClips({
        apiKey: settings.apiKey,
        model: settings.model,
        transcript,
        brief: useBrief,
        learnings: settings.learnings || [],
        signal: controller.signal,
      })
      if (!items.length) throw new Error('Gemini did not find any clips that fit. Try a broader request.')
      onClipsChange({ mediaUri: media.gemini.uri, items, createdAt: new Date().toISOString() })
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message)
    } finally {
      setStage(null)
    }
  }

  function play(clip) {
    setPlaying(clip.id)
    playerRef.current?.seek(clip.start)
  }

  // Stop at the end of the clip that is playing.
  const onTime = useCallback((t) => {
    const id = playingRef.current
    if (!id) return
    const clip = clips?.items.find((c) => c.id === id)
    if (clip && t >= clip.end - 0.15) {
      playerRef.current?.pause()
      setPlaying(null)
    }
  }, [clips])

  const toggleKeep = (id) =>
    onClipsChange({ ...clips, items: clips.items.map((c) => (c.id === id ? { ...c, keep: !c.keep } : c)) })

  if (!transcript) {
    return (
      <div className="placeholder">
        <span className="tag">Step 3 · Clips</span>
        <h2>Make the transcript first</h2>
        <p className="muted">ClipCraft picks clips from the timestamped transcript.</p>
        <button className="btn primary" onClick={onGoTranscript}>
          Go to transcript
        </button>
      </div>
    )
  }

  const kept = clips?.items.filter((c) => c.keep).length || 0
  const busy = Boolean(stage)

  return (
    <div className="clips-panel">
      <div>
        <span className="tag">Step 3 · Clips</span>
        <h2>Find the best clips</h2>
        <p className="muted">
          Optional: click the box, hold your Wispr Flow key and say what you want. Who it's for, which topics, which
          platforms, how long. Change your mind mid-sentence, it copes. Leave it empty for the 5 strongest moments.
        </p>
      </div>

      <div className="dictation">
        <DictationBox
          ref={dictRef}
          className="dictation-box"
          value={speech}
          onChange={onSpeechChange}
          placeholder="🎙 Hold your Wispr Flow key: “the AI and jobs bits, for students, Instagram and Shorts, under a minute…”"
          rows={3}
          data-testid="clip-speech"
        />
        <div className="row between">
          <button className="link" onClick={() => onSpeechChange(EXAMPLE)} disabled={busy}>
            Use an example
          </button>
          <button className="btn primary" onClick={run} disabled={busy}>
            {stage === 'brief' ? 'Understanding you…' : stage === 'clips' ? 'Picking clips…' : clips ? 'Find clips again' : 'Find clips'}
          </button>
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
      </div>

      {brief && clips && <BriefSummary brief={brief} />}

      {clips && (
        <div className="clips-layout">
          <div className="clips-player">
            <MediaPlayer ref={playerRef} media={media} onTime={onTime} compact />
            <p className="muted small">
              {kept} of {clips.items.length} clips kept for captions.
            </p>
          </div>

          <ol className="clip-list" data-testid="clip-list">
            {clips.items.map((clip, i) => (
              <li key={clip.id} className={`clip-card ${clip.keep ? '' : 'dropped'} ${playing === clip.id ? 'playing' : ''}`}>
                <div className="clip-head">
                  <span className="clip-num">{i + 1}</span>
                  <div className="clip-title">
                    <h3>{clip.title}</h3>
                    <p className="muted small">
                      <span className="ts">
                        {formatTimestamp(clip.start)}–{formatTimestamp(clip.end)}
                      </span>{' '}
                      · {clipDuration(clip)}s · {clip.topic}
                    </p>
                  </div>
                  <span className="tag hook">{clip.hookType}</span>
                </div>
                {clip.quote && <blockquote className="clip-quote">“{clip.quote}”</blockquote>}
                <p className="clip-reason">
                  <strong>Why this clip: </strong>
                  {clip.reason}
                </p>
                <div className="row between clip-actions">
                  <ScoreBar score={clip.hookScore} />
                  <div className="row">
                    <button className="btn small" onClick={() => play(clip)}>
                      {playing === clip.id ? '■ Playing…' : '▶ Play clip'}
                    </button>
                    <ExportClip media={media} clip={clip} index={i} />
                    <button className="btn small" onClick={() => toggleKeep(clip.id)} aria-pressed={clip.keep}>
                      {clip.keep ? '✓ Keep' : 'Dropped'}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {clips && (
        <div className="row end">
          <button className="btn primary" onClick={onNext} disabled={!kept}>
            Next: write captions for {kept} clip{kept === 1 ? '' : 's'} →
          </button>
        </div>
      )}
    </div>
  )
}
