import { useEffect, useState } from 'react'
import Settings from './components/Settings.jsx'
import BriefPanel from './components/BriefPanel.jsx'
import UploadPanel from './components/UploadPanel.jsx'
import { load, save } from './lib/storage.js'

// Each step maps to a feature in features.md. Steps unlock as features ship.
const STEPS = [
  { id: 'upload', label: 'Upload', feature: 'F1', blurb: 'Drop a 10–20 minute podcast, video or audio.' },
  { id: 'brief', label: 'Voice brief', feature: 'F2', blurb: 'Tell ClipCraft what you want, by voice with Wispr Flow.' },
  { id: 'transcript', label: 'Transcript', feature: 'F3', blurb: 'Timestamped, speaker-labelled transcript.' },
  { id: 'clips', label: 'Clips', feature: 'F4', blurb: 'The best moments, each with a reason.' },
  { id: 'copy', label: 'Copy', feature: 'F5–F6', blurb: 'Captions and posts for every platform. Edit by voice.' },
  { id: 'brand', label: 'Brand voice', feature: 'F7', blurb: 'Rules learned from your edits.' },
  { id: 'calendar', label: 'Calendar', feature: 'F8', blurb: 'When and where each clip goes out.' },
  { id: 'performance', label: 'Performance', feature: 'F9', blurb: 'What worked, and how suggestions changed.' },
]

function Placeholder({ step }) {
  return (
    <div className="placeholder">
      <span className="tag">{step.feature}</span>
      <h2>{step.label}</h2>
      <p className="muted">{step.blurb}</p>
      <p className="hint">Coming in {step.feature}.</p>
    </div>
  )
}

// The File object and its preview URL only live in memory; everything else is saved.
function persistableMedia(media) {
  if (!media) return null
  const { file: _file, previewUrl: _url, ...rest } = media
  return rest
}

function restoreMedia() {
  const saved = load('media', null)
  if (!saved) return null
  // Gemini deletes uploaded files after 48 hours.
  if (saved.gemini?.expiresAt && new Date(saved.gemini.expiresAt) < new Date()) {
    return { ...saved, gemini: null }
  }
  return saved
}

export default function App() {
  const [active, setActive] = useState('upload')
  const [settings, setSettings] = useState(() => load('settings', { apiKey: '', model: '' }))
  const [media, setMedia] = useState(restoreMedia)
  const [speech, setSpeech] = useState(() => load('speech', ''))
  const [brief, setBrief] = useState(() => load('brief', null))
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => save('settings', settings), [settings])
  useEffect(() => save('media', persistableMedia(media)), [media])
  useEffect(() => save('speech', speech), [speech])
  useEffect(() => save('brief', brief), [brief])

  const done = { upload: Boolean(media?.gemini), brief: Boolean(brief) }

  const step = STEPS.find((s) => s.id === active)

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true">✂</span>
          <span className="name">ClipCraft</span>
          <span className="tagline">One podcast in. A week of content out.</span>
        </div>
        <div className="row">
          <span className="voice-pill" title="All input in ClipCraft is designed for Wispr Flow dictation">
            🎙 Built for Wispr Flow
          </span>
          <button className="btn small" onClick={() => setShowSettings(true)}>
            ⚙ Settings{settings.apiKey ? '' : ' · add key'}
          </button>
        </div>
      </header>

      <div className="layout">
        <nav className="steps" aria-label="Workflow steps">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              className={`step ${s.id === active ? 'active' : ''}`}
              onClick={() => setActive(s.id)}
            >
              <span className="step-num">{done[s.id] ? '✓' : i + 1}</span>
              <span className="step-label">{s.label}</span>
            </button>
          ))}
        </nav>

        <main className="panel">
          {active === 'upload' ? (
            <UploadPanel
              settings={settings}
              media={media}
              onMediaChange={setMedia}
              onOpenSettings={() => setShowSettings(true)}
              onNext={() => setActive('brief')}
            />
          ) : active === 'brief' ? (
            <BriefPanel
              settings={settings}
              speech={speech}
              onSpeechChange={setSpeech}
              brief={brief}
              onBriefChange={setBrief}
              onOpenSettings={() => setShowSettings(true)}
              onNext={() => setActive('transcript')}
            />
          ) : (
            <Placeholder step={step} />
          )}
        </main>
      </div>

      {showSettings && (
        <Settings settings={settings} onSave={setSettings} onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}
