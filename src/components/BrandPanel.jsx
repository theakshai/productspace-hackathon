import { useRef, useState } from 'react'
import { platformLabel } from '../lib/brief.js'
import { collectManualEdits, collectVoiceFeedback, learnFromEdits, rulesFromSpeech } from '../lib/brand.js'
import DictationBox from './DictationBox.jsx'

const SOURCE_LABEL = { voice: 'From your voice edits', edits: 'Learned from your typed edits', said: 'You said it', typed: 'Added by you' }

function RuleRow({ rule, source, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(rule)
  return (
    <li className="rule-row">
      {editing ? (
        <input
          className="rule-input"
          value={text}
          autoFocus
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onSave(text.trim())
              setEditing(false)
            }
            if (e.key === 'Escape') setEditing(false)
          }}
        />
      ) : (
        <span className="rule-text">{rule}</span>
      )}
      <span className="tag source">{SOURCE_LABEL[source] || 'Added by you'}</span>
      <span className="row">
        {editing ? (
          <button
            className="btn small"
            onClick={() => {
              onSave(text.trim())
              setEditing(false)
            }}
          >
            Save
          </button>
        ) : (
          <button className="link" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
        <button className="link" onClick={onDelete} aria-label={`Delete rule: ${rule}`}>
          Delete
        </button>
      </span>
    </li>
  )
}

export default function BrandPanel({ settings, copy, onSetRules, onAddRules, onOpenSettings, onGoCopy, onNext }) {
  const rules = settings.brandRules || []
  const sources = settings.ruleSources || {}
  const [speech, setSpeech] = useState('')
  const [spoken, setSpoken] = useState(null) // { rules, corrections }
  const [learned, setLearned] = useState(null) // [{ rule, evidence }]
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [typed, setTyped] = useState('')
  const boxRef = useRef(null)

  const manualEdits = collectManualEdits(copy)
  const voiceLog = collectVoiceFeedback(copy).slice(0, 6)

  function needKey() {
    if (!settings.apiKey) {
      onOpenSettings()
      return true
    }
    return false
  }

  async function fromSpeech() {
    if (needKey()) return
    const text = (boxRef.current?.read() ?? speech).trim()
    if (text.length < 5) return
    setBusy('speech')
    setError(null)
    try {
      const result = await rulesFromSpeech({ apiKey: settings.apiKey, model: settings.model, speech: text, existingRules: rules })
      setSpoken(result)
      if (!result.rules.length) setError('No new rules heard in that. Try saying how you like your posts to sound.')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  async function analyse() {
    if (needKey()) return
    setBusy('learn')
    setError(null)
    try {
      const result = await learnFromEdits({ apiKey: settings.apiKey, model: settings.model, pairs: manualEdits, existingRules: rules })
      setLearned(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  const update = (i, text) => {
    if (!text) return
    const next = [...rules]
    const old = next[i]
    next[i] = text
    const nextSources = { ...sources, [text]: sources[old] || 'typed' }
    delete nextSources[old]
    onSetRules(next, nextSources)
  }
  const remove = (i) => {
    const next = rules.filter((_, j) => j !== i)
    const nextSources = { ...sources }
    delete nextSources[rules[i]]
    onSetRules(next, nextSources)
  }

  return (
    <div className="brand-panel">
      <div>
        <span className="tag">Step 5 · Brand voice</span>
        <h2>Brand voice memory</h2>
        <p className="muted">
          Everything ClipCraft has learned about how you write. Every caption and every rewrite follows these rules. It
          learns from what you say and from how you edit.
        </p>
      </div>

      <section className="brand-section">
        <h3 className="small-heading">Your rules ({rules.length})</h3>
        {rules.length ? (
          <ol className="rule-list" data-testid="rule-list">
            {rules.map((r, i) => (
              <RuleRow key={r + i} rule={r} source={sources[r]} onSave={(t) => update(i, t)} onDelete={() => remove(i)} />
            ))}
          </ol>
        ) : (
          <p className="muted small">
            No rules yet. Teach it by voice below, give voice feedback on captions in step 4, or edit captions and let it learn.
          </p>
        )}
        <form
          className="row add-rule"
          onSubmit={(e) => {
            e.preventDefault()
            if (typed.trim()) onAddRules([typed.trim()], 'typed')
            setTyped('')
          }}
        >
          <input className="rule-input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type a rule, e.g. Always credit the guest by name." />
          <button className="btn small" type="submit" disabled={!typed.trim()}>
            Add
          </button>
        </form>
      </section>

      <section className="brand-section">
        <h3 className="small-heading">🎙 Teach it by voice</h3>
        <p className="muted small">Hold your Wispr Flow key and describe how you like to write. Ramble, it'll sort it out.</p>
        <DictationBox
          ref={boxRef}
          className="dictation-box small-box"
          value={speech}
          onChange={setSpeech}
          rows={3}
          placeholder="🎙 “I keep it casual, like talking to a friend. No emojis, uh, maybe one at most. Always mention the guest's name, and never more than three hashtags…”"
          data-testid="rule-speech"
        />
        <div className="row end">
          <button className="btn small primary" onClick={fromSpeech} disabled={busy === 'speech' || speech.trim().length < 5}>
            {busy === 'speech' ? 'Listening…' : 'Turn into rules'}
          </button>
        </div>
        {spoken && (spoken.rules.length > 0 || spoken.corrections.length > 0) && (
          <div className="callout" data-testid="spoken-rules">
            {spoken.corrections.length > 0 && (
              <p className="small">
                Understood your corrections:{' '}
                {spoken.corrections.map((c, i) => (
                  <span key={i}>
                    <span className="strike">{c.heard}</span> → {c.understood}
                    {i < spoken.corrections.length - 1 ? '; ' : ''}
                  </span>
                ))}
              </p>
            )}
            <ul>
              {spoken.rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <div className="row end">
              <button className="link" onClick={() => setSpoken(null)}>
                Discard
              </button>
              <button
                className="btn small primary"
                onClick={() => {
                  onAddRules(spoken.rules, 'said')
                  setSpoken(null)
                  setSpeech('')
                }}
                disabled={!spoken.rules.length}
              >
                Add {spoken.rules.length} rule{spoken.rules.length === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="brand-section">
        <h3 className="small-heading">Learn from my edits</h3>
        {manualEdits.length ? (
          <>
            <p className="muted small">
              You've changed {manualEdits.length} caption{manualEdits.length === 1 ? '' : 's'} by hand. ClipCraft can compare
              them with what it wrote and work out your style.
            </p>
            <div className="row">
              <button className="btn small primary" onClick={analyse} disabled={busy === 'learn'}>
                {busy === 'learn' ? 'Studying your edits…' : 'Analyse my edits'}
              </button>
            </div>
          </>
        ) : (
          <p className="muted small">
            No hand edits yet. Change a few captions in{' '}
            <button className="link inline" onClick={onGoCopy}>
              step 4
            </button>{' '}
            and come back.
          </p>
        )}
        {learned && (
          <div className="learned" data-testid="learned">
            {learned.length === 0 && <p className="muted small">No new patterns found in your edits yet.</p>}
            {learned.map((l) => (
              <div key={l.rule} className="learned-item">
                <div>
                  <strong>{l.rule}</strong>
                  <p className="muted small">{l.evidence}</p>
                </div>
                <div className="row">
                  <button
                    className="btn small"
                    onClick={() => {
                      onAddRules([l.rule], 'edits')
                      setLearned((x) => x.filter((y) => y.rule !== l.rule))
                    }}
                  >
                    Accept
                  </button>
                  <button className="link" onClick={() => setLearned((x) => x.filter((y) => y.rule !== l.rule))}>
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {voiceLog.length > 0 && (
        <section className="brand-section">
          <h3 className="small-heading">What you've told it recently</h3>
          <ul className="voice-log">
            {voiceLog.map((v, i) => (
              <li key={i}>
                <span className="tag">{platformLabel(v.platform)}</span> “{v.feedback}”
                <span className="muted small"> → {v.changes}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && (
        <p className="status error" role="alert">
          {error}
        </p>
      )}

      <div className="row end">
        <button className="btn primary" onClick={onNext}>
          Next: content calendar →
        </button>
      </div>
    </div>
  )
}
