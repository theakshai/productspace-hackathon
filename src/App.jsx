import { useState } from 'react'

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

function UploadPanel() {
  return (
    <div className="dropzone">
      <div className="dropzone-icon" aria-hidden="true">▲</div>
      <h2>Upload a podcast</h2>
      <p className="muted">MP4, MOV, MP3, M4A or WAV · 10–20 minutes works best</p>
      <button className="btn primary" disabled title="Arrives in F1">
        Choose file
      </button>
      <p className="hint">Upload arrives in F1.</p>
    </div>
  )
}

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

export default function App() {
  const [active, setActive] = useState('upload')
  const step = STEPS.find((s) => s.id === active)

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true">✂</span>
          <span className="name">ClipCraft</span>
          <span className="tagline">One podcast in. A week of content out.</span>
        </div>
        <span className="voice-pill" title="All input in ClipCraft is designed for Wispr Flow dictation">
          🎙 Built for Wispr Flow
        </span>
      </header>

      <div className="layout">
        <nav className="steps" aria-label="Workflow steps">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              className={`step ${s.id === active ? 'active' : ''}`}
              onClick={() => setActive(s.id)}
            >
              <span className="step-num">{i + 1}</span>
              <span className="step-label">{s.label}</span>
            </button>
          ))}
        </nav>

        <main className="panel">{active === 'upload' ? <UploadPanel /> : <Placeholder step={step} />}</main>
      </div>
    </div>
  )
}
