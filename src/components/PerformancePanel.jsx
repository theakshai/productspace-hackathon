import { useMemo, useRef, useState } from 'react'
import { platformLabel } from '../lib/brief.js'
import { PLATFORM_COLOR } from '../lib/calendar.js'
import { METRICS, analyze, engagement, metricsFromSpeech, rerank } from '../lib/performance.js'
import DictationBox from './DictationBox.jsx'

export default function PerformancePanel({ settings, media, clips, schedule, performance, onPerformanceChange, onSaveLearnings, onOpenSettings, onGoCalendar, onGoClips }) {
  const [speech, setSpeech] = useState('')
  const [status, setStatus] = useState(null)
  const boxRef = useRef(null)

  const kept = (clips?.items || []).filter((c) => c.keep)
  const clipsById = Object.fromEntries(kept.map((c) => [c.id, c]))
  const posts = (schedule?.posts || []).filter((p) => clipsById[p.clipId])
  const metrics = performance?.metrics || {}
  const result = useMemo(() => analyze({ posts, clipsById, metrics }), [posts, clipsById, metrics])
  const ranking = useMemo(() => (result.enough ? rerank(kept, result.hookLift) : []), [result, kept])
  const saved = settings.learnings || []
  const applied = result.learnings.length > 0 && result.learnings.every((l) => saved.includes(l))

  const setMetrics = (fn) =>
    onPerformanceChange((prev) => {
      const base = prev && prev.mediaUri === media.gemini.uri ? prev : { mediaUri: media.gemini.uri, metrics: {} }
      return { ...base, metrics: fn(base.metrics) }
    })
  const setValue = (postId, key, value) =>
    setMetrics((m) => ({ ...m, [postId]: { ...(m[postId] || {}), [key]: value === '' ? '' : Math.max(0, Number(value)) } }))

  async function logBySpeech() {
    const text = (boxRef.current?.read() ?? speech).trim()
    if (text.length < 3) return
    if (!settings.apiKey) {
      onOpenSettings()
      return
    }
    setStatus({ kind: 'busy', text: 'Matching your numbers to posts…' })
    try {
      const { entries, notes } = await metricsFromSpeech({ apiKey: settings.apiKey, model: settings.model, speech: text, posts, clipsById })
      setMetrics((m) => {
        const next = { ...m }
        for (const e of entries) {
          const vals = Object.fromEntries(METRICS.filter((k) => Number.isFinite(e[k])).map((k) => [k, e[k]]))
          next[e.postId] = { ...(next[e.postId] || {}), ...vals }
        }
        return next
      })
      setSpeech('')
      setStatus({ kind: entries.length ? 'ok' : 'error', text: entries.length ? `✓ Logged numbers for ${entries.length} post${entries.length > 1 ? 's' : ''}. ${notes}` : `Couldn't match that to a post. ${notes}` })
    } catch (e) {
      setStatus({ kind: 'error', text: e.message })
    }
  }

  if (!posts.length) {
    return (
      <div className="placeholder">
        <span className="tag">Step 7 · Performance</span>
        <h2>Schedule some posts first</h2>
        <p className="muted">Once posts go out, log how they did here. ClipCraft learns what works and changes its next suggestions.</p>
        <button className="btn primary" onClick={onGoCalendar}>
          Go to calendar
        </button>
      </div>
    )
  }

  const ordered = [...posts].sort((a, b) => (a.status === b.status ? (a.date < b.date ? -1 : 1) : a.status === 'posted' ? -1 : 1))

  return (
    <div className="perf-panel">
      <div>
        <span className="tag">Step 7 · Performance</span>
        <h2>What worked, and what changes next time</h2>
        <p className="muted">Log each post's numbers by voice or by typing. ClipCraft finds the patterns and feeds them into the next round of clip picks.</p>
      </div>

      <div className="voice-edit perf-voice">
        <DictationBox
          ref={boxRef}
          className="dictation-box small-box"
          value={speech}
          onChange={setSpeech}
          rows={2}
          placeholder="🎙 “The robots one on Reels did twelve k views, 600 likes and 140 saves. The GPT-5 LinkedIn post got 3,100 views and 40 comments.”"
          data-testid="perf-speech"
        />
        <div className="row end">
          <button className="btn small primary" onClick={logBySpeech} disabled={status?.kind === 'busy' || speech.trim().length < 3}>
            {status?.kind === 'busy' ? 'Logging…' : 'Log numbers'}
          </button>
        </div>
        {status && <p className={`status ${status.kind}`}>{status.text}</p>}
      </div>

      <div className="perf-table-wrap">
        <table className="perf-table" data-testid="perf-table">
          <thead>
            <tr>
              <th>Post</th>
              {METRICS.map((k) => (
                <th key={k}>{k}</th>
              ))}
              <th>Engagement</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((p) => {
              const m = metrics[p.id] || {}
              return (
                <tr key={p.id} className={p.status === 'posted' ? '' : 'future'}>
                  <td>
                    <span className="post-dot" style={{ background: PLATFORM_COLOR[p.platform] }} /> <strong>{clipsById[p.clipId].title}</strong>
                    <div className="muted small">
                      {platformLabel(p.platform)} · {p.date} · {clipsById[p.clipId].hookType} {p.status === 'posted' ? '· posted' : '· scheduled'}
                    </div>
                  </td>
                  {METRICS.map((k) => (
                    <td key={k}>
                      <input type="number" min="0" aria-label={`${k} for ${p.id}`} value={m[k] ?? ''} onChange={(e) => setValue(p.id, k, e.target.value)} />
                    </td>
                  ))}
                  <td className="eng">{m.views ? `${(engagement(m) * 100).toFixed(1)}%` : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {!result.enough ? (
        <p className="muted">Log numbers for at least two posts to see what's working.</p>
      ) : (
        <>
          <section className="brand-section" data-testid="findings">
            <h3>What worked</h3>
            <div className="findings">
              {result.findings.map((f) => (
                <div key={f.title} className={`finding ${f.kind}`}>
                  <strong>{f.title}</strong>
                  <span className="muted small">{f.detail}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="brand-section" data-testid="what-changed">
            <h3>What changes next time, and why</h3>
            <p className="muted small">Your clips re-ranked with these results. Arrows show the move from the original AI ranking.</p>
            <ol className="rerank">
              {ranking.map(({ clip, rank, was }) => (
                <li key={clip.id}>
                  <span className={`move ${was > rank ? 'up' : was < rank ? 'down' : ''}`}>{was > rank ? `▲${was - rank}` : was < rank ? `▼${rank - was}` : '•'}</span>
                  <span>
                    <strong>{clip.title}</strong>
                    <span className="muted small">
                      {' '}
                      · {clip.hookType} hook · score {clip.hookScore} → {clip.adjusted}
                      {clip.lift !== 1 ? ` (${clip.hookType} posts did ${clip.lift.toFixed(1)}× average)` : ''}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="learnings">
              <strong>Learnings sent with every future clip pick:</strong>
              <ul>
                {result.learnings.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
            <div className="row end">
              {applied ? (
                <>
                  <span className="status ok small">✓ Applied to future clip picks</span>
                  <button className="btn small" onClick={onGoClips}>
                    Re-pick clips with these →
                  </button>
                </>
              ) : (
                <button className="btn primary" onClick={() => onSaveLearnings(result.learnings)}>
                  Apply to future suggestions
                </button>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
