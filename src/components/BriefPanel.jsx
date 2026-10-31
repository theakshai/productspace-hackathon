import { useRef, useState } from 'react'
import { EXAMPLE_SPEECH, PLATFORMS, structureBrief } from '../lib/brief.js'
import DictationBox from './DictationBox.jsx'

function ListEditor({ label, values, onChange, placeholder }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        value={values.join(', ')}
        placeholder={placeholder}
        onChange={(e) =>
          onChange(
            e.target.value
              .split(',')
              .map((s) => s.trimStart())
              .filter((s, i, arr) => s || i === arr.length - 1),
          )
        }
        onBlur={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
      />
    </label>
  )
}

export default function BriefPanel({ settings, speech, onSpeechChange, brief, onBriefChange, onOpenSettings, onNext }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const textRef = useRef(null)

  async function run() {
    if (!settings.apiKey) {
      onOpenSettings()
      return
    }
    // Read straight from the box in case dictated text hasn't reached state yet.
    const text = textRef.current?.read() || speech
    if (text !== speech) onSpeechChange(text)
    setBusy(true)
    setError(null)
    try {
      const result = await structureBrief({ apiKey: settings.apiKey, model: settings.model, rawSpeech: text })
      onBriefChange(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const set = (patch) => onBriefChange({ ...brief, ...patch })
  const togglePlatform = (id) =>
    set({
      platforms: brief.platforms.includes(id) ? brief.platforms.filter((p) => p !== id) : [...brief.platforms, id],
    })

  return (
    <div className="brief">
      <div>
        <span className="tag">Step 2 · Voice brief</span>
        <h2>Tell ClipCraft what you want</h2>
        <p className="muted">
          Click the box, hold your Wispr Flow key and just talk: who it's for, what to look for, which platforms, the
          vibe. Ramble, say “uh”, change your mind. ClipCraft sorts it out.
        </p>
      </div>

      <div className="dictation">
        <DictationBox
          ref={textRef}
          className="dictation-box"
          value={speech}
          onChange={onSpeechChange}
          placeholder="🎙 Hold your Wispr Flow key and speak your brief…"
          rows={6}
          data-testid="speech"
        />
        <div className="row between">
          <button
            className="link"
            onClick={() => {
              onSpeechChange(EXAMPLE_SPEECH)
              textRef.current?.focus()
            }}
          >
            Use an example
          </button>
          <button className="btn primary" onClick={run} disabled={busy || speech.trim().length < 10}>
            {busy ? 'Understanding…' : brief ? 'Re-read my brief' : 'Turn into a brief'}
          </button>
        </div>
        {error && (
          <p className="status error" role="alert">
            {error}
          </p>
        )}
      </div>

      {brief && (
        <div className="brief-result" data-testid="brief-result">
          <p className="brief-summary">“{brief.summary}”</p>

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

          <div className="grid-2">
            <label className="field">
              <span>Audience</span>
              <input value={brief.audience} onChange={(e) => set({ audience: e.target.value })} />
            </label>
            <label className="field">
              <span>Goal</span>
              <input value={brief.goal} onChange={(e) => set({ goal: e.target.value })} />
            </label>
            <ListEditor label="Topics to look for" values={brief.topics} onChange={(topics) => set({ topics })} />
            <ListEditor label="Tone" values={brief.tone} onChange={(tone) => set({ tone })} />
            <ListEditor label="Leave out" values={brief.avoid} onChange={(avoid) => set({ avoid })} placeholder="Nothing" />
            <div className="field">
              <span>Clips</span>
              <div className="row">
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={brief.clipCount}
                  onChange={(e) => set({ clipCount: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })}
                  aria-label="Number of clips"
                  className="num"
                />
                <span className="muted small">clips of</span>
                <input
                  type="number"
                  min={10}
                  max={180}
                  value={brief.clipLengthSeconds.min}
                  onChange={(e) => set({ clipLengthSeconds: { ...brief.clipLengthSeconds, min: Number(e.target.value) || 10 } })}
                  aria-label="Minimum clip length in seconds"
                  className="num"
                />
                <span className="muted small">–</span>
                <input
                  type="number"
                  min={10}
                  max={180}
                  value={brief.clipLengthSeconds.max}
                  onChange={(e) => set({ clipLengthSeconds: { ...brief.clipLengthSeconds, max: Number(e.target.value) || 60 } })}
                  aria-label="Maximum clip length in seconds"
                  className="num"
                />
                <span className="muted small">sec</span>
              </div>
            </div>
          </div>

          <div className="field">
            <span>Platforms</span>
            <div className="chips">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  className={`chip ${brief.platforms.includes(p.id) ? 'on' : ''}`}
                  onClick={() => togglePlatform(p.id)}
                  aria-pressed={brief.platforms.includes(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {brief.assumptions.length > 0 && (
            <p className="muted small">Filled in for you: {brief.assumptions.join(' · ')}</p>
          )}

          <div className="row end">
            <button className="btn primary" onClick={onNext} disabled={!brief.platforms.length}>
              Looks right → transcript
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
