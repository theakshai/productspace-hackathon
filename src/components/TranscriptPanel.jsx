import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatTimestamp, generateTranscript, transcriptToText } from '../lib/transcript.js'
import MediaPlayer from './MediaPlayer.jsx'

function useElapsed(running) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    if (!running) return
    setSecs(0)
    const id = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [running])
  return secs
}

export default function TranscriptPanel({ settings, media, transcript, onTranscriptChange, onOpenSettings, onGoUpload, onNext }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [now, setNow] = useState(0)
  const [query, setQuery] = useState('')
  const playerRef = useRef(null)
  const abortRef = useRef(null)
  const elapsed = useElapsed(busy)

  useEffect(() => () => abortRef.current?.abort(), [])

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
      const result = await generateTranscript({ apiKey: settings.apiKey, model: settings.model, media, signal: controller.signal })
      if (!result.segments.length) throw new Error('Gemini could not hear any speech in this media.')
      onTranscriptChange({ ...result, mediaUri: media.gemini.uri })
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const seek = (t) => {
    setNow(t)
    playerRef.current?.seek(t)
  }
  const onTime = useCallback((t) => setNow(t), [])

  const speakerById = useMemo(
    () => Object.fromEntries((transcript?.speakers || []).map((s) => [s.id, s])),
    [transcript],
  )

  // The segment playing right now.
  const activeIndex = useMemo(() => {
    const segs = transcript?.segments || []
    let idx = -1
    for (let i = 0; i < segs.length; i++) {
      if (segs[i].start <= now + 0.25) idx = i
      else break
    }
    return idx
  }, [transcript, now])

  const visible = useMemo(() => {
    const segs = (transcript?.segments || []).map((s, i) => ({ ...s, i }))
    const q = query.trim().toLowerCase()
    return q ? segs.filter((s) => s.text.toLowerCase().includes(q)) : segs
  }, [transcript, query])

  function download() {
    const blob = new Blob([transcriptToText(transcript)], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(transcript.title || 'transcript').replace(/[^\w\- ]+/g, '').slice(0, 60) || 'transcript'}.txt`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  if (!media?.gemini) {
    return (
      <div className="placeholder">
        <span className="tag">Step 2 · Transcript</span>
        <h2>Add a podcast first</h2>
        <p className="muted">Paste a YouTube link or upload a file in step 1.</p>
        <button className="btn primary" onClick={onGoUpload}>
          Go to step 1
        </button>
      </div>
    )
  }

  return (
    <div className="transcript-panel">
      <div className="row between top">
        <div>
          <span className="tag">Step 2 · Transcript</span>
          <h2>{transcript?.title || media.fileName}</h2>
          {transcript && (
            <p className="muted small">
              {transcript.segments.length} lines · {transcript.speakers.map((s) => s.name).join(', ')}{transcript.excerpt ? " · demo excerpt: only the lines inside the clips" : ""}
              {transcript.durationSeconds ? ` · ${formatTimestamp(transcript.durationSeconds)}` : ''}
            </p>
          )}
        </div>
        <div className="row">
          {transcript && (
            <button className="btn" onClick={download} disabled={busy}>
              Download .txt
            </button>
          )}
          <button className={`btn ${transcript ? '' : 'primary'}`} onClick={run} disabled={busy}>
            {busy ? 'Listening…' : transcript ? 'Redo transcript' : 'Generate transcript'}
          </button>
        </div>
      </div>

      {busy && (
        <div className="working" role="status">
          <div className="progress indeterminate">
            <div className="progress-bar" />
          </div>
          <p className="muted small">
            Gemini is listening to the whole podcast… {elapsed}s. A 20-minute episode usually takes 1–2 minutes.
          </p>
        </div>
      )}
      {error && (
        <p className="status error" role="alert">
          {error}
        </p>
      )}

      <div className="transcript-layout">
        <div className="transcript-player">
          <MediaPlayer ref={playerRef} media={media} onTime={onTime} compact />
          {transcript?.topics?.length > 0 && (
            <div className="topics">
              <h3 className="small-heading">Topics in this episode</h3>
              {transcript.topics.map((t, i) => (
                <button key={i} className="topic" onClick={() => seek(t.start)} title={t.summary}>
                  <span className="ts">{formatTimestamp(t.start)}</span>
                  <span>
                    <strong>{t.title}</strong>
                    <span className="muted small block">{t.summary}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="transcript-list-wrap">
          {transcript ? (
            <>
              <input
                className="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search the transcript…"
                aria-label="Search the transcript"
              />
              <ol className="transcript-list" data-testid="transcript-list">
                {visible.map((seg) => {
                  const sp = speakerById[seg.speaker]
                  return (
                    <li key={seg.i}>
                      <button
                        className={`line ${seg.i === activeIndex ? 'active' : ''}`}
                        onClick={() => seek(seg.start)}
                        data-start={seg.start}
                      >
                        <span className="ts">{formatTimestamp(seg.start)}</span>
                        <span className="speaker" style={{ color: sp?.color }}>
                          {sp?.name || seg.speaker}
                        </span>
                        <span className="text">{seg.text}</span>
                      </button>
                    </li>
                  )
                })}
                {!visible.length && <li className="muted small">No lines match “{query}”.</li>}
              </ol>
            </>
          ) : (
            !busy && (
              <div className="empty">
                <p className="muted">
                  Click <strong>Generate transcript</strong>. Gemini listens to the whole episode and writes down who said
                  what, and when.
                </p>
              </div>
            )
          )}
        </div>
      </div>

      {transcript && (
        <div className="row end">
          <button className="btn primary" onClick={onNext}>
            Next: pick clips →
          </button>
        </div>
      )}
    </div>
  )
}
